import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Room, Participant, UserRole } from './types';
import { saveRoom, generateParticipantId } from './utils';
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

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const roomRef = useRef<Room | null>(null);

  // Keep ref in sync for callbacks
  useEffect(() => { roomRef.current = room; }, [room]);

  function connectToRoom(roomId: string) {
    // Close existing socket if switching rooms
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { type: string; room?: Room };
      if (msg.type === 'room_state' && msg.room) {
        setRoom(msg.room);
      }
    };
    socketRef.current = ws;
  }

  function broadcast(updated: Room) {
    saveRoom(updated); // keep localStorage as local fallback
    socketRef.current?.send(JSON.stringify({ type: 'update', room: updated }));
    setRoom({ ...updated });
  }

  const joinRoom = useCallback((roomId: string, name: string, role: UserRole = 'participant', initialRoom?: Room): boolean => {
    const r = initialRoom ?? null;
    if (!r) return false;
    let participantId = sessionStorage.getItem(`pp_me_${roomId}`);
    let me = r.participants.find((p) => p.id === participantId);
    if (!me) {
      participantId = generateParticipantId();
      const randomIconIndex = Math.floor(Math.random() * 8);
      const randomChipThemeIndex = Math.floor(Math.random() * 8);
      me = { id: participantId, name, role, chips: 3, vote: null, hasVoted: false, iconIndex: randomIconIndex, chipThemeIndex: randomChipThemeIndex };
      r.participants.push(me);
    } else if (me.name !== name || (me.role ?? 'participant') !== role) {
      me.name = name;
      me.role = role;
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
    
    connectToRoom(roomId);
    broadcast(r);
    sessionStorage.setItem(`pp_me_${roomId}`, participantId);
    sessionStorage.setItem(`pp_me_name_${roomId}`, name);
    sessionStorage.setItem(`pp_me_role_${roomId}`, role);
    setMeId(participantId);
    return true;
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
    if (!hostParticipantId || meId !== hostParticipantId) return;
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
