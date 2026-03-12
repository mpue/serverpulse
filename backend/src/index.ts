import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { setupLiveStream } from './websocket/liveStream';

import authRouter from './api/auth';
import processesRouter from './api/processes';
import metricsRouter from './api/metrics';
import monitorsRouter from './api/monitors';
import alertsRouter from './api/alerts';
import usersRouter from './api/users';
import setupRouter from './api/setup';
import healthRouter from './api/health';
import layoutsRouter from './api/dashboardLayouts';
import serversRouter from './api/servers';
import maintenanceRouter from './api/maintenanceWindows';
import reportsRouter from './api/reports';
import alertCommentsRouter from './api/alertComments';
import webhooksRouter from './api/webhooks';
import settingsRouter from './api/settings';
import { setupGuard } from './middleware/setupGuard';

import { collect as collectProcesses } from './collectors/procCollector';
import { collect as collectSystem } from './collectors/sysCollector';
import { evaluate as evaluateAlerts } from './services/alertEngine';
import { rollup } from './services/aggregator';

const app = express();
const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiter — 300 requests per minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json());
app.use(cookieParser());

// Setup guard — blocks all routes (except /api/setup, /api/health) until initial admin exists
app.use(setupGuard);

// API routes
app.use('/api/setup', setupRouter);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/processes', processesRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/users', usersRouter);
app.use('/api/layouts', layoutsRouter);
app.use('/api/servers', serversRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/alert-comments', alertCommentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/settings', settingsRouter);

// Error handler
app.use(errorHandler);

// WebSocket
setupLiveStream(io);

// Collector scheduling
cron.schedule('*/2 * * * * *', () => {
  const processes = collectProcesses();
  io.emit('processes', processes);
  evaluateAlerts(processes, io).catch(err => console.error('Alert evaluation error:', err));
});

cron.schedule('*/5 * * * * *', () => {
  const system = collectSystem();
  io.emit('system', system);
});

cron.schedule('0 * * * *', () => {
  rollup().catch(err => console.error('Rollup error:', err));
});

// Start server
server.listen(env.PORT, () => {
  console.log(`ServerPulse backend running on port ${env.PORT}`);
});
