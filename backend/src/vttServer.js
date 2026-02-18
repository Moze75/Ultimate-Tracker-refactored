const { WebSocketServer } = require('ws');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      config: {
        mapImageUrl: '',
        gridSize: 60,
        snapToGrid: true,
        fogEnabled: true,
        fogPersistent: false,
        mapWidth: 3000,
        mapHeight: 2000,
      },
      tokens: [],
      fogState: { revealedCells: [] },
      connectedUsers: [],
      clients: new Map(),
      lastSnapshot: Date.now(),
      snapshotTimer: null,
    });
  }
  return rooms.get(roomId);
}

function broadcast(room, event, excludeUserId = null) {
  const msg = JSON.stringify(event);
  for (const [uid, ws] of room.clients.entries()) {
    if (uid !== excludeUserId && ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

function scheduleSnapshot(room) {
  if (room.snapshotTimer) clearTimeout(room.snapshotTimer);
  room.snapshotTimer = setTimeout(() => saveSnapshot(room), 8000);
}

async function saveSnapshot(room) {
  try {
    const state = {
      config: room.config,
      tokens: room.tokens,
      fogState: room.fogState,
    };
    await supabase
      .from('vtt_rooms')
      .update({ state_json: state, updated_at: new Date().toISOString() })
      .eq('id', room.id);
    room.lastSnapshot = Date.now();
  } catch (err) {
    console.error('[VTT] Snapshot error:', err);
  }
}

async function loadSnapshot(roomId) {
  try {
    const { data } = await supabase
      .from('vtt_rooms')
      .select('state_json, gm_user_id, name')
      .eq('id', roomId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

function snapToGrid(x, y, cellSize, snap) {
  if (!snap) return { x, y };
  return {
    x: Math.round(x / cellSize) * cellSize,
    y: Math.round(y / cellSize) * cellSize,
  };
}

const moveLimiter = new Map();
function rateLimitMove(userId) {
  const now = Date.now();
  const last = moveLimiter.get(userId) || 0;
  if (now - last < 30) return false;
  moveLimiter.set(userId, now);
  return true;
}

function initVTTWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/vtt')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomId = url.searchParams.get('roomId');
    const userId = url.searchParams.get('userId');

    if (!roomId || !userId) {
      ws.close(4001, 'Missing roomId or userId');
      return;
    }

    const room = getOrCreateRoom(roomId);

    let savedData = null;
    if (room.tokens.length === 0 && room.lastSnapshot === Date.now()) {
      savedData = await loadSnapshot(roomId);
      if (savedData?.state_json) {
        const s = savedData.state_json;
        if (s.config) room.config = { ...room.config, ...s.config };
        if (s.tokens) room.tokens = s.tokens;
        if (s.fogState) room.fogState = s.fogState;
      }
    }

    const isGM = savedData?.gm_user_id === userId;
    const role = isGM ? 'gm' : 'player';

    if (!room.connectedUsers.includes(userId)) {
      room.connectedUsers.push(userId);
    }
    room.clients.set(userId, ws);

    ws.send(JSON.stringify({
      type: 'STATE_SYNC',
      state: {
        room: {
          id: room.id,
          config: room.config,
          tokens: room.tokens,
          fogState: room.fogState,
          connectedUsers: room.connectedUsers,
          lastSnapshot: room.lastSnapshot,
        },
        yourRole: role,
        yourUserId: userId,
      },
    }));

    broadcast(room, { type: 'USER_JOINED', userId }, userId);

    ws.on('message', (raw) => {
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (event.type) {
        case 'MOVE_TOKEN_REQUEST': {
          if (!rateLimitMove(userId)) break;
          const token = room.tokens.find(t => t.id === event.tokenId);
          if (!token) break;
          if (role !== 'gm' && token.ownerUserId !== userId) break;
          const pos = snapToGrid(event.position.x, event.position.y, room.config.gridSize, room.config.snapToGrid);
          token.position = pos;
          broadcast(room, { type: 'TOKEN_MOVED', tokenId: event.tokenId, position: pos });
          scheduleSnapshot(room);
          break;
        }

        case 'ADD_TOKEN': {
          const newToken = {
            ...event.token,
            id: crypto.randomUUID(),
            ownerUserId: userId,
          };
          room.tokens.push(newToken);
          broadcast(room, { type: 'TOKEN_ADDED', token: newToken });
          scheduleSnapshot(room);
          break;
        }

        case 'REMOVE_TOKEN': {
          const idx = room.tokens.findIndex(t => t.id === event.tokenId);
          if (idx === -1) break;
          const token = room.tokens[idx];
          if (role !== 'gm' && token.ownerUserId !== userId) break;
          room.tokens.splice(idx, 1);
          broadcast(room, { type: 'TOKEN_REMOVED', tokenId: event.tokenId });
          scheduleSnapshot(room);
          break;
        }

        case 'UPDATE_TOKEN': {
          if (role !== 'gm') break;
          const token = room.tokens.find(t => t.id === event.tokenId);
          if (!token) break;
          Object.assign(token, event.changes);
          broadcast(room, { type: 'TOKEN_UPDATED', tokenId: event.tokenId, changes: event.changes });
          scheduleSnapshot(room);
          break;
        }

        case 'REVEAL_FOG': {
          if (role !== 'gm') break;
          const revealed = new Set(room.fogState.revealedCells);
          (event.cells || []).forEach(c => revealed.add(c));
          room.fogState.revealedCells = Array.from(revealed);
          broadcast(room, { type: 'FOG_UPDATED', fogState: room.fogState }, userId);
          scheduleSnapshot(room);
          break;
        }

        case 'RESET_FOG': {
          if (role !== 'gm') break;
          room.fogState = { revealedCells: [] };
          broadcast(room, { type: 'FOG_UPDATED', fogState: room.fogState });
          saveSnapshot(room);
          break;
        }

        case 'UPDATE_MAP': {
          if (role !== 'gm') break;
          Object.assign(room.config, event.config);
          broadcast(room, { type: 'MAP_UPDATED', config: event.config });
          saveSnapshot(room);
          break;
        }
      }
    });

    ws.on('close', () => {
      room.clients.delete(userId);
      room.connectedUsers = room.connectedUsers.filter(id => id !== userId);
      broadcast(room, { type: 'USER_LEFT', userId });

      if (room.clients.size === 0) {
        saveSnapshot(room);
        setTimeout(() => {
          if (rooms.get(roomId)?.clients.size === 0) {
            rooms.delete(roomId);
          }
        }, 30000);
      }
    });
  });

  return wss;
}

function initVTTRoutes(app) {
  app.post('/api/vtt/rooms', async (req, res) => {
    try {
      const { name, gmUserId } = req.body;
      if (!name || !gmUserId) return res.status(400).json({ error: 'Missing name or gmUserId' });

      const roomId = crypto.randomUUID().split('-')[0].toUpperCase();
      const { data, error } = await supabase
        .from('vtt_rooms')
        .insert({
          id: roomId,
          name,
          gm_user_id: gmUserId,
          state_json: { config: {}, tokens: [], fogState: { revealedCells: [] } },
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ roomId: data.id });
    } catch (err) {
      console.error('[VTT] Create room error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/vtt/rooms', async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.json([]);

      const { data } = await supabase
        .from('vtt_rooms')
        .select('id, name, gm_user_id, created_at')
        .eq('gm_user_id', userId)
        .order('created_at', { ascending: false });

      res.json((data || []).map(r => ({
        id: r.id,
        name: r.name,
        gmUserId: r.gm_user_id,
        createdAt: r.created_at,
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/vtt/rooms/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      await supabase.from('vtt_rooms').delete().eq('id', roomId);
      rooms.delete(roomId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { initVTTWebSocket, initVTTRoutes };
