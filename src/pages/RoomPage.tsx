import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoom } from '../RoomContext';
import { ResultsPanel } from '../components/ResultsPanel';
import { buildRoomUrl } from '../utils';
import { Copy, RotateCcw, ArrowLeft, Volume2, VolumeX, Users, Zap, Heart, Star, Eye, Shield, Flame, Wind } from 'lucide-react';

const CHIP_THEMES = [
  { outer: '#122e1b', ring: '#ffde00', inner: '#2f6f2b', icon: '#fff6bf' },
  { outer: '#291612', ring: '#ff8f4a', inner: '#8f3b2d', icon: '#ffe3d3' },
  { outer: '#121f34', ring: '#62b3ff', inner: '#2f5b8f', icon: '#d9ecff' },
  { outer: '#2e142f', ring: '#d88cff', inner: '#70378f', icon: '#f2ddff' },
  { outer: '#1c2f14', ring: '#9ddf51', inner: '#477f2f', icon: '#e7f7d3' },
  { outer: '#2f2414', ring: '#f7c35f', inner: '#8f662f', icon: '#ffefd2' },
  { outer: '#2f1414', ring: '#ff6f6f', inner: '#8f2f2f', icon: '#ffdede' },
  { outer: '#133031', ring: '#65d8d4', inner: '#2b7d79', icon: '#dcf9f8' },
];

const CHIP_LANDING_CLASSES = [
  'left-[8%] top-[12%] rotate-[-10deg] z-10',
  'left-[14%] top-[30%] rotate-[8deg] z-20',
  'left-[20%] top-[18%] rotate-[-6deg] z-30',
  'left-[28%] top-[35%] rotate-[12deg] z-20',
  'left-[34%] top-[16%] rotate-[-12deg] z-30',
  'left-[40%] top-[30%] rotate-[6deg] z-40',
  'left-[48%] top-[14%] rotate-[-8deg] z-30',
  'left-[54%] top-[34%] rotate-[10deg] z-20',
  'left-[60%] top-[18%] rotate-[-10deg] z-40',
  'left-[68%] top-[32%] rotate-[8deg] z-20',
  'left-[74%] top-[15%] rotate-[-6deg] z-30',
  'left-[82%] top-[30%] rotate-[11deg] z-20',
];

const RANDOM_ICONS = [Users, Zap, Heart, Star, Eye, Shield, Flame, Wind];

function getRandomIcon(iconIndex?: number) {
  const idx = iconIndex ?? 0;
  return RANDOM_ICONS[idx % RANDOM_ICONS.length];
}

function hashFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getChipThemeByIndex(themeIndex?: number) {
  const idx = themeIndex ?? 0;
  return CHIP_THEMES[idx % CHIP_THEMES.length];
}

function seatArcOffsetClass(index: number, total: number) {
  if (total <= 1) return 'translate-y-0';
  const midpoint = (total - 1) / 2;
  const distance = Math.abs(index - midpoint);
  const normalized = midpoint === 0 ? 0 : distance / midpoint;
  if (normalized > 0.8) return 'translate-y-3';
  if (normalized > 0.45) return 'translate-y-2';
  if (normalized > 0.2) return 'translate-y-1';
  return 'translate-y-0';
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, me, joinRoom, vote, reveal, resetVotes, setAutoReveal } = useRoom();
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('pp_sound_enabled');
    return stored ? stored === 'true' : true;
  });
  const [revealFx, setRevealFx] = useState(false);
  const [revealContentReady, setRevealContentReady] = useState(false);
  const [revealKickoff, setRevealKickoff] = useState(false);
  const [impactFx, setImpactFx] = useState(false);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [tossingChipIds, setTossingChipIds] = useState<string[]>([]);
  const [chipLandingClassById, setChipLandingClassById] = useState<Record<string, string>>({});
  const [chipFlightById, setChipFlightById] = useState<Record<string, { x: number; y: number; rotate: number; arc: number; duration: number; spin: number; sway: number }>>({});
  const prevRevealedRef = useRef(false);
  const prevVoteByIdRef = useRef<Record<string, string | null>>({});
  const tossTimeoutsRef = useRef<number[]>([]);
  const revealKickoffTimeoutRef = useRef<number | null>(null);
  const impactTimeoutRef = useRef<number | null>(null);
  const landingZoneRef = useRef<HTMLDivElement | null>(null);
  const seatAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chipTargetRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Re-hydrate from localStorage if context is empty (e.g. page refresh)
  useEffect(() => {
    if (!roomId) return;
    
    // If we have a room but it's from a different session, reset and reload
    if (room && room.id !== roomId) {
      // Room ID mismatch - we've navigated to a different room
      // Force a fresh load by calling joinRoom again
      const storedName = sessionStorage.getItem(`pp_me_name_${roomId}`);
      const storedRole = (sessionStorage.getItem(`pp_me_role_${roomId}`) as 'participant' | 'observer' | null) ?? 'participant';
      if (storedName) {
        joinRoom(roomId, storedName, storedRole);
      } else {
        navigate(`/join/${roomId}`);
      }
      return;
    }
    
    if (!room) {
      const storedName = sessionStorage.getItem(`pp_me_name_${roomId}`);
      const storedRole = (sessionStorage.getItem(`pp_me_role_${roomId}`) as 'participant' | 'observer' | null) ?? 'participant';
      if (storedName) {
        joinRoom(roomId, storedName, storedRole);
      } else {
        navigate(`/join/${roomId}`);
      }
    }
  }, [roomId, room?.id]);

  useEffect(() => {
    localStorage.setItem('pp_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (!room) return;
    if (room.revealed && !prevRevealedRef.current) {
      setRevealContentReady(false);
      setRevealFx(true);
      const contentTimeout = window.setTimeout(() => setRevealContentReady(true), 50);
      const timeout = window.setTimeout(() => setRevealFx(false), 420);
      prevRevealedRef.current = true;
      return () => {
        window.clearTimeout(contentTimeout);
        window.clearTimeout(timeout);
      };
    }
    if (!room.revealed) {
      setRevealContentReady(false);
    }
    prevRevealedRef.current = room.revealed;
    return;
  }, [room?.revealed]);

  useEffect(() => {
    return () => {
      tossTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      tossTimeoutsRef.current = [];
      if (revealKickoffTimeoutRef.current) {
        window.clearTimeout(revealKickoffTimeoutRef.current);
      }
      if (impactTimeoutRef.current) {
        window.clearTimeout(impactTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!room || room.revealed) return;

    const participantsOnly = room.participants.filter((p) => (p.role ?? 'participant') === 'participant');
    const newlyVotedIds = participantsOnly
      .filter((p) => p.vote !== null)
      .filter((p) => prevVoteByIdRef.current[p.id] !== p.vote)
      .map((p) => p.id);

    if (newlyVotedIds.length > 0) {
      const landingRect = landingZoneRef.current?.getBoundingClientRect();
      const flightDurations: Record<string, number> = {};
      if (landingRect) {
        setChipFlightById((current) => {
          const next = { ...current };
          newlyVotedIds.forEach((id) => {
            const seatAnchor = seatAnchorRefs.current[id];
            const target = chipTargetRefs.current[id];
            if (!seatAnchor || !target) return;

            const seatRect = seatAnchor.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const seatCenterX = seatRect.left + seatRect.width / 2;
            const seatCenterY = seatRect.top + seatRect.height / 2;
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;
            const deltaX = seatCenterX - targetCenterX;
            const deltaY = seatCenterY - targetCenterY;
            const distance = Math.hypot(deltaX, deltaY);
            const arc = Math.max(64, Math.min(144, distance * 0.27));
            const duration = Math.max(560, Math.min(900, 560 + distance * 0.34));
            const spinSeed = ((hashFromId(id) % 7) - 3) * 1.4;
            const swaySeed = ((hashFromId(`${id}-sway`) % 9) - 4) * 2.2;

            next[id] = {
              x: deltaX,
              y: deltaY,
              rotate: ((hashFromId(id) % 14) - 7) * 1.8,
              arc,
              duration,
              spin: spinSeed,
              sway: swaySeed,
            };
            flightDurations[id] = duration;
          });
          return next;
        });
      }

      setTossingChipIds((existing) => Array.from(new Set([...existing, ...newlyVotedIds])));

      newlyVotedIds.forEach((id) => {
        const duration = flightDurations[id] ?? 700;
        const timeoutId = window.setTimeout(() => {
          setTossingChipIds((existing) => existing.filter((votedId) => votedId !== id));

          setImpactFx(true);
          if (impactTimeoutRef.current) {
            window.clearTimeout(impactTimeoutRef.current);
          }
          impactTimeoutRef.current = window.setTimeout(() => {
            setImpactFx(false);
            impactTimeoutRef.current = null;
          }, 170);

          if (soundEnabled) {
            const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              const pitchOffset = ((hashFromId(`${id}-impact`) % 19) - 9) * 2;

              osc.connect(gain);
              gain.connect(ctx.destination);

              const now = ctx.currentTime;
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(170 + pitchOffset, now);
              osc.frequency.exponentialRampToValueAtTime(Math.max(95, 110 + pitchOffset * 0.45), now + 0.06);
              gain.gain.setValueAtTime(0.001, now);
              gain.gain.exponentialRampToValueAtTime(0.04, now + 0.016);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
              osc.start(now);
              osc.stop(now + 0.115);

              osc.onended = () => {
                void ctx.close();
              };
            }
          }
        }, duration + 20);
        tossTimeoutsRef.current.push(timeoutId);
      });
    }

    prevVoteByIdRef.current = participantsOnly.reduce<Record<string, string | null>>((acc, participant) => {
      acc[participant.id] = participant.vote;
      return acc;
    }, {});
  }, [room, room?.revealed, soundEnabled]);

  useEffect(() => {
    if (!room) return;

    const votedIds = room.participants
      .filter((p) => (p.role ?? 'participant') === 'participant' && p.hasVoted && p.vote !== null)
      .map((p) => p.id);

    setChipLandingClassById((current) => {
      const next: Record<string, string> = {};
      const usedClasses = new Set<string>();

      votedIds.forEach((id) => {
        if (current[id]) {
          next[id] = current[id];
          usedClasses.add(current[id]);
          return;
        }

        const available = CHIP_LANDING_CLASSES.filter((landingClass) => !usedClasses.has(landingClass));
        const pool = available.length > 0 ? available : CHIP_LANDING_CLASSES;
        const randomIndex = Math.floor(Math.random() * pool.length);
        next[id] = pool[randomIndex];
        usedClasses.add(next[id]);
      });

      return next;
    });
  }, [room]);

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  );

  const participantsOnly = room.participants.filter((p) => (p.role ?? 'participant') === 'participant');
  const hostParticipantId = room.hostId ?? room.participants[0]?.id ?? null;
  const meRole = me?.role ?? 'participant';
  const canVote = meRole === 'participant';
  const canRevealCards = me?.id === hostParticipantId;
  const votes = participantsOnly.filter((p) => p.vote !== null).map((p) => p.vote as string);
  const revealDisabledReason = !canRevealCards
    ? 'Only the session creator can reveal cards.'
    : votes.length === 0
      ? 'Cast at least one vote to enable reveal.'
      : null;
  const readyCount = participantsOnly.filter((p) => p.hasVoted).length;
  const votedParticipants = participantsOnly.filter((p) => p.hasVoted && p.vote !== null);
  const meParticipant = room.participants.find((p) => p.id === me?.id) ?? null;
  const otherSeatedParticipants = room.participants.filter((p) => p.id !== me?.id);
  const seatedParticipants = (() => {
    if (!meParticipant) return otherSeatedParticipants;
    const arranged = [...otherSeatedParticipants];
    const middleIndex = Math.floor(arranged.length / 2);
    arranged.splice(middleIndex, 0, meParticipant);
    return arranged;
  })();
  const url = buildRoomUrl(room.id);

  function playTone(type: 'vote' | 'reveal') {
    if (!soundEnabled) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'vote') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(430, now);
      osc.frequency.linearRampToValueAtTime(640, now + 0.18);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.27);
    }

    osc.onended = () => {
      void ctx.close();
    };
  }

  function handleVote(card: string) {
    playTone('vote');
    vote(card);
  }

  function handleReveal() {
    if (!canRevealCards || revealKickoff || room?.revealed) return;
    playTone('reveal');
    setRevealKickoff(true);
    revealKickoffTimeoutRef.current = window.setTimeout(() => {
      reveal();
      setRevealKickoff(false);
      revealKickoffTimeoutRef.current = null;
    }, 180);
  }

  function copyLink() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }

  function openExitPrompt() {
    setExitPromptOpen(true);
  }

  function confirmExit() {
    setExitPromptOpen(false);
    navigate('/');
  }

  return (
    <div className="game-shell h-dvh overflow-hidden flex flex-col fixed inset-0 bg-[#1a1a1a]">
      {/* Header */}
      <header className="game-topbar sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border border-[#d9ebd4]/40 text-white hover:bg-[#2d6623] transition-colors"
            >
              <ArrowLeft size={14} />
              <span className="text-xs font-semibold">Back</span>
            </button>
            <div>
              <p className="text-xs text-[#d9ebd4] uppercase tracking-wide">Poker Table</p>
              <h1 className="font-bold text-white text-sm">{room.sessionName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-[#d9ebd4] font-mono">{url}</span>
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border border-[#d9ebd4]/40 text-white hover:bg-[#2d6623] transition-colors"
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="text-xs font-semibold hidden sm:inline">Sound</span>
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 bg-[#FFDE00] hover:bg-[#f0d100] text-[#1f1f1f] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy size={13} />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 py-3">
        <section className="game-table-shell relative rounded-[42px] p-4 sm:p-5 h-full overflow-hidden">
          <div className="absolute inset-3 rounded-[34px] border border-[#d9ebd4] pointer-events-none" />

          <div className="game-table-felt relative z-10 h-full flex flex-col overflow-hidden">
            <div className="game-chip-rack" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, chipIndex) => (
                <span key={`rack-chip-${chipIndex}`} className="game-rack-chip" />
              ))}
            </div>

            <div className="text-center mb-3">
              <p className="text-xs tracking-[0.14em] uppercase text-[#d9ebd4]">Planning Table</p>
              <p className="text-sm text-[#edf5e8] mt-1">
                {canVote
                  ? (me?.hasVoted ? `You selected ${me.vote}. Choose again to update.` : 'Select a card to submit your estimate.')
                  : 'You are observing this session. Voting is disabled.'}
              </p>
            </div>

            {!canVote && (
              <div className="max-w-xl mx-auto mb-5 rounded-lg border border-[#d9ebd4]/70 bg-[#1a5730] px-4 py-2.5 text-center text-xs text-[#edf5e8]">
                Observer mode: you can follow the session in real time, but voting controls are disabled.
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
              <div className="game-stat-card rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#d9ebd4]">Round</p>
                <p className="text-sm font-semibold text-white">{room.roundNumber ?? 1}</p>
              </div>
              <div className="game-stat-card rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#d9ebd4]">Ready</p>
                <p className="text-sm font-semibold text-white">{readyCount}/{participantsOnly.length}</p>
              </div>
              <div className="game-stat-card rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#d9ebd4]">Your Mode</p>
                <p className="text-sm font-semibold text-white capitalize">{meRole}</p>
              </div>
              <div className="game-stat-card rounded-lg px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-[#d9ebd4]">Scale</p>
                <p className="text-sm font-semibold text-white">{room.scale.name}</p>
              </div>
              <button
                type="button"
                disabled={!canVote}
                onClick={() => setAutoReveal(!(room.autoReveal ?? false))}
                className="game-stat-card rounded-lg px-3 py-2 text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <p className="text-[10px] uppercase tracking-wide text-[#d9ebd4]">Auto reveal</p>
                <p className="text-sm font-semibold text-white">{(room.autoReveal ?? false) ? 'On' : 'Off'}</p>
              </button>
            </div>

            <div ref={landingZoneRef} className={`chip-landing-zone relative mx-auto mb-4 min-h-[90px] w-full max-w-3xl rounded-[999px] border border-[#d9ebd4]/35 bg-[#1a5730]/25 ${impactFx ? 'chip-landing-impact' : ''}`}>
              {votedParticipants.map((p) => {
                const Icon = getRandomIcon(p.iconIndex);
                const chip = getChipThemeByIndex(p.chipThemeIndex);
                const chipFlight = chipFlightById[p.id];
                const tossClass = tossingChipIds.includes(p.id)
                  ? 'chip-toss-from-seat'
                  : '';
                const landingClass = chipLandingClassById[p.id] ?? CHIP_LANDING_CLASSES[0];
                const tossStyle = chipFlight
                  ? {
                    ['--chip-start-x' as const]: `${chipFlight.x}px`,
                    ['--chip-start-y' as const]: `${chipFlight.y}px`,
                    ['--chip-start-rotate' as const]: `${chipFlight.rotate}deg`,
                    ['--chip-arc-height' as const]: `${chipFlight.arc}px`,
                    ['--chip-flight-duration' as const]: `${chipFlight.duration}ms`,
                    ['--chip-spin' as const]: `${chipFlight.spin}deg`,
                    ['--chip-sway' as const]: `${chipFlight.sway}px`,
                  } as CSSProperties
                  : undefined;
                return (
                  <div
                    key={p.id}
                    ref={(node) => {
                      chipTargetRefs.current[p.id] = node;
                    }}
                    className={`absolute ${landingClass}`}
                    title="Voted chip"
                  >
                    <div className={`w-12 h-12 rounded-full ${tossClass}`} style={tossStyle}>
                      <span className="casino-chip w-full h-full flex items-center justify-center" style={{ ['--chip-edge' as const]: chip.outer, ['--chip-main' as const]: chip.ring, ['--chip-inner' as const]: chip.inner, ['--chip-mark' as const]: chip.icon } as CSSProperties}>
                        <span className="casino-chip-core w-7 h-7 flex items-center justify-center">
                          <Icon size={14} style={{ color: chip.icon }} />
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`mx-auto max-w-4xl border-2 border-[#d9ebd4]/75 bg-[#14532d] rounded-2xl p-4 sm:p-5 ${revealFx ? 'table-reveal-flash' : ''}`}>
              {!room.revealed && canVote && (
                <div className={`game-card-fan flex flex-wrap justify-center gap-3 ${revealKickoff ? 'reveal-fan-out' : ''}`}>
                  {room.scale.cards.map((card) => {
                    const selected = me?.vote === card;
                    const isRedCard = card === '?' || card === '☕';
                    const centerGlyph = card === '☕' ? '♣' : (isRedCard ? '♥' : '♠');
                    return (
                      <button
                        key={card}
                        onClick={() => handleVote(card)}
                        className={`game-vote-card relative w-16 h-24 rounded-lg border-2 transition-all select-none shadow-[0_7px_14px_rgba(0,0,0,0.28)] overflow-hidden
                          ${selected
                            ? 'game-vote-card-selected border-[#FFDE00] bg-[#fffdf3] scale-110 ring-2 ring-[#FFDE00]/60'
                            : 'border-[#e8e8e8] bg-white hover:border-[#cbb66e] hover:-translate-y-1'
                          }`}
                        aria-label={`Vote ${card}`}
                      >
                        <span className="absolute inset-[2px] rounded-md border border-[#f2f2f2]" />

                        <span className={`absolute top-1 left-1 text-[11px] leading-none font-extrabold ${isRedCard ? 'text-[#b22222]' : 'text-[#1d1d1d]'}`}>
                          {card}
                        </span>
                        <span className={`absolute top-4 left-1 text-[8px] leading-none ${isRedCard ? 'text-[#b22222]' : 'text-[#1d1d1d]'}`}>
                          {centerGlyph}
                        </span>

                        <span className={`absolute bottom-1 right-1 text-[11px] leading-none font-extrabold rotate-180 ${isRedCard ? 'text-[#b22222]' : 'text-[#1d1d1d]'}`}>
                          {card}
                        </span>
                        <span className={`absolute bottom-4 right-1 text-[8px] leading-none rotate-180 ${isRedCard ? 'text-[#b22222]' : 'text-[#1d1d1d]'}`}>
                          {centerGlyph}
                        </span>

                        <span className={`text-xl font-black ${isRedCard ? 'text-[#b22222]' : 'text-[#1d1d1d]'}`}>
                          {centerGlyph}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!room.revealed && !canVote && (
                <div className="text-center py-6">
                  <p className="text-sm text-[#edf5e8]">Observers can watch votes and revealed results in real time.</p>
                </div>
              )}

              {room.revealed && (
                <div className={`reveal-content-shell ${revealContentReady ? 'reveal-content-ready' : 'reveal-content-staged'}`}>
                  <ResultsPanel votes={votes} scale={room.scale.cards} onClose={resetVotes} embedded />
                </div>
              )}
            </div>

            <div className="game-seat-rail mx-auto max-w-4xl mt-2 px-2 sm:px-3">
              <div className="w-full flex items-start justify-between gap-1.5 sm:gap-2">
                {seatedParticipants.length > 0 ? (
                  seatedParticipants.map((p, index) => (
                    <div
                      key={p.id}
                      className={`flex-1 min-w-0 max-w-[170px] flex flex-col items-center gap-1 transform transition-transform ${seatArcOffsetClass(index, seatedParticipants.length)}`}
                    >
                      {(() => {
                        const Icon = getRandomIcon(p.iconIndex);
                        const chip = getChipThemeByIndex(p.chipThemeIndex);
                        const totalChips = Math.max(1, p.chips ?? 3);
                        const visibleTotalChips = totalChips;
                        const rowThemes = [
                          { outer: chip.outer, ring: chip.ring, inner: chip.inner, icon: chip.icon },
                          { outer: '#23254a', ring: '#4dbec5', inner: '#245b7a', icon: '#9ee8ef' },
                          { outer: '#4a311d', ring: '#d89132', inner: '#9a5421', icon: '#ffd38f' },
                          { outer: '#3f2046', ring: '#cf5dbf', inner: '#7a2c71', icon: '#f0b8ea' },
                          { outer: '#2f3a1b', ring: '#9ac64d', inner: '#4f6a1f', icon: '#dff0ac' },
                          { outer: '#4a1f29', ring: '#e06c7f', inner: '#8f2e42', icon: '#ffc0cb' },
                        ];

                        const fullBaseChipCount = Math.min(5, visibleTotalChips);
                        const isChipCommittedThisRound = p.hasVoted && !room.revealed;
                        const baseChipCount = isChipCommittedThisRound ? Math.max(1, fullBaseChipCount - 1) : fullBaseChipCount;
                        const stackWidth = 120;
                        const baseLeadOffset = Math.max(0, (5 - baseChipCount) * 4) + Math.floor((stackWidth - 68) / 2);
                        const baseChipOffsets = Array.from({ length: baseChipCount }, (_, chipIndex) => baseLeadOffset + chipIndex * 9);

                        const bonusChips = Math.max(0, visibleTotalChips - 5);
                        const bonusLayerCount = Math.ceil(bonusChips / 5);
                        const bonusAreaTop = 75;
                        const pilesPerRow = 3;
                        const pileGap = 4;
                        const pileWidth = 48;
                        const bonusPileCount = bonusLayerCount;
                        const bonusRowCount = Math.max(0, Math.ceil(bonusPileCount / pilesPerRow));
                        const bonusPiles = Array.from({ length: bonusPileCount }, (_, pileIndex) => {
                          const chipsInPile = Math.min(5, bonusChips - pileIndex * 5);
                          const rowIndex = Math.floor(pileIndex / pilesPerRow);
                          const colIndex = pileIndex % pilesPerRow;
                          const pilesInThisRow = Math.min(pilesPerRow, bonusPileCount - rowIndex * pilesPerRow);
                          const rowWidth = pilesInThisRow * pileWidth + Math.max(0, pilesInThisRow - 1) * pileGap;
                          const rowStartLeft = Math.floor((stackWidth - rowWidth) / 2);
                          const hue = (pileIndex * 57 + 20) % 360;
                          return {
                            top: bonusAreaTop + rowIndex * 70,
                            left: rowStartLeft + colIndex * (pileWidth + pileGap),
                            chipsInPile,
                            chipTheme: {
                              outer: `hsl(${hue} 42% 22%)`,
                              ring: `hsl(${hue} 74% 58%)`,
                              inner: `hsl(${hue} 56% 38%)`,
                              icon: `hsl(${hue} 86% 84%)`,
                            },
                          };
                        });
                        const stackHeight = Math.max(64, bonusAreaTop + bonusRowCount * 14 + 34);
                        const stackShadow = bonusLayerCount
                          ? `drop-shadow(0 ${2 + Math.min(bonusLayerCount, 8)}px ${7 + Math.min(bonusLayerCount, 8) * 2}px rgba(0,0,0,0.45))`
                          : 'drop-shadow(0 2px 7px rgba(0,0,0,0.35))';
                        return (
                          <>
                            <div
                              ref={(node) => {
                                seatAnchorRefs.current[p.id] = node;
                              }}
                              className="flex flex-col items-center gap-0.5 min-w-0"
                            >
                              <span className="relative inline-block shrink-0" style={{ width: `${stackWidth}px`, height: `${stackHeight}px`, filter: stackShadow }}>
                                {baseChipOffsets.map((left, chipIndex) => {
                                  const isFrontChip = chipIndex === baseChipOffsets.length - 1;
                                  return (
                                    <span
                                      key={`${p.id}-seat-chip-base-${chipIndex}`}
                                    className="absolute top-[14px] w-12 h-12"
                                    style={{ left: `${left}px` }}
                                  >
                                    <span className="casino-chip w-full h-full flex items-center justify-center" style={{ ['--chip-edge' as const]: rowThemes[0].outer, ['--chip-main' as const]: rowThemes[0].ring, ['--chip-inner' as const]: rowThemes[0].inner, ['--chip-mark' as const]: rowThemes[0].icon } as CSSProperties}>
                                      <span className="casino-chip-core w-7 h-7 flex items-center justify-center">
                                        {isFrontChip && <Icon size={14} style={{ color: rowThemes[0].icon }} />}
                                        </span>
                                      </span>
                                    </span>
                                  );
                                })}

                                {bonusPiles.map((pile, pileIndex) => (
                                  Array.from({ length: pile.chipsInPile }, (_, chipIndex) => {
                                    const isTopChip = chipIndex === pile.chipsInPile - 1;
                                    return (
                                      <span
                                        key={`${p.id}-seat-chip-bonus-${pileIndex}-${chipIndex}`}
                                        className="absolute w-12 h-12 opacity-95"
                                        style={{ top: `${pile.top - chipIndex * 2}px`, left: `${pile.left}px` }}
                                      >
                                        <span className="casino-chip w-full h-full flex items-center justify-center" style={{ ['--chip-edge' as const]: pile.chipTheme.outer, ['--chip-main' as const]: pile.chipTheme.ring, ['--chip-inner' as const]: pile.chipTheme.inner, ['--chip-mark' as const]: pile.chipTheme.icon } as CSSProperties}>
                                          <span className="casino-chip-core w-7 h-7 flex items-center justify-center">
                                            {isTopChip && <Icon size={14} style={{ color: pile.chipTheme.icon }} />}
                                          </span>
                                        </span>
                                      </span>
                                    );
                                  })
                                ))}
                              </span>
                              <span className="text-[11px] font-medium text-[#edf5e8]/90 text-center leading-tight truncate max-w-[96px]">
                                {p.name}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))
                ) : (
                  <span className="mx-auto text-[11px] text-[#d9ebd4]/80">No participants seated yet</span>
                )}
              </div>
            </div>

            <div className="game-command-dock mt-3 flex flex-wrap items-center justify-center gap-3">
              {!room.revealed && canVote && (
                <>
                  <button
                    onClick={handleReveal}
                    disabled={Boolean(revealDisabledReason) || revealKickoff}
                    title={revealDisabledReason ?? 'Reveal cards'}
                    className="game-mini-button game-mini-button-reveal disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Reveal
                  </button>
                  <button
                    onClick={openExitPrompt}
                    className="game-mini-button game-mini-button-exit cursor-pointer"
                  >
                    Exit
                  </button>
                </>
              )}
              {room.revealed && canVote && (
                <>
                  <button
                    onClick={resetVotes}
                    className="game-action-secondary flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <RotateCcw size={16} />
                    New round
                  </button>
                  <button
                    onClick={openExitPrompt}
                    className="game-mini-button game-mini-button-exit cursor-pointer"
                  >
                    Exit
                  </button>
                </>
              )}
            </div>

            {!room.revealed && canVote && revealDisabledReason && (
              <p className="mt-3 text-center text-xs text-[#d9ebd4]/85">
                {revealDisabledReason}
              </p>
            )}

            {exitPromptOpen && (
              <div className="game-exit-overlay" role="presentation" onClick={() => setExitPromptOpen(false)}>
                <div
                  className="game-exit-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="exit-dialog-title"
                  aria-describedby="exit-dialog-description"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="game-exit-kicker">Leave the table?</p>
                  <h2 id="exit-dialog-title" className="game-exit-title">Exit this room</h2>
                  <p id="exit-dialog-description" className="game-exit-copy">
                    You’ll leave the match and return to the lobby.
                  </p>

                  <div className="game-exit-actions">
                    <button type="button" className="game-exit-cancel" onClick={() => setExitPromptOpen(false)}>
                      Stay seated
                    </button>
                    <button type="button" className="game-exit-confirm" onClick={confirmExit}>
                      Exit room
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
