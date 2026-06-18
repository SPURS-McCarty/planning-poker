import type { Room, Scale } from './types';

const ROOM_KEY_PREFIX = 'pp_room_';

function normalizeRoomId(id: string): string {
  return id.trim().toUpperCase();
}

export function saveRoom(room: Room): void {
  localStorage.setItem(ROOM_KEY_PREFIX + normalizeRoomId(room.id), JSON.stringify(room));
}

export function loadRoom(id: string): Room | null {
  const normalizedId = normalizeRoomId(id);
  const raw = localStorage.getItem(ROOM_KEY_PREFIX + normalizedId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Room;
    return {
      ...parsed,
      id: normalizeRoomId(parsed.id ?? normalizedId),
      hostId: parsed.hostId ?? parsed.participants?.[0]?.id,
      participants: (parsed.participants ?? []).map((p) => ({
        ...p,
        chips: p.chips ?? 3,
        iconIndex: p.iconIndex ?? Math.floor(Math.random() * 8),
        chipThemeIndex: p.chipThemeIndex ?? Math.floor(Math.random() * 8),
      })),
      roundNumber: parsed.roundNumber ?? 1,
      autoReveal: parsed.autoReveal ?? false,
    };
  } catch {
    return null;
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function generateParticipantId(): string {
  return crypto.randomUUID();
}

export function getOrCreateClientId(): string {
  const existing = localStorage.getItem('pp_client_id');
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem('pp_client_id', next);
  return next;
}

export function calcAverage(votes: string[]): string {
  const numeric = votes.map(Number).filter((n) => !isNaN(n));
  if (numeric.length === 0) return '—';
  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  return avg % 1 === 0 ? String(avg) : avg.toFixed(1);
}

export function voteDistribution(votes: string[]): Record<string, number> {
  return votes.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildRoomUrl(roomId: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${normalizedBase}room/${roomId}`;
}

export function customScaleFromInput(raw: string): Scale {
  const cards = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: 'custom',
    name: 'Custom',
    cards: [...cards, '?', '☕'],
    description: 'Your custom estimation deck.',
  };
}
