# ServerPulse — Linux Server Monitoring Application

## Project Overview

ServerPulse is a full-stack web application for real-time Linux server monitoring. It provides a live process table (similar to `top`), system resource dashboards, configurable process alerts with notifications, and time-series statistics for custom metrics including HTTP endpoint probing. The entire codebase — both backend and frontend — is written in **TypeScript**. The stack runs entirely in Docker and is built with Node.js/Express on the backend and React/Webpack on the frontend, with PostgreSQL as the persistent datastore.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Technology Stack](#technology-stack)
3. [Feature Specification](#feature-specification)
   - [Process Monitor](#1-process-monitor)
   - [System Dashboard](#2-system-dashboard)
   - [Process Alerts & Notifications](#3-process-alerts--notifications)
   - [Custom Metrics & Statistics](#4-custom-metrics--statistics)
   - [User Management](#5-user-management)
4. [Backend Structure](#backend-structure)
5. [Frontend Structure](#frontend-structure)
6. [Database Schema](#database-schema)
7. [Docker Setup](#docker-setup)
8. [API Reference](#api-reference)
9. [Environment Variables](#environment-variables)
10. [Development Guide](#development-guide)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Compose Stack                     │
│                                                              │
│  ┌─────────────────┐        ┌──────────────────────────┐    │
│  │  React Frontend  │        │   Node.js / Express       │    │
│  │  (Webpack, :80)  │◄──────►│   Backend  (:3001)        │    │
│  └─────────────────┘  HTTP  │   REST API + Socket.io    │    │
│                        WS   └────────────┬─────────────┘    │
│                                          │                   │
│                        ┌─────────────────▼──────────────┐   │
│                        │         PostgreSQL 16           │   │
│                        │         (:5432)                 │   │
│                        └────────────────────────────────┘   │
│                                          │                   │
│                        ┌─────────────────▼──────────────┐   │
│                        │   Linux Host OS                 │   │
│                        │   /proc (ro), /sys (ro)         │   │
│                        └────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

Data flows from the Linux kernel via the `/proc` and `/sys` virtual filesystems into backend **Collector** modules. Collectors run on configurable intervals (via `node-cron`) and push data to connected clients over WebSockets and persist metrics in PostgreSQL.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Language** | TypeScript 5 | Strict typing across the entire codebase (backend + frontend) |
| **Backend Runtime** | Node.js 20 LTS | Server-side TypeScript (compiled via `tsc`) |
| **Backend Framework** | Express 4 + `@types/express` | REST API routing |
| **Real-time Transport** | Socket.io 4 | Live process & metric streaming |
| **Database** | PostgreSQL 16 | Persistent storage (metrics, alerts, users) |
| **Database Client** | `pg` + `@types/pg` | Query execution, connection pooling |
| **Scheduling** | `node-cron` + `@types/node-cron` | Periodic collector and aggregator jobs |
| **Authentication** | `jsonwebtoken` + `bcryptjs` + matching `@types/*` | JWT-based auth, password hashing |
| **Email Alerts** | `nodemailer` + `@types/nodemailer` | SMTP notification delivery |
| **2FA (optional)** | `speakeasy` + `@types/speakeasy` | TOTP-based two-factor authentication |
| **Frontend** | React 18 + `@types/react` | Component-based UI |
| **Bundler** | Webpack 5 + `ts-loader` | TypeScript transpilation and module bundling, HMR in dev |
| **Charts** | Recharts | Time-series and gauge visualizations |
| **Tables** | TanStack Table v8 | Sortable, filterable process table (ships own types) |
| **HTTP Client** | Axios | Frontend API calls (ships own types) |
| **Containerization** | Docker + Docker Compose | Multi-service orchestration |

---

## Feature Specification

### 1. Process Monitor

**Goal:** Replicate the functionality of the Linux `top` command in a sortable, filterable, real-time web table.

**Data Source:** Backend reads `/proc/[pid]/stat`, `/proc/[pid]/status`, and `/proc/[pid]/cmdline` for every PID in `/proc` that is a numeric directory.

**Update Frequency:** Every 2 seconds via WebSocket push (`socket.emit('processes', data)`).

#### Displayed Columns

| Column | Source | Sortable |
|---|---|---|
| PID | `/proc/[pid]/stat` field 1 | ✅ |
| Process Name | `/proc/[pid]/comm` | ✅ |
| User | `/proc/[pid]/status` UID → `/etc/passwd` lookup | ✅ |
| CPU % | Delta of `utime + stime` between two readings | ✅ |
| MEM % | RSS / MemTotal from `/proc/meminfo` | ✅ |
| VSZ (KB) | Virtual memory size from `/proc/[pid]/stat` field 23 | ✅ |
| RSS (KB) | Resident set size from `/proc/[pid]/stat` field 24 | ✅ |
| Status | `/proc/[pid]/status` State field (R/S/D/Z/T) | ✅ |
| Started | Process start time derived from `/proc/[pid]/stat` field 22 + boot time | ✅ |
| Threads | `/proc/[pid]/status` Threads field | ✅ |

#### UI Behaviours

- Click any column header to sort ascending; click again to sort descending.
- Global search input filters by process name or PID in real time.
- Row color coding:
  - 🔴 Red — CPU > 80% or MEM > 80%
  - 🟡 Yellow — CPU 40–80% or MEM 40–80%
  - 🟢 Green — below thresholds
- Click a row to open a **Process Detail Drawer** showing open file descriptors, network connections (`/proc/[pid]/net/tcp`), environment variables, and full command line.
- Admin and Operator roles may send `SIGTERM` or `SIGKILL` to a process directly from the UI (confirmation dialog required).

---

### 2. System Dashboard

The dashboard displays live system-wide resource metrics with historical sparklines for the last 60 seconds.

#### CPU

- Overall utilization (%) — computed from `/proc/stat` line `cpu` delta between ticks.
- Per-core utilization — one card per logical CPU from `/proc/stat` lines `cpu0`, `cpu1`, …
- Load average (1 min / 5 min / 15 min) from `/proc/loadavg`.
- Visualized as a real-time line chart updating every 2 seconds.

#### Memory

- Total, Used, Free, Cached, Buffers — from `/proc/meminfo`.
- Swap total, swap used, swap free.
- Visualized as a donut chart showing Used / Cached / Free proportions.

#### Disk

- All mounted filesystems via `statvfs` syscall equivalent (`df -h` output parsed from shell).
- Per-filesystem: total capacity, used, available, use-percentage.
- Read/Write IOPS and throughput (MB/s) from `/proc/diskstats`.
- Visualized as horizontal bar charts per partition.

#### Network

- Bytes received / transmitted per network interface from `/proc/net/dev`.
- Active TCP connections count from `/proc/net/tcp`.
- Open listening ports.

---

### 3. Process Alerts & Notifications

Users define **alert rules** that are evaluated every collection cycle by the `alertEngine` service.

#### Alert Rule Fields

```typescript
interface AlertRule {
  id: number;
  name: string;
  processName: string;       // Exact match or glob pattern, e.g. "nginx", "node*"
  metric: 'cpu' | 'memory' | 'missing' | 'restarts';
  operator: '>' | '<' | '=';
  threshold: number;         // Percentage for cpu/memory; count for restarts
  durationSeconds: number;   // Must be exceeded continuously for this long
  cooldownSeconds: number;   // Minimum gap between repeated alerts (anti-spam)
  severity: 'info' | 'warning' | 'critical';
  channels: NotificationChannel[];
  enabled: boolean;
}

interface NotificationChannel {
  type: 'email' | 'webhook' | 'inapp';
  target: string;            // Email address or webhook URL
}
```

#### Built-in Alert Types

| Metric | Example Threshold | Meaning |
|---|---|---|
| `cpu` | `> 80` for 30s | CPU usage above 80% for 30 continuous seconds |
| `memory` | `> 500` (MB) | RSS exceeds 500 MB |
| `missing` | — | Process no longer appears in `/proc` |
| `restarts` | `> 3` in 1h | Process PID changed more than 3 times in 1 hour |

#### Notification Channels

- **In-app** — Toast notification in the UI + persisted entry in the Notification Center (bell icon in nav).
- **Email** — Sent via Nodemailer with configurable SMTP. Template includes process name, metric value, threshold, and timestamp.
- **Webhook** — HTTP POST with JSON payload to any URL (Slack incoming webhook, Microsoft Teams, Discord, PagerDuty, etc.).

#### Alert History

- All fired alerts are stored in the `alert_events` table with timestamp, resolved timestamp (when metric returned below threshold), severity, and channel delivery status.
- Viewable in the **Alerts → History** tab with filters by severity, process, and date range.
- Alerts can be acknowledged by operators to suppress repeat notifications during an incident.

---

### 4. Custom Metrics & Statistics

Users define **monitors** that collect a specific measurement from a process or HTTP endpoint on a schedule and store time-series data in PostgreSQL.

#### Monitor Types

**HTTP Endpoint Monitor**

```typescript
interface HttpMonitor {
  type: 'http';
  name: string;               // e.g. "API /health latency"
  url: string;                // e.g. "http://localhost:3000/api/health"
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  expectedStatus?: number;    // Alert if response code differs
  bodyContains?: string;      // Alert if body does not contain this string
  intervalSeconds: number;    // e.g. 30
  timeoutMs: number;          // e.g. 5000
  retentionDays: number;      // e.g. 90
}
```

Collected metrics: response time (ms), HTTP status code, boolean success.

**Process Metric Monitor**

```typescript
interface ProcessMonitor {
  type: 'process';
  name: string;               // e.g. "PostgreSQL memory"
  processName: string;        // Exact name or glob
  metric: 'cpu' | 'memory_rss' | 'memory_vsz' | 'threads' | 'fds';
  intervalSeconds: number;
  retentionDays: number;
}
```

**Custom Shell Command Monitor**

```typescript
interface ShellMonitor {
  type: 'shell';
  name: string;               // e.g. "Queue depth"
  command: string;            // Command whose stdout (numeric) is the metric value
  intervalSeconds: number;
  retentionDays: number;
}
```

#### Statistics UI

- Time range selector: **1h / 6h / 24h / 7d / 30d / custom**.
- Zoomable, pannable time-series line chart built with Recharts.
- Multiple monitors can be overlaid in a single chart for comparison.
- Aggregation: raw data for recent ranges; P50 / P95 / P99 percentiles for longer ranges.
- Export button downloads selected range as CSV.

#### Data Rollup

- A `node-cron` job runs hourly: data older than 24 hours is rolled up to 1-minute aggregates (min, max, avg, p95).
- Data older than `retentionDays` is deleted automatically.

---

### 5. User Management

#### Roles

| Role | Capabilities |
|---|---|
| **Admin** | Full access: manage users, configure all alerts and monitors, kill processes, view all data |
| **Operator** | Configure alert rules and monitors, acknowledge alerts, view all dashboards, cannot kill processes or manage users |
| **Viewer** | Read-only access to dashboards and statistics; cannot modify any configuration |

#### Authentication

- Login with username and password; passwords stored as bcrypt hashes (cost factor 12).
- JWT access token (15-minute expiry) + refresh token (7-day expiry, stored as `httpOnly` cookie).
- Optional TOTP-based 2FA via `speakeasy`; QR code provisioning in user settings.
- Password reset via email link (time-limited signed token).

#### Audit Log

Every state-changing action (login, logout, rule created/modified/deleted, process killed, user created/role changed) is written to an `audit_log` table with `user_id`, `action`, `target`, `ip_address`, and `created_at`.

---

## Backend Structure

```
backend/
├── Dockerfile
├── package.json
├── tsconfig.json                 # strict: true, target: ES2022, outDir: dist
├── src/
│   ├── index.ts                  # Express app bootstrap, Socket.io attach
│   ├── config/
│   │   ├── db.ts                 # pg Pool initialisation
│   │   └── env.ts                # Environment variable validation (zod)
│   ├── types/
│   │   ├── process.ts            # ProcessInfo, SystemStats interfaces
│   │   ├── alert.ts              # AlertRule, AlertEvent, NotificationChannel
│   │   ├── monitor.ts            # HttpMonitor, ProcessMonitor, ShellMonitor union
│   │   └── user.ts               # User, Role, JwtPayload
│   ├── api/
│   │   ├── auth.ts               # POST /api/auth/login, /refresh, /logout
│   │   ├── processes.ts          # GET /api/processes (snapshot on demand)
│   │   ├── metrics.ts            # GET /api/metrics/:monitorId?from=&to=
│   │   ├── monitors.ts           # CRUD /api/monitors
│   │   ├── alerts.ts             # CRUD /api/alerts, GET /api/alerts/history
│   │   └── users.ts              # CRUD /api/users (Admin only)
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification middleware
│   │   ├── rbac.ts               # Role-based access control
│   │   └── errorHandler.ts       # Centralised error responses
│   ├── collectors/
│   │   ├── procCollector.ts      # Reads /proc, emits process list
│   │   ├── sysCollector.ts       # CPU, memory, disk, network stats
│   │   └── httpProbe.ts          # HTTP endpoint timing and status check
│   ├── services/
│   │   ├── alertEngine.ts        # Evaluates alert rules each collection cycle
│   │   ├── notifier.ts           # Dispatches email / webhook / in-app alerts
│   │   └── aggregator.ts         # Hourly rollup cron job
│   ├── websocket/
│   │   └── liveStream.ts         # Socket.io event handlers and room management
│   └── db/
│       ├── migrations/           # Numbered SQL migration files
│       └── queries/              # Typed SQL query modules (returning typed rows)
└── dist/                         # Compiled JS output (git-ignored)
```

### tsconfig.json (Backend)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Collector Scheduling

```typescript
// src/index.ts (simplified)
import cron from 'node-cron';
import { procCollector } from './collectors/procCollector';
import { sysCollector } from './collectors/sysCollector';
import { aggregator } from './services/aggregator';

cron.schedule('*/2 * * * * *', (): void => { procCollector.collect(); });  // every 2s
cron.schedule('*/5 * * * * *', (): void => { sysCollector.collect(); });   // every 5s
cron.schedule('0 * * * *',     (): void => { aggregator.rollup(); });      // every hour
```

### WebSocket Events

| Event (Server → Client) | Payload | Description |
|---|---|---|
| `processes` | `Process[]` | Full process list snapshot |
| `system` | `SystemStats` | CPU, memory, disk, network snapshot |
| `alert:fired` | `AlertEvent` | An alert rule was triggered |
| `alert:resolved` | `AlertEvent` | Metric returned below threshold |

| Event (Client → Server) | Payload | Description |
|---|---|---|
| `subscribe:monitor` | `{ monitorId }` | Join a metric monitor room |
| `unsubscribe:monitor` | `{ monitorId }` | Leave a metric monitor room |

---

## Frontend Structure

```
frontend/
├── Dockerfile
├── webpack.config.ts
├── tsconfig.json                 # strict: true, jsx: react-jsx
├── package.json
├── public/
│   └── index.html
└── src/
    ├── index.tsx                 # React DOM root
    ├── App.tsx                   # Router, auth context provider
    ├── types/
    │   ├── api.ts                # Request/response payload types (shared with backend via symlink or package)
    │   └── ui.ts                 # Component prop types, theme types
    ├── api/
    │   ├── client.ts             # Axios instance with JWT interceptor
    │   └── endpoints.ts          # Strongly typed API call functions
    ├── hooks/
    │   ├── useWebSocket.ts       # Socket.io connection with reconnect logic
    │   ├── useProcesses.ts       # Subscribes to live process data
    │   └── useMetrics.ts         # Fetches and caches time-series data
    ├── store/
    │   └── authStore.ts          # Zustand store: user, token, role
    ├── pages/
    │   ├── Dashboard.tsx         # System resource overview
    │   ├── Processes.tsx         # Live process table
    │   ├── Alerts.tsx            # Alert rule configuration and history
    │   ├── Monitors.tsx          # Custom monitor CRUD
    │   ├── Statistics.tsx        # Time-series charts
    │   ├── Users.tsx             # User management (Admin only)
    │   └── Login.tsx             # Authentication form
    └── components/
        ├── ProcessTable/
        │   ├── ProcessTable.tsx  # TanStack Table wrapper
        │   ├── ProcessRow.tsx
        │   └── ProcessDetail.tsx # Drawer with fd, connections, env
        ├── MetricCard/           # Single-stat card with sparkline
        ├── TimeseriesChart/      # Recharts wrapper with zoom and export
        ├── AlertForm/            # Alert rule create / edit form
        ├── MonitorForm/          # Monitor create / edit form
        ├── NotificationCenter/   # Bell dropdown with in-app alerts
        └── Layout/               # Nav, sidebar, breadcrumbs
```

### tsconfig.json (Frontend)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Webpack Configuration Highlights

```typescript
// webpack.config.ts (key settings)
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { Configuration } from 'webpack';

const config: Configuration = {
  entry: './src/index.tsx',
  output: { path: path.resolve(__dirname, 'dist'), filename: '[name].[contenthash].js' },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    new MiniCssExtractPlugin(),
  ],
  // Development: devServer.hot = true (HMR)
  // Production: TerserPlugin applied automatically in mode: 'production'
};

export default config;
```

---

## Database Schema

```sql
-- Users and authentication
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  totp_secret   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom monitor definitions
CREATE TABLE monitors (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('http', 'process', 'shell')),
  config           JSONB NOT NULL,      -- type-specific fields stored as JSON
  interval_seconds INT NOT NULL DEFAULT 60,
  retention_days   INT NOT NULL DEFAULT 90,
  enabled          BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series metric data (range-partitioned by month)
CREATE TABLE metrics (
  id           BIGSERIAL,
  monitor_id   INT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL,
  value        DOUBLE PRECISION NOT NULL,
  labels       JSONB                      -- e.g. {"status_code": 200, "success": true}
) PARTITION BY RANGE (collected_at);

-- Create monthly partitions (automate via cron or pg_partman)
CREATE TABLE metrics_2025_01 PARTITION OF metrics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Alert rule definitions
CREATE TABLE alert_rules (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id),
  name             TEXT NOT NULL,
  process_name     TEXT NOT NULL,
  metric           TEXT NOT NULL,
  operator         TEXT NOT NULL CHECK (operator IN ('>', '<', '=')),
  threshold        DOUBLE PRECISION NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  cooldown_seconds INT NOT NULL DEFAULT 300,
  severity         TEXT NOT NULL DEFAULT 'warning',
  channels         JSONB NOT NULL DEFAULT '[]',
  enabled          BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Alert event history
CREATE TABLE alert_events (
  id             BIGSERIAL PRIMARY KEY,
  rule_id        INT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  fired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  metric_value   DOUBLE PRECISION,
  acknowledged   BOOLEAN DEFAULT FALSE,
  ack_user_id    INT REFERENCES users(id),
  channels_sent  JSONB
);

-- Audit log
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  action     TEXT NOT NULL,
  target     TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Docker Setup

### docker-compose.yml

```yaml
version: '3.9'

services:
  frontend:
    build:
      context: ./frontend
      target: production
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
    ports:
      - "3001:3001"
    volumes:
      - /proc:/host/proc:ro      # Read-only access to host process data
      - /sys:/host/sys:ro        # Read-only access to host sysfs
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://serverpulse:${DB_PASSWORD}@postgres:5432/serverpulse
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - PROC_ROOT=/host/proc     # Backend reads from this path
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./backend/src/db/migrations:/docker-entrypoint-initdb.d:ro
    environment:
      - POSTGRES_DB=serverpulse
      - POSTGRES_USER=serverpulse
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U serverpulse"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pg_data:
```

### Frontend Dockerfile

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend Dockerfile

```dockerfile
# Stage 1: Build TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build        # runs: tsc --project tsconfig.json

# Stage 2: Production image (JS only, no dev deps)
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login with username + password (+ TOTP if enabled) |
| POST | `/api/auth/refresh` | Cookie | Refresh JWT access token |
| POST | `/api/auth/logout` | Yes | Invalidate refresh token |

### Processes

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/processes` | Viewer | Current process list snapshot |
| DELETE | `/api/processes/:pid` | Admin | Send SIGTERM to process |
| DELETE | `/api/processes/:pid?signal=SIGKILL` | Admin | Send SIGKILL to process |

### Monitors

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/monitors` | Viewer | List all monitors |
| POST | `/api/monitors` | Operator | Create monitor |
| PUT | `/api/monitors/:id` | Operator | Update monitor |
| DELETE | `/api/monitors/:id` | Operator | Delete monitor |
| GET | `/api/metrics/:monitorId` | Viewer | Query time-series data (`?from=ISO&to=ISO&agg=raw\|p95`) |

### Alerts

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/alerts` | Viewer | List all alert rules |
| POST | `/api/alerts` | Operator | Create alert rule |
| PUT | `/api/alerts/:id` | Operator | Update alert rule |
| DELETE | `/api/alerts/:id` | Operator | Delete alert rule |
| GET | `/api/alerts/history` | Viewer | Alert event history (`?from=&to=&severity=`) |
| POST | `/api/alerts/history/:id/ack` | Operator | Acknowledge alert event |

### Users (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user role or details |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/audit` | Query audit log |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | ✅ | — | Secret for signing refresh tokens |
| `JWT_EXPIRY` | | `15m` | Access token TTL |
| `REFRESH_EXPIRY` | | `7d` | Refresh token TTL |
| `PROC_ROOT` | | `/proc` | Path to procfs (use `/host/proc` in Docker) |
| `COLLECT_INTERVAL_MS` | | `2000` | Process collection interval in ms |
| `SMTP_HOST` | | — | SMTP server hostname |
| `SMTP_PORT` | | `587` | SMTP port |
| `SMTP_USER` | | — | SMTP username |
| `SMTP_PASS` | | — | SMTP password |
| `SMTP_FROM` | | — | Sender email address |
| `PORT` | | `3001` | Backend HTTP/WS port |
| `LOG_LEVEL` | | `info` | Pino log level |

---

## Development Guide

### Prerequisites

- Docker and Docker Compose v2
- Node.js 20 LTS (for local development outside Docker)

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/serverpulse.git
cd serverpulse

# Copy and configure environment variables
cp .env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# Start all services (builds images on first run)
docker compose up --build

# Application available at:
#   Frontend:  http://localhost
#   API:       http://localhost:3001/api
#   WebSocket: ws://localhost:3001

# Default admin credentials (change immediately):
#   Username: admin
#   Password: changeme
```

### Local Development (without Docker)

```bash
# Start only the database
docker compose up postgres -d

# Backend — compile and watch TypeScript
cd backend
npm install
npm run dev   # ts-node-dev with hot reload (no manual tsc step needed)

# Frontend
cd frontend
npm install
npm start     # webpack-dev-server with ts-loader and HMR on :3000
```

### Database Migrations

Migration files in `backend/src/db/migrations/` are numbered SQL files executed in order. They run automatically on container start via the PostgreSQL init script mount. For manual execution:

```bash
docker compose exec backend node dist/db/migrate.js
```

### TypeScript Dev Dependencies

**Backend `package.json` (devDependencies):**
```json
{
  "typescript": "^5.4.0",
  "ts-node-dev": "^2.0.0",
  "@types/node": "^20.0.0",
  "@types/express": "^4.17.0",
  "@types/pg": "^8.11.0",
  "@types/bcryptjs": "^2.4.0",
  "@types/jsonwebtoken": "^9.0.0",
  "@types/nodemailer": "^6.4.0",
  "@types/node-cron": "^3.0.0",
  "@types/speakeasy": "^2.0.0",
  "jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "@types/jest": "^29.0.0"
}
```

**Frontend `package.json` (devDependencies):**
```json
{
  "typescript": "^5.4.0",
  "ts-loader": "^9.5.0",
  "webpack": "^5.91.0",
  "webpack-cli": "^5.1.0",
  "webpack-dev-server": "^5.0.0",
  "ts-node": "^10.9.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "html-webpack-plugin": "^5.6.0",
  "mini-css-extract-plugin": "^2.9.0",
  "@types/jest": "^29.0.0"
}
```

### Running Tests

```bash
# Type-check both workspaces (no emit)
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Backend unit and integration tests (Jest + ts-jest)
cd backend && npm test

# Frontend component tests (React Testing Library + ts-jest)
cd frontend && npm test

# End-to-end tests (Playwright — fully typed)
npm run test:e2e
```

---

*ServerPulse — built for operators who need visibility, not just logs.*