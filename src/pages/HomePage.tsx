import { useState } from 'react';
import { ScalePicker } from '../components/ScalePicker';
import { BUILT_IN_SCALES } from '../types';
import type { UserRole } from '../types';
import { generateId, saveRoom, generateParticipantId, customScaleFromInput } from '../utils';
import { FolderPlus, Hand, Users, Eye } from 'lucide-react';

const STEPS = ['Name your session', 'Pick a scale'];
const toAppPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [sessionName, setSessionName] = useState('');
  const [yourName, setYourName] = useState('');
  const [sessionTouched, setSessionTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [role, setRole] = useState<UserRole>('participant');
  const [scaleId, setScaleId] = useState('fibonacci');
  const [customInput, setCustomInput] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState('');

  const sessionNameInvalid = sessionTouched && !sessionName.trim();
  const yourNameInvalid = nameTouched && !yourName.trim();

  function handleCreate() {
    if (!sessionName.trim()) { setError('Please enter a session name.'); return; }
    if (!yourName.trim()) { setNameTouched(true); setError('Please enter your name.'); return; }

    const scale =
      scaleId === 'custom'
        ? customScaleFromInput(customInput)
        : BUILT_IN_SCALES.find((s) => s.id === scaleId)!;

    if (scaleId === 'custom' && scale.cards.length < 3) {
      setError('Please enter at least 2 custom card values.');
      return;
    }

    const roomId = generateId();
    const meId = generateParticipantId();
    const randomIconIndex = Math.floor(Math.random() * 8);
    const randomChipThemeIndex = Math.floor(Math.random() * 8);

    const newRoom = {
      id: roomId,
      sessionName: sessionName.trim(),
      hostId: meId,
      scale,
      participants: [{ id: meId, name: yourName.trim(), role, chips: 3, vote: null, hasVoted: false, iconIndex: randomIconIndex, chipThemeIndex: randomChipThemeIndex }],
      revealed: false,
      roundNumber: 1,
      autoReveal: false,
      currentIssue: '',
    };

    saveRoom(newRoom);
    sessionStorage.setItem(`pp_me_${roomId}`, meId);
    sessionStorage.setItem(`pp_me_name_${roomId}`, yourName.trim());
    sessionStorage.setItem(`pp_me_role_${roomId}`, role);
    window.location.assign(toAppPath(`room/${roomId}`));
  }

  function handleJoinByCode() {
    const normalized = joinRoomId.trim().toUpperCase();
    if (!normalized) {
      setError('Enter a room code to join an existing session.');
      return;
    }
    window.location.assign(toAppPath(`join/${normalized}`));
  }

  return (
    <div className="relative h-dvh bg-gradient-to-br from-[#f4f8ee] to-[#fffbe6] overflow-hidden">
      {/* Hero */}
      <div className="relative z-20 h-full max-w-5xl mx-auto px-5 sm:px-6 py-5 sm:py-7 text-center flex flex-col justify-center">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#367C2B] uppercase mb-4">Agile Estimation Workspace</p>
        <div className="mb-3 inline-flex items-center justify-center gap-3 sm:gap-4">
          <img
            src={`${import.meta.env.BASE_URL}corner-badge-cutout.png`}
            alt="Planning poker badge"
            className="pointer-events-none select-none w-24 sm:w-28 md:w-32 -rotate-6 mix-blend-multiply contrast-110 saturate-110"
          />
          <h1 className="text-3xl sm:text-4xl font-black text-[#1f1f1f] leading-tight text-center">
            Poker Planning<br />
            <span className="text-[#367C2B]">for agile teams</span>
          </h1>
        </div>
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-5 lg:items-stretch text-left w-full">
          {/* How it works */}
          <div className="hidden lg:flex flex-col gap-3 h-full">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">How it works</p>
            <div className="grid gap-3 lg:grid-rows-4 flex-1">
              {[
                { icon: FolderPlus, title: 'Create a room', body: 'Pick a scale, name your session, and share the link.' },
                { icon: Hand, title: 'Pick your cards', body: 'Everyone joins and selects an estimate privately.' },
                { icon: Users, title: 'Vote simultaneously', body: 'See who has voted — not what they picked.' },
                { icon: Eye, title: 'Reveal & discuss', body: 'All cards flip at once. Discuss and re-vote if needed.' },
              ].map((s) => (
                <div key={s.title} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 h-full flex flex-col justify-start">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#367C2B] text-white flex items-center justify-center">
                      <s.icon size={16} strokeWidth={2.25} />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm leading-tight">{s.title}</p>
                  </div>
                  <p className="text-sm text-slate-600 leading-snug">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Create room card */}
          <div className="flex flex-col gap-4 h-full">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Start A Session</p>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-7 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${i <= step ? 'bg-[#367C2B] text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 transition-colors ${i < step ? 'bg-[#FFDE00]' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">{STEPS[step]}</h2>
            <p className="text-sm text-slate-500 mb-3">Set up your room details and invite your team in seconds.</p>

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Session name</label>
                    <input
                      autoFocus
                      type="text"
                      value={sessionName}
                      onChange={(e) => { setSessionName(e.target.value); setError(''); }}
                      onBlur={() => setSessionTouched(true)}
                      placeholder="Sprint 42 Planning"
                      className={`w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-800 shadow-sm transition-colors focus:outline-none focus:ring-0 ${
                        sessionNameInvalid ? 'border-red-400' : 'border-slate-300 focus:border-[#367C2B]'
                      }`}
                    />
                    <p className={`text-xs mt-1 ${sessionNameInvalid ? 'text-red-500' : 'text-slate-500'}`}>
                      {sessionNameInvalid ? 'Session name is required.' : 'Visible to everyone in the room.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
                    <input
                      type="text"
                      value={yourName}
                      onChange={(e) => { setYourName(e.target.value); setError(''); }}
                      onBlur={() => setNameTouched(true)}
                      placeholder="Alice"
                      className={`w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-800 shadow-sm transition-colors focus:outline-none focus:ring-0 ${
                        yourNameInvalid ? 'border-red-400' : 'border-slate-300 focus:border-[#367C2B]'
                      }`}
                    />
                    <p className={`text-xs mt-1 ${yourNameInvalid ? 'text-red-500' : 'text-slate-500'}`}>
                      {yourNameInvalid ? 'Your name is required.' : 'Displayed to participants in the room.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Join as</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('participant')}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          role === 'participant'
                            ? 'border-[#367C2B] bg-[#eef7eb] text-[#1f3f26]'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Participant
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('observer')}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          role === 'observer'
                            ? 'border-[#367C2B] bg-[#eef7eb] text-[#1f3f26]'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Observer
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Participants vote. Observers can watch without voting.</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <ScalePicker
                    selectedId={scaleId}
                    onSelect={setScaleId}
                    customInput={customInput}
                    onCustomInput={setCustomInput}
                  />
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100">
              {step === 0 && (
                <button
                  onClick={() => {
                    setError('');
                    setSessionTouched(true);
                    if (!sessionName.trim()) {
                      setError('Please enter a session name.');
                      return;
                    }
                    setStep(1);
                  }}
                  className="w-full bg-[#367C2B] hover:bg-[#2d6623] text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Continue
                </button>
              )}

              {step === 1 && (
                <div className="flex gap-3">
                  <button onClick={() => setStep(0)} className="flex-1 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    className="flex-1 bg-[#367C2B] hover:bg-[#2d6623] text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Create Room
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100">
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-500 mb-2">Already have a room code?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => { setJoinRoomId(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                  placeholder="e.g. 74HHY6"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 shadow-sm transition-colors focus:outline-none focus:ring-0 focus:border-[#367C2B] uppercase"
                />
                <button
                  type="button"
                  onClick={handleJoinByCode}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
