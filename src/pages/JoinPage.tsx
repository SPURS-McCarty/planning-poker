import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../RoomContext';
import { loadRoom } from '../utils';
import type { Room, UserRole } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuth, hasFirebaseConfig } from '../firebase';

const ROOM_COLLECTION = 'planningPokerRooms';
const toAppPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

export default function JoinPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const normalizedRoomId = roomId?.trim().toUpperCase();
  const { joinRoom } = useRoom();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('participant');
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState('');
  const [remoteRoom, setRemoteRoom] = useState<Room | null>(() => normalizedRoomId ? loadRoom(normalizedRoomId) : null);

  // Fetch room state from Firestore if not in localStorage
  useEffect(() => {
    if (!normalizedRoomId || remoteRoom) return;

    let cancelled = false;

    const tryLocalFallback = () => {
      const localRoom = loadRoom(normalizedRoomId);
      if (localRoom) {
        setRemoteRoom(localRoom);
        return true;
      }
      return false;
    };

    const readFromFirestoreWithRetries = async () => {
      if (!db) return { status: 'unavailable' as const };
      const roomDoc = doc(db, ROOM_COLLECTION, normalizedRoomId);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 5000);
        });
        const snapshot = await Promise.race([getDoc(roomDoc), timeoutPromise]);
        if (snapshot === null) continue;
        if (snapshot.exists()) {
          return { status: 'found' as const, room: snapshot.data() as Room };
        }
        return { status: 'missing' as const };
      }

      return { status: 'timeout' as const };
    };

    void (async () => {
      if (!hasFirebaseConfig) {
        if (!cancelled && !tryLocalFallback()) {
          setError('Realtime is disabled in this deployment. Open this link in another tab of the same browser profile as the host, or create a new room in this browser.');
        }
        return;
      }

      try {
        const signedIn = await ensureFirebaseAuth();
        if (!signedIn) {
          if (!cancelled && !tryLocalFallback()) {
            setError('Unable to authenticate with realtime backend. Confirm Firebase Anonymous Auth is enabled.');
          }
          return;
        }

        const result = await readFromFirestoreWithRetries();
        if (cancelled) return;

        if (result.status === 'found') {
          setRemoteRoom(result.room);
          return;
        }

        if (tryLocalFallback()) return;

        if (result.status === 'missing') {
          setError('Room not found in realtime backend. Ask the creator to share a fresh link.');
          return;
        }

        setError('Unable to reach realtime backend. Check network access and Firestore rules, then try again.');
      } catch {
        if (!cancelled && !tryLocalFallback()) {
          setError('Unable to reach realtime backend. Check network access and Firestore rules, then try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedRoomId, remoteRoom]);

  function handleJoin() {
    if (!name.trim()) { setNameTouched(true); setError('Please enter your name.'); return; }
    if (!normalizedRoomId) return;
    const ok = joinRoom(normalizedRoomId, name.trim(), role, remoteRoom ?? undefined);
    if (!ok) { setError('Room not found. Check the link and try again.'); return; }
    window.location.assign(toAppPath(`room/${normalizedRoomId}`));
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
