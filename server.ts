import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Global System State
interface TabletClient {
  id: string;
  name: string;
  ws: WebSocket;
  ip: string;
  connectedAt: number;
  lastPing: number;
}

interface RobotState {
  connected: boolean;
  ip?: string;
  batteryPercent: number;
  cpuTemp: number;
  lastHeartbeat: number;
  lastCommand: { left: number; right: number; timestamp: number };
}

interface ShellyState {
  ip: string;
  enabled: boolean;
  isOn: boolean;
  reachable: boolean;
  lastCheck: number;
  name: string;
}

interface QueueState {
  activePilotId: string | null;
  activePilotName: string | null;
  timeRemainingSec: number;
  slotDurationSec: number;
  maxSpeedPercent: number; // 40, 75, 100%
  safeMode: boolean;
  queue: Array<{ id: string; name: string; joinedAt: number }>;
}

const clients = new Map<string, TabletClient>();
let robotWs: WebSocket | null = null;

const robotState: RobotState = {
  connected: false,
  batteryPercent: 88,
  cpuTemp: 44.5,
  lastHeartbeat: 0,
  lastCommand: { left: 0, right: 0, timestamp: 0 },
};

const shellyConfig: ShellyState = {
  ip: '192.168.1.50',
  enabled: true,
  isOn: false,
  reachable: false,
  lastCheck: 0,
  name: 'Lampada Banco Fermi #1',
};

const queueState: QueueState = {
  activePilotId: null,
  activePilotName: null,
  timeRemainingSec: 45,
  slotDurationSec: 45,
  maxSpeedPercent: 75,
  safeMode: true,
  queue: [],
};

// Polling Shelly status
async function pollShellyStatus() {
  if (!shellyConfig.enabled || !shellyConfig.ip) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`http://${shellyConfig.ip}/relay/0`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as { ison?: boolean };
      shellyConfig.reachable = true;
      shellyConfig.isOn = Boolean(data.ison);
      shellyConfig.lastCheck = Date.now();
    } else {
      shellyConfig.reachable = false;
    }
  } catch {
    shellyConfig.reachable = false;
  }
}

// Check Shelly periodically
setInterval(() => {
  pollShellyStatus();
}, 4000);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  app.use(express.json());

  // Broadcast helper
  function broadcast(event: string, payload: unknown, excludeWs?: WebSocket) {
    const message = JSON.stringify({ event, payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function getFullBroadcastState() {
    return {
      queueState: {
        activePilotId: queueState.activePilotId,
        activePilotName: queueState.activePilotName,
        timeRemainingSec: queueState.timeRemainingSec,
        slotDurationSec: queueState.slotDurationSec,
        maxSpeedPercent: queueState.maxSpeedPercent,
        safeMode: queueState.safeMode,
        queue: queueState.queue.map((q) => ({ id: q.id, name: q.name })),
      },
      robotState: {
        connected: robotState.connected,
        batteryPercent: robotState.batteryPercent,
        cpuTemp: robotState.cpuTemp,
        ip: robotState.ip,
        lastCommand: robotState.lastCommand,
      },
      shellyState: {
        ip: shellyConfig.ip,
        isOn: shellyConfig.isOn,
        reachable: shellyConfig.reachable,
        name: shellyConfig.name,
      },
      connectedTabletsCount: clients.size,
    };
  }

  // Turn rotation logic
  function nextTurn() {
    // Stop robot immediately
    robotState.lastCommand = { left: 0, right: 0, timestamp: Date.now() };
    if (robotWs && robotWs.readyState === WebSocket.OPEN) {
      robotWs.send(JSON.stringify({ type: 'drive', left: 0, right: 0, reason: 'turn_ended' }));
    }

    if (queueState.queue.length > 0) {
      const nextUser = queueState.queue.shift()!;
      queueState.activePilotId = nextUser.id;
      queueState.activePilotName = nextUser.name;
      queueState.timeRemainingSec = queueState.slotDurationSec;
    } else {
      queueState.activePilotId = null;
      queueState.activePilotName = null;
      queueState.timeRemainingSec = queueState.slotDurationSec;
    }
    broadcast('state:update', getFullBroadcastState());
  }

  // Countdown timer loop
  setInterval(() => {
    if (queueState.activePilotId) {
      queueState.timeRemainingSec -= 1;
      if (queueState.timeRemainingSec <= 0) {
        nextTurn();
      } else {
        broadcast('timer:tick', {
          timeRemainingSec: queueState.timeRemainingSec,
          activePilotId: queueState.activePilotId,
        });
      }
    }
  }, 1000);

  // REST API Endpoints
  app.get('/api/status', (_req, res) => {
    res.json(getFullBroadcastState());
  });

  // Shelly Toggle Endpoint
  app.post('/api/shelly/toggle', async (_req, res) => {
    const newState = !shellyConfig.isOn;
    shellyConfig.isOn = newState; // optimistic update

    if (shellyConfig.ip) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        await fetch(`http://${shellyConfig.ip}/relay/0?turn=${newState ? 'on' : 'off'}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        shellyConfig.reachable = true;
      } catch {
        // In local/test mode or offline, keep optimistic state for demo
      }
    }

    broadcast('shelly:update', {
      isOn: shellyConfig.isOn,
      reachable: shellyConfig.reachable,
      ip: shellyConfig.ip,
    });

    res.json({ success: true, isOn: shellyConfig.isOn, reachable: shellyConfig.reachable });
  });

  // Admin / Supervisor Update Config
  app.post('/api/admin/config', (req, res) => {
    const { pin, shellyIp, slotDurationSec, maxSpeedPercent, safeMode, robotIp } = req.body;
    if (pin !== 'fermi' && pin !== 'FERMI2025' && pin !== '1234') {
      res.status(403).json({ error: 'PIN non valido' });
      return;
    }

    if (typeof shellyIp === 'string') shellyConfig.ip = shellyIp.trim();
    if (typeof slotDurationSec === 'number' && slotDurationSec >= 15 && slotDurationSec <= 180) {
      queueState.slotDurationSec = slotDurationSec;
    }
    if (typeof maxSpeedPercent === 'number' && [40, 75, 100].includes(maxSpeedPercent)) {
      queueState.maxSpeedPercent = maxSpeedPercent;
    }
    if (typeof safeMode === 'boolean') {
      queueState.safeMode = safeMode;
    }
    if (typeof robotIp === 'string' && robotIp) {
      robotState.ip = robotIp.trim();
    }

    broadcast('state:update', getFullBroadcastState());
    res.json({ success: true, updated: true });
  });

  // Emergency stop or skip turn
  app.post('/api/admin/emergency-stop', (req, res) => {
    const { pin } = req.body;
    if (pin !== 'fermi' && pin !== 'FERMI2025' && pin !== '1234') {
      res.status(403).json({ error: 'PIN non valido' });
      return;
    }
    robotState.lastCommand = { left: 0, right: 0, timestamp: Date.now() };
    if (robotWs && robotWs.readyState === WebSocket.OPEN) {
      robotWs.send(JSON.stringify({ type: 'drive', left: 0, right: 0, emergency: true }));
    }
    broadcast('emergency:stop', { timestamp: Date.now() });
    res.json({ success: true });
  });

  // WebSocket Server Connection Handler
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const role = url.searchParams.get('role'); // 'robot' or 'tablet'
    const tabletId = url.searchParams.get('tabletId') || `tablet-${Math.random().toString(36).substring(2, 7)}`;
    const tabletName = url.searchParams.get('name') || `Tablet ${clients.size + 1}`;

    const rawIp = req.socket.remoteAddress || 'unknown';
    const clientIp = rawIp.replace(/^::ffff:/, '');

    if (role === 'robot') {
      robotWs = ws;
      robotState.connected = true;
      robotState.ip = clientIp;
      robotState.lastHeartbeat = Date.now();

      broadcast('robot:status', { connected: true, ip: clientIp });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'telemetry') {
            robotState.batteryPercent = msg.battery ?? robotState.batteryPercent;
            robotState.cpuTemp = msg.temp ?? robotState.cpuTemp;
            if (typeof msg.ip === 'string' && msg.ip && msg.ip !== '127.0.0.1') {
              robotState.ip = msg.ip;
            }
            robotState.lastHeartbeat = Date.now();
            broadcast('robot:telemetry', {
              batteryPercent: robotState.batteryPercent,
              cpuTemp: robotState.cpuTemp,
              timestamp: Date.now(),
            });
          } else if (msg.type === 'pong') {
            robotState.lastHeartbeat = Date.now();
          }
        } catch {
          // ignore parsing error
        }
      });

      ws.on('close', () => {
        robotWs = null;
        robotState.connected = false;
        broadcast('robot:status', { connected: false });
      });

      return;
    }

    // Tablet client handling
    const tablet: TabletClient = {
      id: tabletId,
      name: tabletName,
      ws,
      ip: clientIp,
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };

    clients.set(tabletId, tablet);

    // Send initial full state to newly connected tablet
    ws.send(JSON.stringify({ event: 'init', payload: { ...getFullBroadcastState(), yourId: tabletId } }));
    broadcast('tablets:count', { count: clients.size });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // Heartbeat ping
        if (msg.event === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', clientTime: msg.time, serverTime: Date.now() }));
          tablet.lastPing = Date.now();
          return;
        }

        // Tablet station name update
        if (msg.event === 'name:update' && typeof msg.name === 'string') {
          const newName = msg.name.trim().slice(0, 32) || tablet.name;
          tablet.name = newName;
          if (queueState.activePilotId === tabletId) {
            queueState.activePilotName = newName;
          }
          queueState.queue = queueState.queue.map((q) =>
            q.id === tabletId ? { ...q, name: newName } : q
          );
          broadcast('state:update', getFullBroadcastState());
          return;
        }

        // Join Queue Request
        if (msg.event === 'queue:join') {
          if (queueState.activePilotId === tabletId) return;
          const alreadyInQueue = queueState.queue.some((q) => q.id === tabletId);
          if (!alreadyInQueue) {
            if (!queueState.activePilotId) {
              // Direct pilot assignment
              queueState.activePilotId = tabletId;
              queueState.activePilotName = tablet.name;
              queueState.timeRemainingSec = queueState.slotDurationSec;
            } else {
              queueState.queue.push({ id: tabletId, name: tablet.name, joinedAt: Date.now() });
            }
            broadcast('state:update', getFullBroadcastState());
          }
          return;
        }

        // Leave Queue / Yield Turn Request
        if (msg.event === 'queue:leave') {
          if (queueState.activePilotId === tabletId) {
            nextTurn();
          } else {
            queueState.queue = queueState.queue.filter((q) => q.id !== tabletId);
            broadcast('state:update', getFullBroadcastState());
          }
          return;
        }

        // Motor Driving Command (Only accepted if sender is active pilot!)
        if (msg.event === 'drive:command') {
          if (queueState.activePilotId !== tabletId) {
            // Not authorized to steer right now!
            return;
          }

          let left = Math.max(-100, Math.min(100, Number(msg.left) || 0));
          let right = Math.max(-100, Math.min(100, Number(msg.right) || 0));

          // Scale by speed limit
          const speedMultiplier = queueState.maxSpeedPercent / 100;
          left = Math.round(left * speedMultiplier);
          right = Math.round(right * speedMultiplier);

          robotState.lastCommand = { left, right, timestamp: Date.now() };

          // Forward to Raspberry Pi over WebSocket with minimal latency
          if (robotWs && robotWs.readyState === WebSocket.OPEN) {
            robotWs.send(JSON.stringify({ type: 'drive', left, right, timestamp: Date.now() }));
          }

          // Echo to tablets for HUD telemetry visualization
          broadcast('drive:telemetry', { left, right, pilotId: tabletId });
          return;
        }

        // Emergency Stop from any tablet
        if (msg.event === 'drive:stop') {
          robotState.lastCommand = { left: 0, right: 0, timestamp: Date.now() };
          if (robotWs && robotWs.readyState === WebSocket.OPEN) {
            robotWs.send(JSON.stringify({ type: 'drive', left: 0, right: 0 }));
          }
          broadcast('drive:telemetry', { left: 0, right: 0, pilotId: tabletId });
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(tabletId);
      // If the active pilot disconnects, pass turn immediately
      if (queueState.activePilotId === tabletId) {
        nextTurn();
      } else {
        queueState.queue = queueState.queue.filter((q) => q.id !== tabletId);
        broadcast('state:update', getFullBroadcastState());
      }
      broadcast('tablets:count', { count: clients.size });
    });
  });

  // Vite middleware in dev or static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`[Fermi Mantova] Server attivo su http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});
