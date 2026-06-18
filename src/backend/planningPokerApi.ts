import type { Room, UserRole } from '../types';

export interface CreateRoomInput {
  sessionName: string;
  hostDisplayName: string;
  hostRole: UserRole;
  scaleId: string;
}

export interface PatchRoomInput {
  roomId: string;
  expectedVersion: number;
  ops: Array<
    | { op: 'setIssue'; value: string }
    | { op: 'setAutoReveal'; value: boolean }
  >;
}

export interface JoinParticipantInput {
  roomId: string;
  expectedVersion: number;
  clientId: string;
  displayName: string;
  role: UserRole;
}

export interface CastVoteInput {
  roomId: string;
  expectedVersion: number;
  participantId: string;
  card: string;
}

export interface HostActionInput {
  roomId: string;
  expectedVersion: number;
  requestedByParticipantId: string;
}

export interface RoomEvent {
  version: number;
  type: string;
  at: string;
  payload?: Record<string, unknown>;
}

export interface EventPage {
  roomId: string;
  fromVersion: number;
  toVersion: number;
  events: RoomEvent[];
}

export interface VersionedRoom extends Room {
  version: number;
  updatedAt: string;
}

export interface PlanningPokerApi {
  createRoom(input: CreateRoomInput): Promise<VersionedRoom>;
  getRoom(roomId: string): Promise<VersionedRoom | null>;
  patchRoom(input: PatchRoomInput): Promise<VersionedRoom>;
  joinParticipant(input: JoinParticipantInput): Promise<VersionedRoom>;
  castVote(input: CastVoteInput): Promise<VersionedRoom>;
  reveal(input: HostActionInput): Promise<VersionedRoom>;
  reset(input: HostActionInput): Promise<VersionedRoom>;
  getEvents(roomId: string, sinceVersion: number): Promise<EventPage>;
}
