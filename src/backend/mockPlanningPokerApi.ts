import { BUILT_IN_SCALES, type Participant, type Room } from '../types';
import { generateId, generateParticipantId } from '../utils';
import type {
  CastVoteInput,
  CreateRoomInput,
  EventPage,
  HostActionInput,
  JoinParticipantInput,
  PatchRoomInput,
  PlanningPokerApi,
  RoomEvent,
  VersionedRoom,
} from './planningPokerApi';

interface RoomRecord {
  room: VersionedRoom;
  events: RoomEvent[];
}

const CORRECT_GUESS_EXTRA_CHIP = 1;
const MOCK_ROOM_KEY_PREFIX = 'pp_mock_room_';
const MOCK_ROOM_INDEX_KEY = 'pp_mock_room_index';

function nowIso(): string {
  return new Date().toISOString();
}

function cloneRoom(room: VersionedRoom): VersionedRoom {
  return JSON.parse(JSON.stringify(room)) as VersionedRoom;
}

function revealAndAwardChips(r: Room): void {
  if (r.revealed) return;

  const participantsOnly = r.participants.filter((p) => (p.role ?? 'participant') === 'participant');
  const votes = participantsOnly.map((p) => p.vote).filter((vote): vote is string => vote !== null);

  const distribution = votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote] = (acc[vote] ?? 0) + 1;
    return acc;
  }, {});

  const highestCount = Math.max(0, ...Object.values(distribution));
  const highestCards = Object.entries(distribution)
    .filter(([, count]) => count === highestCount)
    .map(([card]) => card);

  const winningCard = highestCards.length === 1 ? highestCards[0] : null;
  const winnerCount = participantsOnly.filter((p) => p.vote === winningCard).length;
  const dynamicBonus = winnerCount > 0 ? Math.max(1, Math.ceil(votes.length / winnerCount)) : 0;

  r.participants = r.participants.map((p) => {
    const currentChips = p.chips ?? 3;
    if ((p.role ?? 'participant') !== 'participant') return { ...p, chips: currentChips };
    if (!p.vote || !winningCard || p.vote !== winningCard) return { ...p, chips: currentChips };
    return { ...p, chips: currentChips + dynamicBonus + CORRECT_GUESS_EXTRA_CHIP };
  });

  r.revealed = true;
}

export class MockPlanningPokerApi implements PlanningPokerApi {
  private readRoomIndex(): string[] {
    const raw = localStorage.getItem(MOCK_ROOM_INDEX_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeRoomIndex(roomIds: string[]): void {
    localStorage.setItem(MOCK_ROOM_INDEX_KEY, JSON.stringify(Array.from(new Set(roomIds))));
  }

  private roomStorageKey(roomId: string): string {
    return `${MOCK_ROOM_KEY_PREFIX}${roomId}`;
  }

  private loadRoomRecord(roomId: string): RoomRecord | null {
    const raw = localStorage.getItem(this.roomStorageKey(roomId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RoomRecord;
    } catch {
      return null;
    }
  }

  private saveRoomRecord(roomId: string, record: RoomRecord): void {
    localStorage.setItem(this.roomStorageKey(roomId), JSON.stringify(record));
    const roomIds = this.readRoomIndex();
    if (!roomIds.includes(roomId)) {
      roomIds.push(roomId);
      this.writeRoomIndex(roomIds);
    }
    // Trigger storage event for other tabs listening to this key family.
    localStorage.setItem('pp_mock_last_update', nowIso());
  }

  private getRoomRecord(roomId: string): RoomRecord {
    const record = this.loadRoomRecord(roomId);
    if (!record) throw new Error('NOT_FOUND');
    return record;
  }

  private ensureVersion(expectedVersion: number, actual: number): void {
    if (expectedVersion !== actual) {
      throw new Error('VERSION_CONFLICT');
    }
  }

  private commit(roomId: string, room: VersionedRoom, eventType: string, payload?: Record<string, unknown>): VersionedRoom {
    const nextVersion = room.version + 1;
    const updated: VersionedRoom = {
      ...room,
      id: roomId,
      version: nextVersion,
      updatedAt: nowIso(),
      participants: [...room.participants],
    };

    const record = this.getRoomRecord(roomId);
    const event: RoomEvent = {
      version: nextVersion,
      type: eventType,
      at: updated.updatedAt,
      payload,
    };

    const nextRecord: RoomRecord = {
      room: updated,
      events: [...record.events, event],
    };
    this.saveRoomRecord(roomId, nextRecord);
    return cloneRoom(updated);
  }

  async createRoom(input: CreateRoomInput): Promise<VersionedRoom> {
    const roomId = generateId();
    const hostId = generateParticipantId();
    const randomIconIndex = Math.floor(Math.random() * 8);
    const randomChipThemeIndex = Math.floor(Math.random() * 8);
    const scale = BUILT_IN_SCALES.find((s) => s.id === input.scaleId) ?? BUILT_IN_SCALES[0];

    const participants: Participant[] = [
      {
        id: hostId,
        clientId: 'mock-host-client',
        name: input.hostDisplayName,
        role: input.hostRole,
        chips: 3,
        vote: null,
        hasVoted: false,
        iconIndex: randomIconIndex,
        chipThemeIndex: randomChipThemeIndex,
      },
    ];

    const room: VersionedRoom = {
      id: roomId,
      sessionName: input.sessionName,
      hostId,
      scale,
      participants,
      revealed: false,
      roundNumber: 1,
      autoReveal: false,
      currentIssue: '',
      version: 1,
      updatedAt: nowIso(),
    };

    this.saveRoomRecord(roomId, {
      room,
      events: [{ version: 1, type: 'room_created', at: room.updatedAt }],
    });

    return cloneRoom(room);
  }

  async getRoom(roomId: string): Promise<VersionedRoom | null> {
    const record = this.loadRoomRecord(roomId);
    return record ? cloneRoom(record.room) : null;
  }

  async patchRoom(input: PatchRoomInput): Promise<VersionedRoom> {
    const record = this.getRoomRecord(input.roomId);
    this.ensureVersion(input.expectedVersion, record.room.version);

    const draft: VersionedRoom = cloneRoom(record.room);
    for (const op of input.ops) {
      if (op.op === 'setIssue') draft.currentIssue = op.value;
      if (op.op === 'setAutoReveal') draft.autoReveal = op.value;
    }

    return this.commit(input.roomId, draft, 'room_patched', { ops: input.ops });
  }

  async joinParticipant(input: JoinParticipantInput): Promise<VersionedRoom> {
    const record = this.getRoomRecord(input.roomId);
    this.ensureVersion(input.expectedVersion, record.room.version);

    const draft: VersionedRoom = cloneRoom(record.room);
    const existing = draft.participants.find((p) => p.clientId === input.clientId);

    if (existing) {
      existing.name = input.displayName;
      existing.role = input.role;
    } else {
      const randomIconIndex = Math.floor(Math.random() * 8);
      const randomChipThemeIndex = Math.floor(Math.random() * 8);
      draft.participants.push({
        id: generateParticipantId(),
        clientId: input.clientId,
        name: input.displayName,
        role: input.role,
        chips: 3,
        vote: null,
        hasVoted: false,
        iconIndex: randomIconIndex,
        chipThemeIndex: randomChipThemeIndex,
      });
    }

    return this.commit(input.roomId, draft, 'participant_joined');
  }

  async castVote(input: CastVoteInput): Promise<VersionedRoom> {
    const record = this.getRoomRecord(input.roomId);
    this.ensureVersion(input.expectedVersion, record.room.version);

    const draft: VersionedRoom = cloneRoom(record.room);
    draft.participants = draft.participants.map((p) =>
      p.id === input.participantId ? { ...p, vote: input.card, hasVoted: true } : p,
    );

    const participantsOnly = draft.participants.filter((p) => (p.role ?? 'participant') === 'participant');
    const everyoneVoted = participantsOnly.length > 0 && participantsOnly.every((p) => p.hasVoted);
    if ((draft.autoReveal ?? false) && everyoneVoted) {
      revealAndAwardChips(draft);
    }

    return this.commit(input.roomId, draft, 'vote_cast', { participantId: input.participantId });
  }

  async reveal(input: HostActionInput): Promise<VersionedRoom> {
    const record = this.getRoomRecord(input.roomId);
    this.ensureVersion(input.expectedVersion, record.room.version);

    const draft: VersionedRoom = cloneRoom(record.room);
    const hostParticipantId = draft.hostId ?? draft.participants[0]?.id;
    if (!hostParticipantId || input.requestedByParticipantId !== hostParticipantId) {
      throw new Error('FORBIDDEN');
    }

    revealAndAwardChips(draft);
    return this.commit(input.roomId, draft, 'revealed');
  }

  async reset(input: HostActionInput): Promise<VersionedRoom> {
    const record = this.getRoomRecord(input.roomId);
    this.ensureVersion(input.expectedVersion, record.room.version);

    const draft: VersionedRoom = cloneRoom(record.room);
    const hostParticipantId = draft.hostId ?? draft.participants[0]?.id;
    if (!hostParticipantId || input.requestedByParticipantId !== hostParticipantId) {
      throw new Error('FORBIDDEN');
    }

    draft.revealed = false;
    draft.participants = draft.participants.map((p) => ({ ...p, vote: null, hasVoted: false }));
    draft.roundNumber = (draft.roundNumber ?? 1) + 1;

    return this.commit(input.roomId, draft, 'round_reset');
  }

  async getEvents(roomId: string, sinceVersion: number): Promise<EventPage> {
    const record = this.getRoomRecord(roomId);
    const events = record.events.filter((e) => e.version > sinceVersion);
    const toVersion = events.length > 0 ? events[events.length - 1].version : sinceVersion;
    return {
      roomId,
      fromVersion: sinceVersion,
      toVersion,
      events,
    };
  }
}
