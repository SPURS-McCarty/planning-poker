import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Room, Participant, UserRole } from './types';
import { saveRoom, loadRoom, generateParticipantId } from './utils';
import PartySocket from 'partysocket';

interface RoomCtx {
  room: Room | null;
  me: Participant | null;
  joinRoom: (roomId: string, name: string, role?: UserRole, initialRoom?: Room) => boolean;
  vote: (card: string) => void;
  reveal: () => void;
  resetVotes: () => void;
  setAutoReveal: (enabled: boolean) => void;
  updateIssue: (issue: string) => void;
}

const Ctx = createContext<RoomCtx | null>(null);
const CORRECT_GUESS_EXTRA_CHIP = 1;

function revealAndAwardChips(r: Room) {
  if (r.revealed) return;

  const participantsOnly = r.participants.filter((p) => (p.role ?? 'participant') === 'participant');
  const votes = participantsOnly
    .map((p) => p.vote)
    .filter((vote): vote is string => vote !== null);

  const distribution = votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote] = (acc[vote] ?? 0) + 1;
    return acc;
  }, {});

  const highestCount = Math.max(0, ...Object.values(distribution));
  const highestCards = Object.entries(distribution)
    .filter(([, count]) => count === highestCount)
    .map(([card]) => card);

  // Only award when there is a clear winner card for the round.
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

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST;

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const roomRef = useRef<Room | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasConnectionRef = useRef(false);
  const shouldUsePartyKit = PARTYKIT_HOST && PARTYKIT_HOST !== 'localhost:1999';

  function getOrCreateClientId(): string {
    const existing = localStorage.getItem('pp_client_id');
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem('pp_client_id', next);
    return next;
  }

  // Keep ref in sync for callbacks
  useEffect(() => { roomRef.current = room; }, [room]);

  function startPollingFallback(roomId: string) {
    // Stop existing polling
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    // Poll localStorage every 1s as fallback
    pollingRef.current = setInterval(() => {
      const stored = localStorage.getItem(`room_${roomId}`);
      if (stored) {
        try {
          const r = JSON.parse(stored) as Room;
          setRoom(r);
        } catch (e) {
          console.error('Failed to parse stored room', e);
        }
      }
    }, 1000);
  }

  function connectToRoom(roomId: string) {
    // Close existing socket if switching rooms
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // If no PartyKit host configured, use localStorage polling only
    if (!shouldUsePartyKit) {
      console.log('PartyKit not configured, using localStorage sync only');
      startPollingFallback(roomId);
      return;
    }

    hasConnectionRef.current = false;
    const ws = new PartySocket({
      host: PARTYKIT_HOST!,
      room: roomId,
    });

    ws.onopen = () => {
      hasConnectionRef.current = true;
      console.log('Connected to PartyKit');
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { type: string; room?: Room };
      if (msg.type === 'room_state' && msg.room) {
        setRoom(msg.room);
      }
    };

    ws.onerror = (err) => {
      console.warn('PartyKit connection error, falling back to localStorage polling', err);
      startPollingFallback(roomId);
    };

    ws.onclose = () => {
      console.warn('PartyKit disconnected, falling back to localStorage polling');
      hasConnectionRef.current = false;
      startPollingFallback(roomId);
    };

    socketRef.current = ws;
  }

  function broadcast(updated: Room) {
    saveRoom(updated); // keep localStorage as local fallback
    if (shouldUsePartyKit && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'update', room: updated }));
    }
    setRoom({ ...updated });
  }

  const joinRoom = useCallback((roomId: string, name: string, role: UserRole = 'participant', initialRoom?: Room): boolean => {
    const sourceRoom =
      initialRoom ??
      loadRoom(roomId) ??
      (roomRef.current?.id === roomId ? roomRef.current : null);
    if (!sourceRoom) return false;

    const r: Room = {
      ...sourceRoom,
      participants: [...(sourceRoom.participants ?? [])],
    };

    const clientId = getOrCreateClientId();

    let participantId: string | null = sessionStorage.getItem(`pp_me_${roomId}`);
    let me = r.participants.find((p) => p.id === participantId);

    if (!me) {
      me = r.participants.find((p) => p.clientId === clientId);
      if (me) {
        participantId = me.id;
      }
    }

    // If browser storage was cleared, recover existing identity by name/role
    if (!me) {
      const normalizedName = name.trim().toLowerCase();
      me = r.participants.find(
        (p) => p.name.trim().toLowerCase() === normalizedName && (p.role ?? 'participant') === role,
      );
      if (me) {
        participantId = me.id;
      }
    }

    if (!me) {
      participantId = generateParticipantId();
      const randomIconIndex = Math.floor(Math.random() * 8);
      const randomChipThemeIndex = Math.floor(Math.random() * 8);
      me = { id: participantId, clientId, name, role, chips: 3, vote: null, hasVoted: false, iconIndex: randomIconIndex, chipThemeIndex: randomChipThemeIndex };
      r.participants.push(me);
    } else if (me.name !== name || (me.role ?? 'participant') !== role || me.clientId !== clientId) {
      me.name = name;
      me.role = role;
      me.clientId = clientId;
    }
    
    // For fresh sessions (just created), always ensure participant has 3 chips
    // Fresh = roundNumber 1 and no votes cast yet
    const hasAnyVotes = r.participants.some((p) => p.vote !== null);
    const isFreshSession = (r.roundNumber ?? 1) === 1 && !r.revealed && !hasAnyVotes;
    
    if (isFreshSession) {
      // Force reset to 3 for all participants in a fresh session
      r.participants = r.participants.map((p) => ({ ...p, chips: 3 }));
    } else {
      // For ongoing sessions, preserve chips but ensure minimum of 3
      r.participants = r.participants.map((p) => ({ ...p, chips: Math.max(3, p.chips ?? 3) }));
    }

    // Keep participant list stable if rapid join events occur.
    const seenParticipantIds = new Set<string>();
    r.participants = r.participants.filter((p) => {
      if (seenParticipantIds.has(p.id)) return false;
      seenParticipantIds.add(p.id);
      return true;
    });

    // Ensure this browser has exactly one participant row in the room.
    const seenClient = new Set<string>();
    r.participants = r.participants.filter((p) => {
      if (!p.clientId) return true;
      if (p.clientId !== clientId) return true;
      if (seenClient.has(p.clientId)) return false;
      seenClient.add(p.clientId);
      return true;
    });

    if (!r.hostId && r.participants.length > 0) {
      r.hostId = r.participants[0].id;
    }
    
    connectToRoom(roomId);
    broadcast(r);
    if (participantId) {
      sessionStorage.setItem(`pp_me_${roomId}`, participantId);
      sessionStorage.setItem(`pp_me_name_${roomId}`, name);
      sessionStorage.setItem(`pp_me_role_${roomId}`, role);
      setMeId(participantId);
    }
    return !!participantId;
  }, []);

  const vote = useCallback((card: string) => {
    if (!room || !meId) return;
    const activeMe = room.participants.find((p) => p.id === meId);
    if (!activeMe || (activeMe.role ?? 'participant') !== 'participant') return;
    const r = { ...room };
    r.participants = r.participants.map((p) =>
      p.id === meId ? { ...p, vote: card, hasVoted: true } : p
    );
    const participantsOnly = r.participants.filter((p) => (p.role ?? 'participant') === 'participant');
    const everyoneVoted = participantsOnly.length > 0 && participantsOnly.every((p) => p.hasVoted);
    if ((r.autoReveal ?? false) && everyoneVoted) {
      revealAndAwardChips(r);
    }
    broadcast(r);
  }, [room, meId]);

  const reveal = useCallback(() => {
    if (!room || !meId) return;
    const r = { ...room, participants: [...room.participants] };
    const hostParticipantId = r.hostId ?? r.participants[0]?.id;
    const meParticipant = r.participants.find((p) => p.id === meId);
    const isObserver = (meParticipant?.role ?? 'participant') === 'observer';
    if (!isObserver && (!hostParticipantId || meId !== hostParticipantId)) return;
    revealAndAwardChips(r);
    broadcast(r);
  }, [room, meId]);

  const resetVotes = useCallback(() => {
    if (!room) return;
    const r = { ...room };
    r.revealed = false;
    r.participants = r.participants.map((p) => ({ ...p, vote: null, hasVoted: false }));
    r.roundNumber = (r.roundNumber ?? 1) + 1;
    broadcast(r);
  }, [room]);

  const setAutoReveal = useCallback((enabled: boolean) => {
    if (!room) return;
    const r = { ...room, autoReveal: enabled };
    broadcast(r);
  }, [room]);

  const updateIssue = useCallback((issue: string) => {
    if (!room) return;
    const r = { ...room, currentIssue: issue };
    broadcast(r);
  }, [room]);

  const me = room?.participants.find((p) => p.id === meId) ?? null;

  return (
    <Ctx.Provider value={{ room, me, joinRoom, vote, reveal, resetVotes, setAutoReveal, updateIssue }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
