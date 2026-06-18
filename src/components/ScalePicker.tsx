import { BUILT_IN_SCALES } from '../types';


interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  customInput: string;
  onCustomInput: (v: string) => void;
}

export function ScalePicker({ selectedId, onSelect, customInput, onCustomInput }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-700">Choose your estimation scale</h3>
      <div className="grid sm:grid-cols-3 gap-3 auto-rows-fr">
        {BUILT_IN_SCALES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`rounded-xl border-2 p-3 text-left transition-all duration-200 h-[116px] flex flex-col ${
              selectedId === s.id
              ? 'border-[#367C2B] bg-[#f4f8ee]'
              : 'border-slate-200 hover:border-[#FFDE00] bg-white'
            }`}
          >
            <p className="font-semibold text-sm text-slate-800">{s.name}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{s.description}</p>
            <p className="text-xs font-mono text-[#367C2B] mt-auto truncate">{s.cards.slice(0, 8).join(', ')}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect('custom')}
          className={`rounded-xl border-2 p-3 text-left transition-all duration-200 h-[116px] flex flex-col ${
            selectedId === 'custom'
              ? 'border-[#367C2B] bg-[#f4f8ee]'
              : 'border-slate-200 hover:border-[#FFDE00] bg-white'
          }`}
        >
          <p className="font-semibold text-sm text-slate-800">Custom</p>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">Build your own deck</p>
          <p className="text-xs font-mono text-[#367C2B] mt-auto truncate">Your values, ?, ☕</p>
        </button>
      </div>

      <div className="min-h-[86px]">
        <div className={selectedId === 'custom' ? '' : 'invisible pointer-events-none'}>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Card values <span className="text-slate-400 font-normal">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={customInput}
            onChange={(e) => onCustomInput(e.target.value)}
            placeholder="e.g. 1, 2, 4, 8, 16"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#367C2B]"
          />
        </div>
      </div>
    </div>
  );
}
