import crypto from 'crypto';
import { Server as IOServer, Namespace, Socket } from 'socket.io';
import { pool } from '../config/db';
import { decryptSecret } from '../config/crypto';

const CHALLENGE_TIMEOUT_MS = 10_000;

export function setupAgentHub(io: IOServer): void {
  const agentNs: Namespace = io.of('/agent');

  agentNs.on('connection', (socket: Socket) => {
    let authenticated = false;
    let serverId: number | null = null;
    const remoteIp = socket.handshake.address;

    // Step 1: Agent sends its server ID to initiate auth
    socket.on('auth:init', async (data: { serverId: number }) => {
      if (authenticated) return;

      try {
        const { rows } = await pool.query(
          'SELECT id, agent_token_enc, token_iv, token_auth_tag, allowed_ip FROM servers WHERE id = $1',
          [data.serverId],
        );

        if (rows.length === 0) {
          socket.emit('auth:error', { error: 'Server not found' });
          socket.disconnect(true);
          return;
        }

        const server = rows[0];

        // Check IP binding if configured
        if (server.allowed_ip) {
          // Extract IP without port — handle IPv6-mapped IPv4
          const cleanIp = remoteIp.replace(/^::ffff:/, '');
          const allowedClean = server.allowed_ip.replace(/\/\d+$/, '');
          if (cleanIp !== allowedClean) {
            socket.emit('auth:error', { error: 'Connection not allowed from this IP' });
            socket.disconnect(true);
            return;
          }
        }

        if (!server.agent_token_enc || !server.token_iv || !server.token_auth_tag) {
          socket.emit('auth:error', { error: 'Server has no configured token' });
          socket.disconnect(true);
          return;
        }

        // Step 2: Generate challenge and send to agent
        const challenge = crypto.randomBytes(32).toString('hex');

        // Store challenge temporarily on socket data
        (socket as any)._challengeData = {
          challenge,
          serverId: data.serverId,
          tokenEnc: server.agent_token_enc,
          tokenIv: server.token_iv,
          tokenAuthTag: server.token_auth_tag,
        };

        socket.emit('auth:challenge', { challenge });

        // Timeout: disconnect if no response within 10s
        setTimeout(() => {
          if (!authenticated) {
            socket.emit('auth:error', { error: 'Challenge timeout' });
            socket.disconnect(true);
          }
        }, CHALLENGE_TIMEOUT_MS);
      } catch (err) {
        console.error('Agent auth:init error:', err);
        socket.emit('auth:error', { error: 'Internal error' });
        socket.disconnect(true);
      }
    });

    // Step 3: Agent sends HMAC response
    socket.on('auth:response', async (data: { hmac: string }) => {
      if (authenticated) return;

      const challengeData = (socket as any)._challengeData;
      if (!challengeData) {
        socket.emit('auth:error', { error: 'No pending challenge' });
        socket.disconnect(true);
        return;
      }

      try {
        // Decrypt the stored secret
        const secret = decryptSecret(
          challengeData.tokenEnc,
          challengeData.tokenIv,
          challengeData.tokenAuthTag,
        );

        // Compute expected HMAC
        const expectedHmac = crypto
          .createHmac('sha256', secret)
          .update(challengeData.challenge)
          .digest('hex');

        // Constant-time comparison
        const expected = Buffer.from(expectedHmac, 'hex');
        const received = Buffer.from(data.hmac, 'hex');

        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
          socket.emit('auth:error', { error: 'Authentication failed' });
          socket.disconnect(true);
          return;
        }

        // Authenticated!
        authenticated = true;
        serverId = challengeData.serverId;
        delete (socket as any)._challengeData;

        // Mark server as online
        await pool.query(
          "UPDATE servers SET status = 'online', last_seen_at = NOW() WHERE id = $1",
          [serverId],
        );

        socket.join(`server:${serverId}`);
        socket.emit('auth:success', { message: 'Authenticated' });
        console.log(`Agent authenticated: server ${serverId} from ${remoteIp}`);
      } catch (err) {
        console.error('Agent auth:response error:', err);
        socket.emit('auth:error', { error: 'Authentication failed' });
        socket.disconnect(true);
      }
    });

    // Receive metrics from authenticated agent
    socket.on('agent:metrics', async (data: { metrics: Record<string, unknown> }) => {
      if (!authenticated || serverId === null) {
        socket.emit('auth:error', { error: 'Not authenticated' });
        return;
      }

      try {
        // Update last_seen
        await pool.query(
          "UPDATE servers SET last_seen_at = NOW(), status = 'online' WHERE id = $1",
          [serverId],
        );

        // Broadcast to frontend clients watching this server
        io.of('/').to(`server:${serverId}`).emit('server:metrics', {
          serverId,
          ...data.metrics,
        });
      } catch (err) {
        console.error('Agent metrics error:', err);
      }
    });

    // Receive process list from authenticated agent
    socket.on('agent:processes', async (data: { processes: unknown[] }) => {
      if (!authenticated || serverId === null) return;

      try {
        await pool.query(
          "UPDATE servers SET last_seen_at = NOW(), status = 'online' WHERE id = $1",
          [serverId],
        );

        io.of('/').to(`server:${serverId}`).emit('server:processes', {
          serverId,
          processes: data.processes,
        });
      } catch (err) {
        console.error('Agent processes error:', err);
      }
    });

    socket.on('disconnect', async () => {
      if (serverId) {
        await pool.query(
          "UPDATE servers SET status = 'offline' WHERE id = $1",
          [serverId],
        ).catch(() => {});
        console.log(`Agent disconnected: server ${serverId}`);
      }
    });
  });
}
