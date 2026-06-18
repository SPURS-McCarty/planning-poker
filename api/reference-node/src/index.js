import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const rooms = new Map();
const eventsByRoom = new Map();

const BUILT_IN_SCALES = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
    description: 'Classic fibonacci scale',
  },
  'modified-fibonacci': {
    id: 'modified-fibonacci',
    name: 'Modified Fibonacci',
    cards: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
    description: 'Modified fibonacci scale',
  },
  't-shirt': {
    id: 't-shirt',
    name: 'T-Shirt Sizes',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
    description: 'T-shirt sizing scale',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeRoomId(value) {
  return String(value || '').trim().toUpperCase();
}

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureAuth(req, res, next) {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 12) {
    res.status(401).json({ message: 'Missing or invalid bearer token' });
    return;
  }
  next();
}

function getRoomOr404(roomId, res) {
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return null;
  }
  return room;
}

function getEvents(roomId) {
  if (!eventsByRoom.has(roomId)) {
    eventsByRoom.set(roomId, []);
  }
  return eventsByRoom.get(roomId);
}

function appendEvent(roomId, type, version, payload = {}) {
  getEvents(roomId).push({
    version,
    type,
    at: nowIso(),
    payload,
  });
}

function assertExpectedVersion(room, expectedVersion, res) {
  if (Number(expectedVersion) !== Number(room.version)) {
    res.status(409).json({
      message: 'Version conflict',
      latest: room,
    });
    return false;
  }
  return true;
}

function revealAndAwardChips(room) {
  if (room.revealed) return;

  const participantsOnly = room.participants.filter((p) => (p.role || 'participant') === 'participant');
  const votes = participantsOnly.map((p) => p.vote).filter((vote) => vote !== null);

  const distribution = votes.reduce((acc, vote) => {
    acc[vote] = (acc[vote] || 0) + 1;
    return acc;
  }, {});

  const counts = Object.values(distribution);
  const highestCount = counts.length > 0 ? Math.max(...counts) : 0;
  const highestCards = Object.entries(distribution)
    .filter(([, count]) => count === highestCount)
    .map(([card]) => card);

  const winningCard = highestCards.length === 1 ? highestCards[0] : null;
  const winnerCount = participantsOnly.filter((p) => p.vote === winningCard).length;
  const dynamicBonus = winnerCount > 0 ? Math.max(1, Math.ceil(votes.length / winnerCount)) : 0;

  room.participants = room.participants.map((p) => {
    const currentChips = Number.isFinite(p.chips) ? p.chips : 3;
    if ((p.role || 'participant') !== 'participant') return { ...p, chips: currentChips };
    if (!p.vote || !winningCard || p.vote !== winningCard) return { ...p, chips: currentChips };
    return { ...p, chips: currentChips + dynamicBonus + 1 };
  });

  room.revealed = true;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'planning-poker-reference-api' });
});

app.use('/v1/planning-poker', ensureAuth);

app.post('/v1/planning-poker/rooms', (req, res) => {
  const sessionName = String(req.body?.sessionName || '').trim();
  const hostDisplayName = String(req.body?.hostDisplayName || '').trim();
  const hostRole = req.body?.hostRole === 'observer' ? 'observer' : 'participant';
  const scaleId = String(req.body?.scaleId || 'fibonacci');

  if (!sessionName || !hostDisplayName) {
    res.status(400).json({ message: 'sessionName and hostDisplayName are required' });
    return;
  }

  const roomId = randomRoomId();
  const hostId = crypto.randomUUID();
  const scale = BUILT_IN_SCALES[scaleId] || BUILT_IN_SCALES.fibonacci;
  const createdAt = nowIso();

  const room = {
    id: roomId,
    sessionName,
    hostId,
    scale,
    participants: [
      {
        id: hostId,
        clientId: 'host-client',
        name: hostDisplayName,
        role: hostRole,
        chips: 3,
        vote: null,
        hasVoted: false,
        iconIndex: Math.floor(Math.random() * 8),
        chipThemeIndex: Math.floor(Math.random() * 8),
      },
    ],
    revealed: false,
    roundNumber: 1,
    autoReveal: false,
    currentIssue: '',
    version: 1,
    updatedAt: createdAt,
  };

  rooms.set(roomId, room);
  appendEvent(roomId, 'room_created', 1, { roomId });
  res.status(201).json(clone(room));
});

app.get('/v1/planning-poker/rooms/:roomId', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;
  res.json(clone(room));
});

app.patch('/v1/planning-poker/rooms/:roomId', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const expectedVersion = req.body?.expectedVersion;
  if (!assertExpectedVersion(room, expectedVersion, res)) return;

  const ops = Array.isArray(req.body?.ops) ? req.body.ops : [];
  for (const op of ops) {
    if (op?.op === 'setIssue') {
      room.currentIssue = String(op.value || '');
    }
    if (op?.op === 'setAutoReveal') {
      room.autoReveal = Boolean(op.value);
    }
  }

  room.version += 1;
  room.updatedAt = nowIso();
  appendEvent(roomId, 'room_patched', room.version, { ops });
  res.json(clone(room));
});

app.post('/v1/planning-poker/rooms/:roomId/participants', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const expectedVersion = req.body?.expectedVersion;
  if (!assertExpectedVersion(room, expectedVersion, res)) return;

  const clientId = String(req.body?.clientId || '').trim();
  const displayName = String(req.body?.displayName || '').trim();
  const role = req.body?.role === 'observer' ? 'observer' : 'participant';

  if (!clientId || !displayName) {
    res.status(400).json({ message: 'clientId and displayName are required' });
    return;
  }

  let participant = room.participants.find((p) => p.clientId === clientId);
  if (!participant) {
    participant = {
      id: crypto.randomUUID(),
      clientId,
      name: displayName,
      role,
      chips: 3,
      vote: null,
      hasVoted: false,
      iconIndex: Math.floor(Math.random() * 8),
      chipThemeIndex: Math.floor(Math.random() * 8),
    };
    room.participants.push(participant);
  } else {
    participant.name = displayName;
    participant.role = role;
  }

  room.version += 1;
  room.updatedAt = nowIso();
  appendEvent(roomId, 'participant_joined', room.version, { participantId: participant.id });
  res.json(clone(room));
});

app.post('/v1/planning-poker/rooms/:roomId/votes', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const expectedVersion = req.body?.expectedVersion;
  if (!assertExpectedVersion(room, expectedVersion, res)) return;

  const participantId = String(req.body?.participantId || '').trim();
  const card = String(req.body?.card || '').trim();
  if (!participantId || !card) {
    res.status(400).json({ message: 'participantId and card are required' });
    return;
  }

  room.participants = room.participants.map((p) =>
    p.id === participantId ? { ...p, vote: card, hasVoted: true } : p,
  );

  const participantsOnly = room.participants.filter((p) => (p.role || 'participant') === 'participant');
  const everyoneVoted = participantsOnly.length > 0 && participantsOnly.every((p) => p.hasVoted);
  if (room.autoReveal && everyoneVoted) {
    revealAndAwardChips(room);
  }

  room.version += 1;
  room.updatedAt = nowIso();
  appendEvent(roomId, 'vote_cast', room.version, { participantId, card });
  res.json(clone(room));
});

app.post('/v1/planning-poker/rooms/:roomId/reveal', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const expectedVersion = req.body?.expectedVersion;
  if (!assertExpectedVersion(room, expectedVersion, res)) return;

  const requestedByParticipantId = String(req.body?.requestedByParticipantId || '');
  const hostId = room.hostId || room.participants[0]?.id;
  if (!hostId || requestedByParticipantId !== hostId) {
    res.status(403).json({ message: 'Only host can reveal votes' });
    return;
  }

  revealAndAwardChips(room);
  room.version += 1;
  room.updatedAt = nowIso();
  appendEvent(roomId, 'revealed', room.version, { requestedByParticipantId });
  res.json(clone(room));
});

app.post('/v1/planning-poker/rooms/:roomId/reset', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const expectedVersion = req.body?.expectedVersion;
  if (!assertExpectedVersion(room, expectedVersion, res)) return;

  const requestedByParticipantId = String(req.body?.requestedByParticipantId || '');
  const hostId = room.hostId || room.participants[0]?.id;
  if (!hostId || requestedByParticipantId !== hostId) {
    res.status(403).json({ message: 'Only host can reset rounds' });
    return;
  }

  room.revealed = false;
  room.participants = room.participants.map((p) => ({ ...p, vote: null, hasVoted: false }));
  room.roundNumber = (room.roundNumber || 1) + 1;

  room.version += 1;
  room.updatedAt = nowIso();
  appendEvent(roomId, 'round_reset', room.version, { requestedByParticipantId });
  res.json(clone(room));
});

app.get('/v1/planning-poker/rooms/:roomId/events', (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = getRoomOr404(roomId, res);
  if (!room) return;

  const sinceVersion = Number(req.query.sinceVersion || 0);
  const events = getEvents(roomId).filter((event) => event.version > sinceVersion);
  const toVersion = events.length > 0 ? events[events.length - 1].version : sinceVersion;

  res.json({
    roomId,
    fromVersion: sinceVersion,
    toVersion,
    events,
  });
});

app.listen(port, () => {
  console.log(`Planning Poker reference API listening on http://localhost:${port}`);
});
