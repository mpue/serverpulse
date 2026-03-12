# ServerPulse — Erweiterungen & Roadmap

## Übersicht

Dieses Dokument beschreibt geplante Erweiterungen für ServerPulse, gegliedert nach Priorität. Jede Erweiterung enthält eine fachliche Beschreibung, technische Spezifikation und Hinweise zur Implementierung.

---

## Table of Contents

1. [Setup-Wizard (Ersteinrichtung)](#1-setup-wizard-ersteinrichtung)
2. [Health-Check-Endpoint](#2-health-check-endpoint)
3. [Dark Mode](#3-dark-mode)
4. [Dashboard-Layouts speichern](#4-dashboard-layouts-speichern)
5. [Multi-Server-Support](#5-multi-server-support)
6. [Anomalie-Erkennung](#6-anomalie-erkennung)
7. [Geplante Wartungsfenster](#7-geplante-wartungsfenster)
8. [Report-Export](#8-report-export)
9. [Mobile-optimierte Ansicht](#9-mobile-optimierte-ansicht)
10. [Kommentare auf Alert-Events](#10-kommentare-auf-alert-events)
11. [Webhook-Empfänger](#11-webhook-empfänger)

---

## 1. Setup-Wizard (Ersteinrichtung)

**Priorität: Hoch — Sicherheitsrelevant**

### Problem

Die aktuelle Spezifikation sieht einen hartkodierten Default-Admin-Account (`admin` / `changeme`) vor. In der Praxis werden solche Defaults häufig nicht geändert und stellen ein klassisches Einfallstor dar.

### Lösung

Beim ersten Start erkennt die App, dass noch kein Admin-Account existiert, und leitet automatisch auf einen **Setup-Wizard** weiter. Alle anderen Routen sind bis zum Abschluss des Wizards gesperrt.

### Wizard-Schritte

**Schritt 1 — Admin-Account anlegen**
- Benutzername (min. 4 Zeichen)
- E-Mail-Adresse
- Passwort (Validierung nach Passwort-Policy aus Security-Dokument)
- Passwort-Bestätigung

**Schritt 2 — Basis-Konfiguration**
- Applikationsname (wird im UI-Header angezeigt)
- Zeitzone
- SMTP-Konfiguration (optional, kann später nachgetragen werden)
- Test-E-Mail senden

**Schritt 3 — Abschluss**
- Zusammenfassung der Einstellungen
- Hinweis auf 2FA-Aktivierung in den User-Settings
- Weiterleitung zum Dashboard

### Backend-Implementierung

```typescript
// backend/src/middleware/setupGuard.ts
// Middleware die alle Requests blockiert solange kein Admin existiert

export const setupGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Wizard-Route selbst immer durchlassen
  if (req.path.startsWith('/api/setup')) {
    next();
    return;
  }

  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*) FROM users WHERE role = 'admin'"
  );

  if (parseInt(result.rows[0].count, 10) === 0) {
    res.status(503).json({
      error: 'Application not configured.',
      setupRequired: true,
    });
    return;
  }

  next();
};
```

```typescript
// backend/src/api/setup.ts
// Einmaliger Endpoint — nur aufrufbar wenn noch kein Admin existiert

router.post('/api/setup', async (req, res) => {
  const adminCount = await pool.query(
    "SELECT COUNT(*) FROM users WHERE role = 'admin'"
  );
  if (parseInt(adminCount.rows[0].count, 10) > 0) {
    return res.status(403).json({ error: 'Setup already completed.' });
  }
  // Admin anlegen, Settings persistieren...
});
```

### Datenbankergänzung

```sql
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beispieleinträge nach Setup-Abschluss:
-- ('app_name', 'ServerPulse')
-- ('timezone', 'Europe/Berlin')
-- ('setup_completed', 'true')
-- ('smtp_host', 'smtp.example.com')
```

---

## 2. Health-Check-Endpoint

**Priorität: Hoch**

### Problem

Docker, Load Balancer, Kubernetes und externe Uptime-Monitoring-Tools brauchen einen dedizierten Endpoint um festzustellen, ob die Applikation betriebsbereit ist. Ohne diesen kann ein Container als "running" gelten, obwohl die Datenbankverbindung unterbrochen ist.

### Lösung

Ein öffentlicher (kein JWT erforderlich) `/api/health`-Endpoint der alle kritischen Subsysteme prüft und einen strukturierten Status zurückgibt.

### Response-Format

```typescript
// GET /api/health
// HTTP 200 wenn alle Checks grün, HTTP 503 wenn mindestens einer rot

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;           // App-Version aus package.json
  uptime: number;            // Sekunden seit Prozessstart
  timestamp: string;         // ISO 8601
  checks: {
    database: CheckResult;
    procfs: CheckResult;     // Kann /proc lesen?
    diskSpace: CheckResult;  // Genug Platz für Logs/Metrics?
  };
}

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  message?: string;
}
```

```typescript
// Beispiel-Response bei vollem Betrieb:
{
  "status": "ok",
  "version": "1.2.0",
  "uptime": 86400,
  "timestamp": "2025-03-12T10:00:00Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 3 },
    "procfs":   { "status": "ok" },
    "diskSpace": { "status": "ok", "message": "23% used" }
  }
}
```

### Docker Compose Integration

```yaml
backend:
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 10s
```

---

## 3. Dark Mode

**Priorität: Hoch**

### Problem

ServerPulse wird häufig nachts bei Incidents geöffnet. Ein helles Interface ist in dunkler Umgebung belastend und erschwert die schnelle Orientierung.

### Lösung

Vollständiger Dark Mode mit drei Modi: **Light**, **Dark**, **System** (folgt dem Betriebssystem). Die Präferenz wird pro Benutzer in der Datenbank gespeichert und ist damit geräteübergreifend konsistent.

### Implementierung

```typescript
// frontend/src/store/themeStore.ts
import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'system',
  effectiveTheme: window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light',
  setMode: (mode) => {
    const effective = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.setAttribute('data-theme', effective);
    set({ mode, effectiveTheme: effective });
  },
}));
```

```css
/* CSS Custom Properties für beide Themes */
:root[data-theme="light"] {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f5f5f5;
  --text-primary:  #1a1a1a;
  --text-secondary:#6b7280;
  --border:        #e5e7eb;
  --accent:        #2563eb;
  --danger:        #dc2626;
  --warning:       #d97706;
  --success:       #16a34a;
}

:root[data-theme="dark"] {
  --bg-primary:    #0f172a;
  --bg-secondary:  #1e293b;
  --text-primary:  #f1f5f9;
  --text-secondary:#94a3b8;
  --border:        #334155;
  --accent:        #3b82f6;
  --danger:        #ef4444;
  --warning:       #f59e0b;
  --success:       #22c55e;
}
```

### Datenbankergänzung

```sql
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));
```

---

## 4. Dashboard-Layouts speichern

**Priorität: Mittel**

### Problem

Verschiedene Benutzer haben unterschiedliche Bedürfnisse — ein DBA interessiert sich primär für Datenbankprozesse und Disk-I/O, ein Entwickler für seine Applikationsprozesse und HTTP-Latenzen. Aktuell sieht jeder dasselbe statische Dashboard.

### Lösung

Benutzer können das Dashboard-Layout frei konfigurieren: Widgets hinzufügen, entfernen, verschieben und in der Größe anpassen. Layouts werden pro Benutzer in der Datenbank gespeichert. Mehrere benannte Layouts sind möglich (z.B. "Übersicht", "Datenbank", "Incident").

### Widget-Typen

| Widget | Beschreibung |
|---|---|
| `cpu-gauge` | Aktuelle CPU-Auslastung als Gauge-Chart |
| `memory-donut` | RAM-Nutzung als Donut-Chart |
| `disk-bars` | Festplattenauslastung aller Partitionen |
| `network-chart` | Netzwerkdurchsatz als Zeitreihe |
| `process-table` | Gefilterte Prozesstabelle (konfigurierbarer Filter) |
| `metric-chart` | Zeitreihe eines benutzerdefinierten Monitors |
| `alert-feed` | Live-Feed der letzten Alert-Events |
| `top-processes` | Top-N Prozesse nach CPU oder RAM |

### Datenbankschema

```sql
CREATE TABLE dashboard_layouts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  layout     JSONB NOT NULL,   -- Array von Widget-Konfigurationen
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
// Layout-JSON Struktur
interface DashboardLayout {
  widgets: WidgetConfig[];
}

interface WidgetConfig {
  id: string;
  type: WidgetType;
  gridX: number;       // Spalte im 12-Spalten-Grid
  gridY: number;       // Zeile
  gridW: number;       // Breite in Spalten (1–12)
  gridH: number;       // Höhe in Zeilen
  config: Record<string, unknown>;  // Widget-spezifische Einstellungen
}
```

---

## 5. Multi-Server-Support

**Priorität: Hoch — Größter Mehrwert**

### Problem

Die aktuelle Architektur monitort ausschließlich den Host, auf dem der Docker-Stack läuft. In der Praxis betreibt man selten nur einen Server.

### Lösung

Eine **Agent-Architektur**: Auf jedem zu überwachenden Server läuft ein leichtgewichtiger **ServerPulse Agent** (eigenständiger Node.js-Prozess). Dieser sammelt Metriken lokal und sendet sie per WebSocket oder HTTP an die zentrale **ServerPulse Hub**-Instanz. Das Hub-Dashboard zeigt alle Server in einer einheitlichen Oberfläche.

### Architektur

```
┌─────────────────────────────────────────────────┐
│              ServerPulse Hub                     │
│   (React Frontend + Express Backend + PostgreSQL)│
└────────────────────┬────────────────────────────┘
                     │ WebSocket (TLS)
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌──────▼───┐  ┌───▼──────┐
│ Agent    │  │ Agent    │  │ Agent    │
│ Server A │  │ Server B │  │ Server C │
│ :9090    │  │ :9090    │  │ :9090    │
└──────────┘  └──────────┘  └──────────┘
```

### Agent-Spezifikation

Der Agent ist ein minimaler, eigenständiger TypeScript-Prozess ohne eigene Datenbank:

```typescript
// agent/src/index.ts
import { io } from 'socket.io-client';
import { procCollector } from './collectors/procCollector';
import { sysCollector } from './collectors/sysCollector';

const socket = io(process.env.HUB_URL!, {
  auth: { agentToken: process.env.AGENT_TOKEN },
  reconnection: true,
  reconnectionDelay: 5000,
});

socket.on('connect', () => {
  console.log(`Connected to Hub: ${process.env.HUB_URL}`);
});

setInterval(async () => {
  const [processes, system] = await Promise.all([
    procCollector.collect(),
    sysCollector.collect(),
  ]);
  socket.emit('agent:metrics', { processes, system });
}, 2000);
```

### Agent-Registrierung

Neuer Agent-Registrierungs-Flow im Hub:

1. Admin öffnet **Settings → Servers → Add Server**
2. Hub generiert einen einmaligen **Agent-Token** (kryptografisch zufällig, 32 Byte)
3. Admin kopiert den angezeigten Docker-Befehl auf den Zielserver:

```bash
docker run -d \
  --name serverpulse-agent \
  --pid=host \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -e HUB_URL=wss://monitor.example.com \
  -e AGENT_TOKEN=<generated-token> \
  -e SERVER_NAME="Production DB" \
  ghcr.io/your-org/serverpulse-agent:latest
```

4. Agent verbindet sich mit Hub, Token wird einmalig validiert und gegen eine dauerhafte Agent-ID ausgetauscht.

### Datenbankergänzung

```sql
CREATE TABLE servers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  agent_token  TEXT NOT NULL UNIQUE,   -- bcrypt-gehashter Token
  last_seen_at TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'online', 'offline')),
  metadata     JSONB,                  -- OS, Hostname, CPU-Kerne etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Metriken bekommen eine server_id Spalte
ALTER TABLE metrics ADD COLUMN server_id INT REFERENCES servers(id);
ALTER TABLE alert_rules ADD COLUMN server_id INT REFERENCES servers(id);
```

---

## 6. Anomalie-Erkennung

**Priorität: Mittel**

### Problem

Statische Schwellwerte (z.B. "CPU > 80%") sind unflexibel. Ein Batch-Job der regulär 90% CPU verwendet löst ständig False-Positive-Alerts aus. Gleichzeitig wird ein Prozess der normalerweise 5% CPU nutzt und plötzlich auf 40% springt nicht bemerkt.

### Lösung

Zusätzlich zu statischen Alert-Regeln bietet ServerPulse eine **dynamische Anomalie-Erkennung** auf Basis eines gleitenden Durchschnitts mit Standardabweichung (Z-Score-Methode).

### Algorithmus

```typescript
// backend/src/services/anomalyDetector.ts

interface AnomalyConfig {
  monitorId: number;
  windowMinutes: number;   // Betrachtungszeitraum für Baseline (z.B. 60 Minuten)
  zScoreThreshold: number; // Ab welchem Z-Score ein Alert ausgelöst wird (z.B. 3.0)
  minDataPoints: number;   // Mindestanzahl Messpunkte bevor Erkennung aktiv wird
}

export async function detectAnomaly(
  value: number,
  config: AnomalyConfig
): Promise<{ isAnomaly: boolean; zScore: number; mean: number; stdDev: number }> {
  const since = new Date(Date.now() - config.windowMinutes * 60 * 1000);

  const result = await pool.query<{ avg: string; stddev: string; count: string }>(
    `SELECT AVG(value) as avg, STDDEV(value) as stddev, COUNT(*) as count
     FROM metrics
     WHERE monitor_id = $1 AND collected_at >= $2`,
    [config.monitorId, since]
  );

  const { avg, stddev, count } = result.rows[0];
  const mean = parseFloat(avg);
  const std = parseFloat(stddev) || 1;  // Verhindert Division durch 0

  if (parseInt(count, 10) < config.minDataPoints) {
    return { isAnomaly: false, zScore: 0, mean, stdDev: std };
  }

  const zScore = Math.abs((value - mean) / std);
  return {
    isAnomaly: zScore >= config.zScoreThreshold,
    zScore,
    mean,
    stdDev: std,
  };
}
```

### UI-Integration

- Anomalie-Alerts werden im Alert-Feed mit einem eigenen Icon (⚡) von statischen Schwellwert-Alerts unterschieden.
- In Zeitreihen-Charts werden Anomalie-Punkte farblich hervorgehoben.
- Pro Monitor kann die Anomalie-Erkennung separat aktiviert und konfiguriert werden.

---

## 7. Geplante Wartungsfenster

**Priorität: Mittel**

### Problem

Während geplanter Deployments, Backups oder Wartungsarbeiten lösen reguläre Alerts unnötigen Lärm aus. Operatoren müssen Alert-Regeln manuell deaktivieren und vergessen sie danach wieder zu aktivieren.

### Lösung

Wartungsfenster (Maintenance Windows) definieren Zeiträume, in denen Alerts für bestimmte Server oder Prozesse automatisch stummgeschaltet werden. Nach Ablauf des Fensters werden Alerts automatisch wieder aktiv.

### Datenmodell

```sql
CREATE TABLE maintenance_windows (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  server_id    INT REFERENCES servers(id),   -- NULL = alle Server
  process_name TEXT,                          -- NULL = alle Prozesse
  created_by   INT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Alert-Engine-Integration

```typescript
// backend/src/services/alertEngine.ts

async function isInMaintenanceWindow(
  serverId: number,
  processName: string
): Promise<boolean> {
  const now = new Date();
  const result = await pool.query(
    `SELECT id FROM maintenance_windows
     WHERE starts_at <= $1 AND ends_at >= $1
       AND (server_id IS NULL OR server_id = $2)
       AND (process_name IS NULL OR process_name = $3)
     LIMIT 1`,
    [now, serverId, processName]
  );
  return result.rowCount! > 0;
}
```

### UI-Features

- Kalenderansicht aller geplanten Wartungsfenster.
- Wiederkehrende Fenster (z.B. jeden Sonntag 02:00–04:00 für Backups).
- Aktive Wartungsfenster werden im Dashboard als gelbes Banner angezeigt.
- Alerts die während eines Wartungsfensters gefeuert wurden, werden in der History mit "suppressed" markiert.

---

## 8. Report-Export

**Priorität: Mittel**

### Problem

Management und Kunden wollen regelmäßige Berichte über Systemauslastung, Verfügbarkeit und Performance — ohne selbst ins Dashboard zu schauen.

### Lösung

Automatisch generierte Berichte als **PDF oder CSV**, die manuell heruntergeladen oder per E-Mail versendet werden können.

### Berichtstypen

| Typ | Inhalt | Format |
|---|---|---|
| **Wochenbericht** | CPU/RAM/Disk-Durchschnitte, Top-5-Alert-Regeln, Uptime je Server | PDF |
| **Metriken-Export** | Rohdaten oder Aggregate eines Monitors für einen Zeitraum | CSV |
| **Alert-History** | Alle Alert-Events eines Zeitraums mit Severity und Dauer | PDF / CSV |
| **Kapazitätsplanung** | Trend-Analyse: Wann werden Ressourcen knapp? | PDF |

### Geplante Zustellung

```sql
CREATE TABLE report_schedules (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  config        JSONB NOT NULL,      -- Zeitraum, Filter, Format
  cron_expr     TEXT NOT NULL,       -- z.B. '0 8 * * 1' = Montags 08:00
  recipients    TEXT[] NOT NULL,     -- E-Mail-Adressen
  enabled       BOOLEAN DEFAULT TRUE,
  last_sent_at  TIMESTAMPTZ,
  created_by    INT REFERENCES users(id)
);
```

### PDF-Generierung

PDF-Reports werden serverseitig mit **Puppeteer** oder **pdfmake** erzeugt. Ein dedizierter Report-Renderer rendert eine HTML-Vorlage mit den Daten und konvertiert sie zu PDF.

---

## 9. Mobile-optimierte Ansicht

**Priorität: Mittel**

### Problem

Beim Empfang eines Alerts auf dem Handy muss der Operator schnell den Status einsehen und ggf. eingreifen können. Das bestehende Desktop-Dashboard ist auf kleinen Bildschirmen nicht nutzbar.

### Lösung

Eine dedizierte **Mobile View** die automatisch ab einer Viewport-Breite von < 768px aktiviert wird. Sie zeigt eine vereinfachte, touch-optimierte Darstellung der wichtigsten Informationen.

### Mobile-spezifische Komponenten

- **Status-Übersicht** — ein einziger Screen mit Ampel-Status (grün/gelb/rot) je Server.
- **Alert-Feed** — chronologische Liste aktueller Alerts mit Swipe-to-Acknowledge.
- **Quick Stats** — CPU, RAM und Disk als große, gut lesbare Zahlen.
- **Prozess-Suche** — Suchfeld das direkt einen Prozess nach Name findet, ohne die volle Tabelle zu laden.

### Progressive Web App (PWA)

Für den mobilen Einsatz wird ServerPulse als PWA konfiguriert:

```json
// public/manifest.json
{
  "name": "ServerPulse",
  "short_name": "Pulse",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "display": "standalone",
  "start_url": "/mobile",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Dies erlaubt es, ServerPulse als App auf dem Homescreen zu installieren und Push-Benachrichtigungen für Alerts zu empfangen.

---

## 10. Kommentare auf Alert-Events

**Priorität: Niedrig–Mittel**

### Problem

Wenn ein Operator einen Alert acknowledget, geht der Kontext verloren — warum ist der Alert aufgetreten, wer hat was getan, wie wurde es behoben? Die Alert-History ist dadurch als Wissensbasis wertlos.

### Lösung

Beim Acknowledgen kann (und sollte) ein **Kommentar** hinterlassen werden. Weitere Kommentare können nachträglich hinzugefügt werden, sodass ein vollständiges Incident-Protokoll entsteht.

### Datenmodell

```sql
CREATE TABLE alert_comments (
  id             SERIAL PRIMARY KEY,
  alert_event_id BIGINT NOT NULL REFERENCES alert_events(id) ON DELETE CASCADE,
  user_id        INT NOT NULL REFERENCES users(id),
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### UI

- Kommentar-Thread unterhalb jedes Alert-Events in der History-Ansicht.
- Beim Acknowledge-Dialog ist ein Kommentarfeld vorausgefüllt mit dem Platzhalter "Beschreibe die Ursache und die durchgeführten Maßnahmen…".
- Kommentare werden im wöchentlichen PDF-Report mit eingebettet.

---

## 11. Webhook-Empfänger

**Priorität: Niedrig–Mittel**

### Problem

Externe Systeme (CI/CD-Pipelines, Deployment-Tools, Ticket-Systeme) haben keinen Weg, ServerPulse über bevorstehende Ereignisse zu informieren. Deployments lösen z.B. Ressourcenspitzen aus, die ohne Kontext wie Anomalien aussehen.

### Lösung

ServerPulse stellt **eingehende Webhooks** bereit. Externe Systeme können Events senden, die im Dashboard sichtbar sind und optional Alert-Regeln temporär stummschalten.

### Endpoint

```
POST /api/webhooks/ingest/:webhookId
Authorization: Bearer <webhook-secret>
```

```typescript
// Payload-Format
interface InboundWebhookPayload {
  event: 'deployment.started' | 'deployment.finished' | 'maintenance.start'
       | 'maintenance.end' | 'custom';
  title: string;               // z.B. "Deploy v2.3.1 → production"
  description?: string;
  severity?: 'info' | 'warning';
  suppressAlertsMinutes?: number;  // Optional: Alerts für N Minuten stummschalten
  metadata?: Record<string, string>;
}
```

### UI-Integration

- Eingehende Events erscheinen als vertikale Markierungslinien in Zeitreihen-Charts — so sieht man sofort, ob eine Metrik-Anomalie zeitlich mit einem Deployment zusammenfällt.
- Eine eigene **Events-Timeline** zeigt alle eingehenden Webhook-Events chronologisch.
- Webhook-URLs werden pro Integration im Admin-Bereich generiert und können individuell widerrufen werden.

---

*ServerPulse Roadmap — Stand März 2026. Prioritäten können sich je nach Nutzerfeedback verschieben.*
