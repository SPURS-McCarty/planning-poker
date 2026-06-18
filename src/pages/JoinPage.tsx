import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../RoomContext';
import { loadRoom } from '../utils';
import type { Room, UserRole } from '../types';
import PartySocket from 'partysocket';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';
const toAppPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export default function JoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { joinRoom } = useRoom();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('participant');
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState('');
  const [remoteRoom, setRemoteRoom] = useState<Room | null>(() => roomId ? loadRoom(roomId) : null);

  // Fetch room state from PartyKit if not in localStorage
  useEffect(() => {
    if (!roomId || remoteRoom) return;
    const ws = new PartySocket({ host: PARTYKIT_HOST, room: roomId });
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { type: string; room?: Room };
      if (msg.type === 'room_state' && msg.room) {
        setRemoteRoom(msg.room);
        ws.close();
      }
    };
    // Timeout — room genuinely doesn't exist
    const t = setTimeout(() => ws.close(), 5000);
    return () => { clearTimeout(t); ws.close(); };
  }, [roomId]);

  function handleJoin() {
    if (!name.trim()) { setNameTouched(true); setError('Please enter your name.'); return; }
    if (!roomId) return;
    const ok = joinRoom(roomId, name.trim(), role, remoteRoom ?? undefined);
    if (!ok) { setError('Room not found. Check the link and try again.'); return; }
    window.location.assign(toAppPath(`room/${roomId}`));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f8ee] to-[#fffbe6] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Join Session</h1>
          {remoteRoom && (
            <p className="text-sm text-slate-600 mt-1">{remoteRoom.sessionName}</p>
          )}
          {!remoteRoom && (
            <p className="text-sm text-slate-400 mt-1">Loading room…</p>
          )}
        </div>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        {remoteRoom && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                onBlur={() => setNameTouched(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Alice"
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-800 shadow-sm transition-colors focus:outline-none focus:ring-0 ${
                  nameTouched && !name.trim() ? 'border-red-400' : 'border-slate-300 focus:border-[#367C2B]'
                }`}
              />
              <p className={`text-xs mt-2 ${nameTouched && !name.trim() ? 'text-red-500' : 'text-slate-500'}`}>
                {nameTouched && !name.trim() ? 'Your name is required to join.' : 'Your name will be visible to everyone in this room.'}
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
              <p className="text-xs text-slate-500 mt-2">
                Participants vote. Observers can watch the session without voting.
              </p>
            </div>

            <button
              onClick={handleJoin}
              className="w-full bg-[#367C2B] hover:bg-[#2d6623] text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Join Room
            </button>
          </div>
        )}
        {!remoteRoom && (
          <button
            onClick={() => window.location.assign(toAppPath(''))}
            className="w-full mt-4 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Create a new room
          </button>
        )}
      </div>
    </div>
  );
}
