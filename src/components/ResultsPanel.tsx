import { calcAverage, voteDistribution } from '../utils';
import { X } from 'lucide-react';

interface Props {
  votes: string[];
  scale: string[];
  onClose?: () => void;
  embedded?: boolean;
}

export function ResultsPanel({ votes, scale, onClose, embedded = false }: Props) {
  const avg = calcAverage(votes);
  const dist = voteDistribution(votes);
  const max = Math.max(...Object.values(dist));
  const distinctCards = Object.keys(dist).length;
  const numericVotes = votes.map(Number).filter((n) => !Number.isNaN(n));
  const spread = numericVotes.length > 1 ? Math.max(...numericVotes) - Math.min(...numericVotes) : 0;
  const modalVotes = max || 0;
  const outliers = votes.length > 0 ? Math.max(0, votes.length - modalVotes) : 0;

  let consensusLevel = 'Low';
  if (votes.length > 0 && modalVotes === votes.length) consensusLevel = 'High';
  else if (votes.length > 0 && modalVotes / votes.length >= 0.6) consensusLevel = 'Medium';

  const badges: string[] = [];
  if (votes.length > 1 && max === votes.length) badges.push('Perfect consensus');
  if (votes.length > 1 && max < votes.length && distinctCards <= 2) badges.push('Near consensus');
  if (spread >= 8 || distinctCards >= 4) badges.push('Wide spread');
  if ((dist['☕'] ?? 0) > 0) badges.push('Coffee break vote');

  const shellClass = embedded
    ? 'space-y-3.5 reveal-surface'
    : 'bg-[#f5faef] border border-[#d8e6d3] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 reveal-surface';
  const titleClass = embedded ? 'font-semibold text-[#edf5e8]' : 'font-semibold text-[#1f3f26]';
  const votesClass = embedded ? 'text-sm text-[#d9ebd4]' : 'text-sm text-[#4f6955]';
  const closeButtonClass = embedded
    ? 'h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#d9ebd4]/50 text-[#edf5e8] hover:bg-[#1f5b33] transition-colors'
    : 'h-7 w-7 inline-flex items-center justify-center rounded-md border border-[#c5d7bf] text-[#33513a] hover:bg-white transition-colors';

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between">
        <h3 className={titleClass}>Revealed Results</h3>
        <div className="flex items-center gap-2">
          <span className={votesClass}>{votes.length} vote{votes.length !== 1 ? 's' : ''}</span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close revealed results"
              className={closeButtonClass}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="text-center bg-white rounded-xl border border-[#d8e6d3] py-3">
        <p className="text-xs text-[#4f6955] uppercase tracking-wide mb-1">Average</p>
        <p className="text-4xl font-black text-[#367C2B]">{avg}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#d8e6d3] bg-white px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[#5a735f]">Consensus</p>
          <p className="text-sm font-semibold text-[#2f5f38]">{consensusLevel}</p>
        </div>
        <div className="rounded-lg border border-[#d8e6d3] bg-white px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[#5a735f]">Spread</p>
          <p className="text-sm font-semibold text-[#2f5f38]">{numericVotes.length > 0 ? spread : '—'}</p>
        </div>
        <div className="rounded-lg border border-[#d8e6d3] bg-white px-3 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[#5a735f]">Outliers</p>
          <p className="text-sm font-semibold text-[#2f5f38]">{outliers}</p>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {badges.map((badge) => (
            <span key={badge} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e3f0dd] text-[#2f5f38] border border-[#cde2c5]">
              {badge}
            </span>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-wide text-[#5a735f] text-center mb-1.5">Votes by card</p>
        <div className="flex flex-nowrap gap-1.5">
          {scale.map((card) => {
            const count = dist[card] ?? 0;
            return (
              <div key={card} className="flex-1 min-w-0 rounded-lg border border-[#d8e6d3] bg-white px-1 py-1 text-center">
                <p className="text-[11px] font-mono font-semibold text-[#33513a] leading-tight">{card}</p>
                <p className="text-xs font-semibold text-[#2f5f38] leading-tight">{count}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
