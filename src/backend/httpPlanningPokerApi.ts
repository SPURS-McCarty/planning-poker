import type {
  CastVoteInput,
  CreateRoomInput,
  EventPage,
  HostActionInput,
  JoinParticipantInput,
  PatchRoomInput,
  PlanningPokerApi,
  VersionedRoom,
} from './planningPokerApi';

type TokenProvider = () => Promise<string>;

export class PlanningPokerHttpApi implements PlanningPokerApi {
  private readonly baseUrl: string;
  private readonly getToken: TokenProvider;

  constructor(baseUrl: string, getToken: TokenProvider) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  private correlationId(): string {
    return crypto.randomUUID();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-correlation-id': this.correlationId(),
        ...(init?.headers ?? {}),
      },
    });

    if (response.status === 404) {
      throw new Error('NOT_FOUND');
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `HTTP_${response.status}`);
    }

    return (await response.json()) as T;
  }

  createRoom(input: CreateRoomInput): Promise<VersionedRoom> {
    return this.request<VersionedRoom>('/v1/planning-poker/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getRoom(roomId: string): Promise<VersionedRoom | null> {
    try {
      return await this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}`);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  patchRoom(input: PatchRoomInput): Promise<VersionedRoom> {
    const { roomId, ...body } = input;
    return this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  joinParticipant(input: JoinParticipantInput): Promise<VersionedRoom> {
    const { roomId, ...body } = input;
    return this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}/participants`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  castVote(input: CastVoteInput): Promise<VersionedRoom> {
    const { roomId, ...body } = input;
    return this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}/votes`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  reveal(input: HostActionInput): Promise<VersionedRoom> {
    const { roomId, ...body } = input;
    return this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}/reveal`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  reset(input: HostActionInput): Promise<VersionedRoom> {
    const { roomId, ...body } = input;
    return this.request<VersionedRoom>(`/v1/planning-poker/rooms/${encodeURIComponent(roomId)}/reset`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getEvents(roomId: string, sinceVersion: number): Promise<EventPage> {
    return this.request<EventPage>(
      `/v1/planning-poker/rooms/${encodeURIComponent(roomId)}/events?sinceVersion=${sinceVersion}`,
    );
  }
}
