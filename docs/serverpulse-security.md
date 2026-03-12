# ServerPulse — Security Documentation

## Overview

This document describes the security architecture, known risks, required hardening measures, and recommended operational security practices for the ServerPulse application. It is intended for developers, DevOps engineers, and security reviewers.

Threat model in brief: ServerPulse runs with elevated read access to the host OS and exposes process control capabilities (SIGTERM/SIGKILL) via a web interface. A successful attack against this application could expose sensitive process data, credentials in environment variables, or allow an attacker to destabilize running services on the monitored host.

---

## Table of Contents

1. [Container & Host Security](#1-container--host-security)
2. [Authentication & Session Management](#2-authentication--session-management)
3. [Authorization & Role-Based Access Control](#3-authorization--role-based-access-control)
4. [API Security](#4-api-security)
5. [Dangerous Features — Special Mitigations](#5-dangerous-features--special-mitigations)
6. [Database Security](#6-database-security)
7. [Secrets Management](#7-secrets-management)
8. [Transport Security (TLS)](#8-transport-security-tls)
9. [Frontend Security](#9-frontend-security)
10. [Dependency Security](#10-dependency-security)
11. [Logging & Audit](#11-logging--audit)
12. [Security Checklist](#12-security-checklist)

---

## 1. Container & Host Security

### The `/proc` Mount Risk

The backend container mounts the host's `/proc` and `/sys` filesystems to read process and system data. This is the most significant architectural risk in the entire application.

**Risk:** A compromised backend container can read the `/proc/[pid]/environ` of any process on the host, including processes belonging to other containers. This can expose environment variables containing database passwords, API keys, and other secrets of unrelated services running on the same host.

**Required mitigations:**

```yaml
# docker-compose.yml — enforce read-only mounts and drop capabilities
backend:
  volumes:
    - /proc:/host/proc:ro   # MUST be read-only
    - /sys:/host/sys:ro     # MUST be read-only
  cap_drop:
    - ALL                   # Drop all Linux capabilities
  cap_add:
    - SYS_PTRACE            # Re-add only what is needed for /proc reads
  read_only: true           # Make container filesystem read-only
  tmpfs:
    - /tmp                  # Allow only tmpfs for temp files
  security_opt:
    - no-new-privileges:true
```

**Additional hardening:**
- Run the backend process as a non-root user. Add to the backend `Dockerfile`:

```dockerfile
RUN addgroup -S serverpulse && adduser -S serverpulse -G serverpulse
USER serverpulse
```

- Consider using a **seccomp profile** to restrict syscalls available to the container.
- If the host runs other sensitive services, evaluate whether a dedicated monitoring VM is more appropriate than sharing the host.

### Container Network Isolation

```yaml
# docker-compose.yml — isolate services on internal network
services:
  frontend:
    networks: [public]
  backend:
    networks: [public, internal]
  postgres:
    networks: [internal]   # PostgreSQL MUST NOT be reachable from outside

networks:
  public:
  internal:
    internal: true         # No outbound internet access from this network
```

PostgreSQL must never be exposed on a public port. Remove any `ports:` mapping from the `postgres` service in production.

---

## 2. Authentication & Session Management

### Token Storage — XSS Mitigation

**Never store the JWT access token in `localStorage` or `sessionStorage`.** These are accessible to any JavaScript running on the page, making them trivially stealable via XSS.

**Correct approach:**

| Token | Storage | Rationale |
|---|---|---|
| Access Token (15 min TTL) | JavaScript memory (React state / Zustand store) | Never written to disk or DOM-accessible storage |
| Refresh Token (7 day TTL) | `httpOnly; Secure; SameSite=Strict` cookie | Inaccessible to JavaScript; sent automatically by browser |

```typescript
// backend: set refresh token as httpOnly cookie
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  path: '/api/auth/refresh',         // Scoped to refresh endpoint only
});
```

### Password Policy

- Passwords hashed with **bcryptjs**, cost factor **12** minimum (increase to 14 for high-security environments).
- Minimum password length: **12 characters**.
- Enforce complexity via `zod` validation on the API before hashing.
- Password reset tokens must be single-use, time-limited (15 minutes), and stored as a bcrypt hash in the database — never in plaintext.

```typescript
// backend/src/types/user.ts
import { z } from 'zod';

export const PasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');
```

### Brute-Force Protection

Rate limiting on all authentication endpoints is mandatory:

```typescript
// backend/src/api/auth.ts
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // Max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, loginHandler);
```

Also apply a **global rate limiter** to the entire API (e.g. 300 requests per minute per IP) to prevent enumeration and DoS.

### Two-Factor Authentication (TOTP)

2FA via `speakeasy` is optional per user but **strongly recommended for Admin accounts**. Consider making 2FA mandatory for the Admin role via policy enforcement at login:

```typescript
if (user.role === 'admin' && !user.totp_secret) {
  return res.status(403).json({ error: 'Admin accounts must enable 2FA.' });
}
```

---

## 3. Authorization & Role-Based Access Control

### Role Definitions

| Role | Process View | Kill Process | Alert Config | Monitor Config | User Management | Audit Log |
|---|---|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Operator** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ (own actions) |
| **Viewer** | ✅ | ❌ | ❌ (read-only) | ❌ (read-only) | ❌ | ❌ |

### RBAC Middleware

Every protected route must declare its minimum required role. The `rbac` middleware must be applied **after** the JWT `auth` middleware:

```typescript
// backend/src/middleware/rbac.ts
import { Role } from '../types/user';

const roleHierarchy: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

export const requireRole = (minimum: Role) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || roleHierarchy[userRole] < roleHierarchy[minimum]) {
      res.status(403).json({ error: 'Insufficient permissions.' });
      return;
    }
    next();
  };

// Usage in route files:
router.delete('/processes/:pid', auth, requireRole('admin'), killProcessHandler);
```

### Principle of Least Privilege

- Operators cannot create or delete users — only Admins can.
- Viewers receive a read-only JWT claim that the backend validates independently; frontend role checks are UI-only and cannot be trusted for security.
- Shell Command Monitors (arbitrary command execution) are restricted to **Admin only**, not Operator.

---

## 4. API Security

### Input Validation

All incoming request bodies must be validated with **zod** before processing. Never trust client-supplied data, including PID values, process names, and monitor configurations.

```typescript
// backend/src/api/alerts.ts
import { z } from 'zod';

const CreateAlertSchema = z.object({
  name: z.string().min(1).max(100),
  processName: z.string().min(1).max(255),
  metric: z.enum(['cpu', 'memory', 'missing', 'restarts']),
  operator: z.enum(['>', '<', '=']),
  threshold: z.number().min(0).max(100),
  durationSeconds: z.number().int().min(0).max(86400),
  cooldownSeconds: z.number().int().min(60).max(86400),
  severity: z.enum(['info', 'warning', 'critical']),
  channels: z.array(NotificationChannelSchema).max(10),
  enabled: z.boolean(),
});
```

### CORS Configuration

```typescript
// backend/src/index.ts
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL,  // e.g. 'https://monitor.example.com'
  credentials: true,                  // Required for httpOnly cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Never use `origin: '*'` in production. The wildcard origin also **disables** `credentials: true`, breaking cookie-based refresh tokens.

### Security Headers

Use `helmet` to set security-relevant HTTP response headers:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'wss://monitor.example.com'],  // WebSocket origin
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],              // Adjust if using CSS-in-JS
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

## 5. Dangerous Features — Special Mitigations

### Process Kill (SIGTERM / SIGKILL)

This is the highest-risk feature in the application. Sending `SIGKILL` to the wrong process (e.g. the database, a kernel thread, or a critical system daemon) can cause data loss or system instability.

**Required safeguards:**

**1. Process kill is Admin-only** — enforced at the API level, not just in the UI.

**2. Blocklist of protected process names** — the backend must refuse to kill processes matching any entry:

```typescript
// backend/src/config/processKillBlocklist.ts
export const KILL_BLOCKLIST: ReadonlySet<string> = new Set([
  'init', 'systemd', 'kernel', 'kthreadd', 'postgres', 'sshd',
  'dockerd', 'containerd', 'node',  // Add your own critical processes
]);

// In the kill handler:
if (KILL_BLOCKLIST.has(processName)) {
  return res.status(403).json({ error: `Process '${processName}' is protected.` });
}
```

**3. PID 1 is never killable** — enforce at the API level:

```typescript
const pid = parseInt(req.params.pid, 10);
if (pid <= 1 || isNaN(pid)) {
  return res.status(400).json({ error: 'Invalid PID.' });
}
```

**4. Audit every kill action** — write to `audit_log` before executing the signal, not after.

**5. UI confirmation dialog** must display process name, PID, owner, and signal type. Require the user to type the process name to confirm for `SIGKILL`.

### Shell Command Monitor (Arbitrary Execution)

The Shell Monitor executes arbitrary commands on the server. This is extremely powerful and dangerous.

**Required safeguards:**
- Restricted to **Admin role only**.
- Commands run as the non-root `serverpulse` OS user — never as root.
- Impose a strict **5-second timeout** on all shell command executions.
- Log every executed command to the audit log.
- Consider maintaining an **allowlist of approved commands** rather than allowing fully arbitrary input.

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runShellMonitor(command: string): Promise<number> {
  const { stdout } = await execAsync(command, {
    timeout: 5000,         // 5 second hard limit
    uid: SERVERPULSE_UID,  // Run as non-root user
    env: {},               // Empty environment — no inherited secrets
  });
  const value = parseFloat(stdout.trim());
  if (isNaN(value)) throw new Error('Command did not return a numeric value.');
  return value;
}
```

---

## 6. Database Security

### Least-Privilege DB User

The `serverpulse` PostgreSQL user must only have the minimum required permissions:

```sql
-- Create application user with no superuser rights
CREATE USER serverpulse WITH PASSWORD 'strong-random-password';

-- Grant only what is needed on the application database
GRANT CONNECT ON DATABASE serverpulse TO serverpulse;
GRANT USAGE ON SCHEMA public TO serverpulse;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO serverpulse;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO serverpulse;

-- Migrations should be run by a separate, more privileged user (e.g. serverpulse_admin)
-- not by the application runtime user
```

### SQL Injection Prevention

The `pg` driver's parameterised query API must always be used. String concatenation into SQL is **never acceptable**:

```typescript
// ❌ NEVER — SQL injection vulnerability
const result = await pool.query(`SELECT * FROM users WHERE username = '${username}'`);

// ✅ ALWAYS — parameterised query
const result = await pool.query<UserRow>(
  'SELECT * FROM users WHERE username = $1',
  [username]
);
```

### Connection Encryption

Enable SSL for the PostgreSQL connection in production:

```typescript
// backend/src/config/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true, ca: process.env.PG_CA_CERT }
    : false,
});
```

---

## 7. Secrets Management

### What Counts as a Secret

- `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `DATABASE_URL` (contains password)
- `SMTP_PASS`
- `PG_CA_CERT`
- Any webhook URLs containing tokens

### Rules

- Secrets are **never committed to Git**. Add `.env` to `.gitignore` and add a pre-commit hook (e.g. `git-secrets` or `gitleaks`) to scan for accidental commits.
- Secrets are **never logged** — ensure no middleware or error handler serializes `process.env` or request bodies containing passwords.
- In production, prefer **Docker Secrets** or a dedicated secret manager over plain environment variables:

```yaml
# docker-compose.yml with Docker Secrets
secrets:
  jwt_secret:
    external: true
  db_password:
    external: true

services:
  backend:
    secrets:
      - jwt_secret
      - db_password
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - DB_PASSWORD_FILE=/run/secrets/db_password
```

- **Rotate secrets regularly** — particularly after any suspected compromise or after an employee with access leaves the team.
- JWT secrets must be at least **64 random bytes**, generated with a cryptographically secure source:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 8. Transport Security (TLS)

**All traffic must be encrypted in transit.** Running ServerPulse over plain HTTP in production is not acceptable — JWTs, passwords, and process data would be transmitted in cleartext.

### Recommended Setup: Reverse Proxy (nginx or Traefik)

Do not terminate TLS in the Node.js process. Place a reverse proxy in front:

```nginx
# nginx.conf (simplified)
server {
  listen 443 ssl http2;
  server_name monitor.example.com;

  ssl_certificate     /etc/ssl/certs/monitor.crt;
  ssl_certificate_key /etc/ssl/private/monitor.key;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

  # WebSocket upgrade for Socket.io
  location /socket.io/ {
    proxy_pass         http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
  }

  location /api/ {
    proxy_pass http://backend:3001;
  }

  location / {
    proxy_pass http://frontend:80;
  }
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  return 301 https://$host$request_uri;
}
```

Use **Let's Encrypt** (via Certbot or Traefik's built-in ACME client) for free, auto-renewing certificates.

### WebSocket Security

Socket.io connections must use `wss://` (WebSocket Secure) in production. The frontend client must be configured accordingly:

```typescript
// frontend/src/hooks/useWebSocket.ts
const socket = io(import.meta.env.VITE_API_URL, {
  transports: ['websocket'],
  secure: true,                  // Enforce WSS
  withCredentials: true,         // Send httpOnly refresh cookie
});
```

---

## 9. Frontend Security

### Content Security Policy

The CSP header (set via `helmet` on the backend and mirrored in the nginx config) should be as restrictive as possible. The goal is to prevent XSS from loading external scripts or exfiltrating data:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' wss://monitor.example.com;
  img-src 'self' data:;
  frame-ancestors 'none';
```

`frame-ancestors 'none'` prevents clickjacking by disallowing the app from being embedded in an iframe.

### Sensitive Data in the UI

- Never render raw process environment variables (`/proc/[pid]/environ`) without explicit user action — this data frequently contains secrets of other applications.
- In the Process Detail Drawer, show environment variables only on explicit click with a warning, and mask values containing common secret patterns (`PASSWORD`, `SECRET`, `KEY`, `TOKEN`).

---

## 10. Dependency Security

### Automated Scanning

Run `npm audit` as part of every CI pipeline run. Fail the build on high or critical severity findings:

```bash
npm audit --audit-level=high
```

Use **Dependabot** or **Renovate** to receive automated pull requests for dependency updates.

### Supply Chain

- Use `package-lock.json` (committed to Git) to pin exact dependency versions.
- Consider using `npm ci` instead of `npm install` in all Docker builds and CI pipelines — it installs exactly what is in the lockfile.
- Periodically review dependencies for abandonware or ownership changes.

---

## 11. Logging & Audit

### What to Log

Every security-relevant event must be written to the `audit_log` table and/or a structured log stream:

| Event | Severity | Fields |
|---|---|---|
| Successful login | INFO | user_id, ip, timestamp |
| Failed login attempt | WARN | username_attempted, ip, timestamp |
| Token refresh | INFO | user_id, ip |
| Process killed | CRITICAL | user_id, pid, process_name, signal, ip |
| Alert rule created/modified/deleted | INFO | user_id, rule_id, diff |
| User created/role changed/deleted | INFO | acting_user_id, target_user_id, change |
| Shell command executed | WARN | user_id, command, exit_code |
| DB connection failure | ERROR | timestamp, error_message |

### What Never to Log

- Passwords or password hashes
- JWT token values
- Full HTTP request bodies on auth endpoints
- Process environment variable values (`/proc/[pid]/environ`)

### Log Storage

Use **structured JSON logging** (e.g. via `pino`) for easy ingestion into log management systems. In production, stream logs to an external system (e.g. Loki, Elasticsearch, or a managed SIEM) so that logs cannot be tampered with by an attacker who gains container access.

---

## 12. Security Checklist

Use this checklist before every production deployment.

### Container & Infrastructure
- [ ] `/proc` and `/sys` mounts are `read-only`
- [ ] Backend container runs as non-root user (`serverpulse`)
- [ ] All Linux capabilities dropped except what is strictly required
- [ ] PostgreSQL port not exposed outside the internal Docker network
- [ ] `no-new-privileges:true` set on backend container

### Authentication
- [ ] Refresh token stored as `httpOnly; Secure; SameSite=Strict` cookie
- [ ] Access token stored only in JavaScript memory (not `localStorage`)
- [ ] Login endpoint protected by rate limiting (max 10 attempts / 15 min)
- [ ] bcrypt cost factor ≥ 12
- [ ] 2FA enforced for all Admin accounts
- [ ] Password reset tokens are single-use and expire after 15 minutes

### Authorization
- [ ] Every API route declares a minimum required role
- [ ] Process kill endpoint is Admin-only
- [ ] Shell Monitor creation is Admin-only
- [ ] Frontend role checks duplicated and enforced independently on the backend

### Process Kill
- [ ] PID ≤ 1 rejected at API level
- [ ] Blocklist of protected process names enforced
- [ ] Every kill action written to audit log before execution
- [ ] UI requires typing the process name to confirm SIGKILL

### Secrets
- [ ] `.env` in `.gitignore`
- [ ] Pre-commit hook scans for accidental secret commits
- [ ] JWT secrets are ≥ 64 random bytes
- [ ] No secrets present in Docker image layers (`docker history` check)
- [ ] Production uses Docker Secrets or a secret manager

### Transport
- [ ] TLS enforced; HTTP redirects to HTTPS
- [ ] WebSocket connection uses `wss://`
- [ ] HSTS header set with `max-age=31536000`
- [ ] CORS `origin` restricted to known frontend domain

### Application
- [ ] All API inputs validated with zod schemas
- [ ] `npm audit --audit-level=high` passes with no findings
- [ ] CSP header is set and does not contain `unsafe-eval`
- [ ] Process environment variables masked in UI before display
- [ ] Structured logging active; logs shipped to external system

---

*ServerPulse Security Documentation — review and update with every major release.*
