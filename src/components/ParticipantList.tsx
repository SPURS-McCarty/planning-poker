import { Bot, Check, Heart, Leaf, Rocket, Shield, Star, User, Zap } from 'lucide-react';
import type { Participant } from '../types';

interface Props {
  participants: Participant[];
  revealed: boolean;
}

const PARTICIPANT_ICONS = [User, Star, Shield, Rocket, Leaf, Zap, Bot, Heart];
const CHIP_THEME_COUNT = 8;
const CHIP_GLOW_CLASSES = [
  'border-[#ffde00]/45 shadow-[0_0_0_1px_rgba(255,222,0,0.22),0_0_12px_rgba(255,222,0,0.16)]',
  'border-[#ff8f4a]/45 shadow-[0_0_0_1px_rgba(255,143,74,0.22),0_0_12px_rgba(255,143,74,0.16)]',
  'border-[#62b3ff]/45 shadow-[0_0_0_1px_rgba(98,179,255,0.22),0_0_12px_rgba(98,179,255,0.16)]',
  'border-[#d88cff]/45 shadow-[0_0_0_1px_rgba(216,140,255,0.22),0_0_12px_rgba(216,140,255,0.16)]',
  'border-[#9ddf51]/45 shadow-[0_0_0_1px_rgba(157,223,81,0.22),0_0_12px_rgba(157,223,81,0.16)]',
  'border-[#f7c35f]/45 shadow-[0_0_0_1px_rgba(247,195,95,0.22),0_0_12px_rgba(247,195,95,0.16)]',
  'border-[#ff6f6f]/45 shadow-[0_0_0_1px_rgba(255,111,111,0.22),0_0_12px_rgba(255,111,111,0.16)]',
  'border-[#65d8d4]/45 shadow-[0_0_0_1px_rgba(101,216,212,0.22),0_0_12px_rgba(101,216,212,0.16)]',
];
const CHIP_ICON_CLASSES = [
  'bg-[#2f6f2b] border-[#ffde00] text-[#fff6bf]',
  'bg-[#8f3b2d] border-[#ff8f4a] text-[#ffe3d3]',
  'bg-[#2f5b8f] border-[#62b3ff] text-[#d9ecff]',
  'bg-[#70378f] border-[#d88cff] text-[#f2ddff]',
  'bg-[#477f2f] border-[#9ddf51] text-[#e7f7d3]',
  'bg-[#8f662f] border-[#f7c35f] text-[#ffefd2]',
  'bg-[#8f2f2f] border-[#ff6f6f] text-[#ffdede]',
  'bg-[#2b7d79] border-[#65d8d4] text-[#dcf9f8]',
];

function hashFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function iconForParticipant(id: string, rosterIds?: string[]) {
  if (rosterIds && rosterIds.length > 0) {
    const orderedUnique = Array.from(new Set(rosterIds)).sort();
    const ordinal = orderedUnique.indexOf(id);
    if (ordinal >= 0) {
      return PARTICIPANT_ICONS[ordinal % PARTICIPANT_ICONS.length];
    }
  }
  return PARTICIPANT_ICONS[hashFromId(id) % PARTICIPANT_ICONS.length];
}

function chipThemeIndexForParticipant(id: string, rosterIds?: string[]) {
  if (rosterIds && rosterIds.length > 0) {
    const orderedUnique = Array.from(new Set(rosterIds)).sort();
    const ordinal = orderedUnique.indexOf(id);
    if (ordinal >= 0) {
      return ordinal % CHIP_THEME_COUNT;
    }
  }
  return hashFromId(id) % CHIP_THEME_COUNT;
}

export function ParticipantList({ participants, revealed }: Props) {
  const rosterIds = participants.map((p) => p.id);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
      {participants.map((p) => {
        const Icon = iconForParticipant(p.id, rosterIds);
        const themeIndex = chipThemeIndexForParticipant(p.id, rosterIds);
        const glowClass = CHIP_GLOW_CLASSES[themeIndex];
        const iconClass = CHIP_ICON_CLASSES[themeIndex];
        return (
          <div
            key={p.id}
            className={`flex items-center justify-between bg-white border rounded-lg px-2.5 py-1.5 ${glowClass}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${iconClass}`}>
                <Icon size={12} />
              </div>
              <span className="text-xs font-semibold text-slate-700 truncate">{p.name}</span>
              {(p.role ?? 'participant') === 'observer' && (
                <span className="text-[9px] font-semibold tracking-wide px-1 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">OBS</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(p.role ?? 'participant') === 'observer' ? (
                <span className="text-slate-400 text-xs">Observer</span>
              ) : p.hasVoted ? (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                  <Check size={12} /> Voted
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Waiting…</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
