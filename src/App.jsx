// src/App.jsx
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import IntroLanding from './pages/IntroLanding';
import HomeNavigator from './pages/HomeNavigator';
import LiveTrackPublic from './pages/LiveTrackPublic';
import ProfileSafety from './pages/ProfileSafety';
import ShareTripModal from './components/trip/ShareTripModal';
import SosModal from './components/trip/SosModal';
import { useAuth } from './context/useAuth';
import CommunityPage from './pages/CommunityPage';

function LandingView() {
  const navigate = useNavigate();
  const { emergencyContacts } = useAuth();
  const [sosOpen, setSosOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <IntroLanding
        onNavigateToMap={() => navigate('/navigate')}
        onOpenSOS={() => setSosOpen(true)}
        onOpenLiveShare={() => setShareOpen(true)}
      />
      <SosModal
        isOpen={sosOpen}
        onClose={() => setSosOpen(false)}
        emergencyContacts={emergencyContacts}
      />
      <ShareTripModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        trip={null}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/intro" element={<Navigate to="/" replace />} />
        <Route path="/navigate" element={<HomeNavigator />} />
        <Route path="/app" element={<Navigate to="/navigate" replace />} />
        <Route path="/profile" element={<ProfileSafety />} />
        <Route path="/track/:shareToken" element={<LiveTrackPublic />} />
        <Route path="/live/:shareToken" element={<LiveTrackPublic />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/community" element={<CommunityPage/>} />
      </Routes>
    </BrowserRouter>
  );
}