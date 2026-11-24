// src/pages/CommunityPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar';
import CommunityDrawer from '../components/community/CommunityDrawer';
import QuickReportModal from '../components/community/QuickReportModal';
import SosModal from '../components/trip/SosModal';
import { useAuth } from '../context/useAuth';
import {
  fetchNearbyReports,
  fetchNearbySuggestions,
} from '../services/communityService';

const DEFAULT_FOCUS = { lat: 28.6139, lng: 77.209 };

export default function CommunityPage() {
  const navigate = useNavigate();
  const { emergencyContacts } = useAuth();

  const [coords, setCoords] = useState(DEFAULT_FOCUS);
  const [reports, setReports] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'report',
    coords: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  }, []);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reps, sugs] = await Promise.all([
        fetchNearbyReports({
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters: 5000,
          maxAgeHours: 48,
        }),
        fetchNearbySuggestions({
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters: 8000,
        }),
      ]);
      setReports(reps);
      setSuggestions(sugs);
    } finally {
      setIsLoading(false);
    }
  }, [coords.lat, coords.lng]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const modalCoords = useMemo(
    () => modalState.coords || coords,
    [modalState.coords, coords]
  );

  return (
    <div className="min-h-screen bg-[#fff7fa] text-slate-900">
      <TopBar onOpenSosModal={() => setSosOpen(true)} />

      <main className="mx-auto max-w-4xl p-4 py-6">
        <CommunityDrawer
          reports={reports}
          suggestions={suggestions}
          isLoading={isLoading}
          onRefresh={loadFeed}
          onOpenReportModal={(mode) =>
            setModalState({ isOpen: true, mode: mode || 'report', coords })
          }
          onStartMapPinReport={() => navigate('/navigate')}
          isPickingReportPin={false}
          onFocusLocation={(loc) => {
            if (loc?.lat && loc?.lng) {
              setCoords({ lat: loc.lat, lng: loc.lng });
              navigate('/navigate');
            }
          }}
          onReportVoted={loadFeed}
          onSuggestionHelpful={loadFeed}
        />
      </main>

      <QuickReportModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        initialMode={modalState.mode}
        initialCoords={modalCoords}
        onSubmitted={loadFeed}
      />

      <SosModal
        isOpen={sosOpen}
        onClose={() => setSosOpen(false)}
        emergencyContacts={emergencyContacts}
      />
    </div>
  );
}