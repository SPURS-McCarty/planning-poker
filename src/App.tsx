import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RoomProvider } from './RoomContext';
import HomePage from './pages/HomePage';
import JoinPage from './pages/JoinPage';
import RoomPage from './pages/RoomPage';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RoomProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/join/:roomId" element={<JoinPage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </RoomProvider>
    </BrowserRouter>
  );
}
