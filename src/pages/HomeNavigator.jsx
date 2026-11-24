// src/pages/HomeNavigator.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import MapCanvas from '../components/map/MapCanvas';
import RoutePlannerPanel from '../components/routing/RoutePlannerPanel';
import QuickReportModal from '../components/community/QuickReportModal';
import ActiveTripBanner from '../components/trip/ActiveTripBanner';
import ShareTripModal from '../components/trip/ShareTripModal';
import CheckInAlertModal from '../components/trip/CheckInAlertModal';
import SosModal from '../components/trip/SosModal';

import { useAuth } from '../context/useAuth';
import {
  calculateModeEtaMinutes,
  fetchCandidateRoutes,
  fetchSafetyPOIs,
  haversineMeters,
  reverseGeocode,
} from '../services/geoProvider';
import { rankRoutesBySafety } from '../services/safetyScorer';
import {
  fetchNearbyReports,
  fetchReportsAlongRoute,
} from '../services/communityService';
import {
  startTrackedTrip,
  updateTripLocation,
  renewTripCheckIn,
  setTripAlertStatus,
  endTrackedTrip,
} from '../services/tripService';

const DEFAULT_FOCUS = { lat: 28.6139, lng: 77.209, label: 'New Delhi' };

function computeRemainingMetersAlongRoute(route, currentPos, destination) {
  const totalDist = route?.distanceMeters || 0;
  if (!currentPos?.lat || !currentPos?.lng) return totalDist;

  if (destination?.lat && destination?.lng) {
    const directToDest = haversineMeters(
      currentPos.lat,
      currentPos.lng,
      destination.lat,
      destination.lng
    );
    const coords = route?.latLngCoords || [];
    if (coords.length > 1) {
      let minRouteDist = Infinity;
      let bestIdx = 0;
      for (let i = 0; i < coords.length; i++) {
        const d = haversineMeters(currentPos.lat, currentPos.lng, coords[i][0], coords[i][1]);
        if (d < minRouteDist) {
          minRouteDist = d;
          bestIdx = i;
        }
      }
      let tailDist = 0;
      for (let i = bestIdx; i < coords.length - 1; i++) {
        tailDist += haversineMeters(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
      }
      return Math.min(totalDist, Math.round(Math.max(directToDest * 0.95, tailDist)));
    }
    return Math.min(totalDist, Math.round(directToDest));
  }

  return totalDist;
}

export default function HomeNavigator() {
  const navigate = useNavigate();
  const { user, safetyPreferences, emergencyContacts } = useAuth();

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [travelMode, setTravelMode] = useState('foot');
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [pickMode, setPickMode] = useState(null);
  const [pickedReportPoint, setPickedReportPoint] = useState(null);

  const [reports, setReports] = useState([]);
  const [reportModalState, setReportModalState] = useState({
    isOpen: false,
    mode: 'report',
    coords: null,
  });

  // Live tracked trip state ("Share Link" + check-ins + SOS)
  const [activeTrip, setActiveTrip] = useState(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [isGpsStreaming, setIsGpsStreaming] = useState(false);

  // Real device-location turn guidance state ("Start Navigation")
  const [isNavigating, setIsNavigating] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCheckInPromptOpen, setIsCheckInPromptOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);

  const lastPingSentAtRef = useRef(0);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || routes[0] || null,
    [routes, selectedRouteId]
  );

  const navigationTelemetry = useMemo(() => {
    if (!isNavigating || !selectedRoute) return null;
    const totalDist = selectedRoute.distanceMeters || 0;
    const remainingMeters = computeRemainingMetersAlongRoute(
      selectedRoute,
      livePosition,
      destination
    );
    const remainingMinutes = calculateModeEtaMinutes(remainingMeters, travelMode, 0);
    const progressPercent =
      totalDist > 0
        ? Math.max(0, Math.min(100, Math.round(((totalDist - remainingMeters) / totalDist) * 100)))
        : 0;

    const steps = Array.isArray(selectedRoute.steps) ? selectedRoute.steps : [];
    const stepIdx =
      steps.length > 0
        ? Math.min(steps.length - 1, Math.floor((progressPercent / 100) * steps.length))
        : -1;
    const currentStep = stepIdx >= 0 ? steps[stepIdx] : null;

    return {
      progressPercent,
      remainingMeters,
      remainingMinutes,
      stepInstruction:
        currentStep?.instruction ||
        `Follow ${selectedRoute.routeTags?.[0] || 'selected route'} toward ${destination?.label || 'destination'}`,
      stepDistanceMeters: currentStep?.distanceMeters || 0,
      stepNumber: stepIdx >= 0 ? stepIdx + 1 : 0,
      totalSteps: steps.length,
      gpsFixAvailable: Boolean(livePosition?.lat && livePosition?.lng),
    };
  }, [isNavigating, selectedRoute, livePosition, destination, travelMode]);

  const focusCoords = useMemo(() => {
    if (origin?.lat && origin?.lng) return origin;
    if (livePosition?.lat && livePosition?.lng) return livePosition;
    if (destination?.lat && destination?.lng) return destination;
    return DEFAULT_FOCUS;
  }, [origin, livePosition, destination]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLivePosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  const refreshCommunityData = useCallback(async () => {
    const nearbyReps = await fetchNearbyReports({
      lat: focusCoords.lat,
      lng: focusCoords.lng,
      radiusMeters: 4000,
      maxAgeHours: 48,
    });
    setReports(nearbyReps);
  }, [focusCoords.lat, focusCoords.lng]);

  useEffect(() => {
    let active = true;
    async function loadInitialCommunity() {
      const nearbyReps = await fetchNearbyReports({
        lat: focusCoords.lat,
        lng: focusCoords.lng,
        radiusMeters: 4000,
        maxAgeHours: 48,
      });
      if (!active) return;
      setReports(nearbyReps);
    }
    loadInitialCommunity();
    return () => {
      active = false;
    };
  }, [focusCoords.lat, focusCoords.lng]);

  async function handleFindSafeRoutes() {
    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      setRouteError('Select both a starting point and a destination.');
      return;
    }

    setIsNavigating(false);
    setIsCalculating(true);
    setRouteError('');
    setPickMode(null);

    try {
      const candidates = await fetchCandidateRoutes(origin, destination, {
        profile: travelMode,
      });

      const initialRanked = rankRoutesBySafety(candidates, {
        reports,
        safetyPOIs: { police: [], medical: [], activePlaces: [], streetLampsCount: 0 },
        preferences: safetyPreferences,
      });
      setRoutes(initialRanked);
      setSelectedRouteId(initialRanked[0]?.id || null);
      setIsCalculating(false);

      const primary = candidates[0];
      const [safetyPOIs, corridorReports] = await Promise.all([
        fetchSafetyPOIs(primary.lngLatCoords).catch(() => ({
          police: [],
          medical: [],
          activePlaces: [],
          streetLampsCount: 0,
        })),
        fetchReportsAlongRoute(primary.sampledLngLat, 220).catch(() => []),
      ]);

      const reportMap = new Map();
      for (const r of reports) reportMap.set(r.id, r);
      for (const cr of Array.isArray(corridorReports) ? corridorReports : []) {
        reportMap.set(cr.report_id || cr.id, {
          ...cr,
          id: cr.report_id || cr.id,
        });
      }

      const enrichedRanked = rankRoutesBySafety(candidates, {
        reports: Array.from(reportMap.values()),
        safetyPOIs,
        preferences: safetyPreferences,
      });

      setRoutes(enrichedRanked);
      setSelectedRouteId((prev) => prev || enrichedRanked[0]?.id || null);
    } catch (err) {
      setRouteError(err?.message || 'Unable to find routes right now. Please try again.');
      setRoutes([]);
      setIsCalculating(false);
    }
  }

  function handleSwapLocations() {
    const prevOrigin = origin;
    setIsNavigating(false);
    setOrigin(destination);
    setDestination(prevOrigin);
    setRoutes([]);
    setSelectedRouteId(null);
  }

  async function handleMapClick({ lat, lng }) {
    if (!pickMode) return;

    const currentMode = pickMode;
    setPickMode(null);
    const label = await reverseGeocode(lat, lng);
    const placeObj = {
      id: `map-${Date.now()}`,
      label,
      subtitle: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      fullLabel: label,
      lat,
      lng,
      source: 'map-click',
    };

    if (currentMode === 'origin') {
      setOrigin(placeObj);
    } else if (currentMode === 'destination') {
      setDestination(placeObj);
    } else if (currentMode === 'report') {
      setPickedReportPoint(placeObj);
      setReportModalState({
        isOpen: true,
        mode: 'report',
        coords: placeObj,
      });
    }
  }

  // Starts real GPS-driven navigation (moves only when device location updates)
  function handleStartSafeTrip(route) {
    const targetRoute = route || selectedRoute;
    if (!targetRoute?.latLngCoords?.length) {
      setRouteError('Search and select a route first to start navigation.');
      return;
    }
    setSelectedRouteId(targetRoute.id);
    setIsNavigating(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLivePosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
          });
          setIsGpsStreaming(true);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  }

  function handleStopGuidedAnimation() {
    setIsNavigating(false);
  }

  // Starts/reuses a Supabase tracked trip and opens ShareTripModal ("Share Link")
  async function handleSendLiveTracking(route) {
    if (!user) {
      navigate('/profile');
      return;
    }

    if (activeTrip && activeTrip.status !== 'completed') {
      setIsShareModalOpen(true);
      return;
    }

    const targetRoute = route || selectedRoute;
    setIsStartingTrip(true);
    setRouteError('');
    try {
      const createdTrip = await startTrackedTrip({
        origin: origin || livePosition,
        destination,
        route: targetRoute,
        checkinIntervalMins: safetyPreferences?.checkin_interval_mins || 15,
      });
      setActiveTrip(createdTrip);
      setIsShareModalOpen(true);
    } catch (err) {
      setRouteError(err?.message || 'Unable to create live tracking link.');
    } finally {
      setIsStartingTrip(false);
    }
  }

  const activeTripId = activeTrip?.id;
  const activeTripStatus = activeTrip?.status;
  const shouldWatchDeviceGps =
    isNavigating || (Boolean(activeTripId) && activeTripStatus !== 'completed');

  useEffect(() => {
    if (!shouldWatchDeviceGps || !navigator.geolocation) {
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        };
        setLivePosition(coords);
        setIsGpsStreaming(true);

        if (activeTripId && activeTripStatus !== 'completed') {
          const now = Date.now();
          if (now - lastPingSentAtRef.current >= 8000) {
            lastPingSentAtRef.current = now;
            try {
              const updated = await updateTripLocation(activeTripId, {
                lat: coords.lat,
                lng: coords.lng,
                heading: coords.heading,
              });
              setActiveTrip((prev) => (prev ? { ...prev, ...updated } : prev));
            } catch {
              // Keep streaming on next tick
            }
          }
        }
      },
      () => {
        setIsGpsStreaming(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsGpsStreaming(false);
    };
  }, [shouldWatchDeviceGps, activeTripId, activeTripStatus]);

  const nextCheckinAt = activeTrip?.next_checkin_at;

  useEffect(() => {
    if (!activeTripId || activeTripStatus !== 'active' || !nextCheckinAt) {
      return undefined;
    }

    const checkTimer = setInterval(() => {
      const dueMs = new Date(nextCheckinAt).getTime();
      if (Date.now() >= dueMs) {
        setIsCheckInPromptOpen(true);
      }
    }, 3000);

    return () => clearInterval(checkTimer);
  }, [activeTripId, activeTripStatus, nextCheckinAt]);

  async function handleConfirmCheckIn() {
    if (!activeTrip) return;
    try {
      const updated = await renewTripCheckIn(
        activeTrip.id,
        safetyPreferences?.checkin_interval_mins || 15
      );
      setActiveTrip((prev) => (prev ? { ...prev, ...updated } : prev));
      setIsCheckInPromptOpen(false);
    } catch {
      setIsCheckInPromptOpen(false);
    }
  }

  async function handleEscalateMissedCheckIn() {
    if (!activeTrip) return;
    try {
      const updated = await setTripAlertStatus(activeTrip.id, 'missed_checkin', livePosition);
      setActiveTrip((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch {
      // Ignore network hiccup
    } finally {
      setIsCheckInPromptOpen(false);
    }
  }

  async function handleConfirmTriggerSos() {
    if (!activeTrip) return;
    setIsTriggeringSos(true);
    try {
      const updated = await setTripAlertStatus(activeTrip.id, 'sos_triggered', livePosition);
      setActiveTrip((prev) => (prev ? { ...prev, ...updated } : prev));
      setIsCheckInPromptOpen(false);
    } catch {
      // Keep SOS modal open
    } finally {
      setIsTriggeringSos(false);
    }
  }

  async function handleEndTrip() {
    if (!activeTrip) return;
    setIsEndingTrip(true);
    try {
      await endTrackedTrip(activeTrip.id);
      setActiveTrip(null);
      setIsNavigating(false);
      setIsGpsStreaming(false);
      setIsCheckInPromptOpen(false);
    } finally {
      setIsEndingTrip(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fff7fa] text-slate-900">
      <TopBar activeTrip={activeTrip} onOpenSosModal={() => setIsSosModalOpen(true)} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4">
        <ActiveTripBanner
          trip={activeTrip}
          isGpsStreaming={isGpsStreaming}
          isGuidedAnimating={isNavigating}
          guidedTelemetry={navigationTelemetry}
          onStopGuidedAnimation={handleStopGuidedAnimation}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onConfirmCheckIn={handleConfirmCheckIn}
          onOpenSosModal={() => setIsSosModalOpen(true)}
          onEndTrip={handleEndTrip}
          isEndingTrip={isEndingTrip}
        />

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">
            <RoutePlannerPanel
              origin={origin}
              destination={destination}
              onChangeOrigin={setOrigin}
              onChangeDestination={setDestination}
              onSwapLocations={handleSwapLocations}
              travelMode={travelMode}
              onChangeTravelMode={setTravelMode}
              pickMode={pickMode}
              onTogglePickMode={setPickMode}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              isCalculating={isCalculating}
              routeError={routeError}
              onFindSafeRoutes={handleFindSafeRoutes}
              onStartSafeTrip={handleStartSafeTrip}
              onStopGuidedAnimation={handleStopGuidedAnimation}
              onSendLiveTracking={handleSendLiveTracking}
              isGuidedAnimating={isNavigating}
              isStartingTrip={isStartingTrip}
              onOpenReportModal={() =>
                setReportModalState({
                  isOpen: true,
                  mode: 'report',
                  coords: pickedReportPoint || origin || livePosition,
                })
              }
              biasCoords={focusCoords}
            />

            <Link
              to="/community"
              className="flex items-center justify-between rounded-2xl border border-rose-200/80 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-xs transition hover:border-rose-300 hover:bg-rose-50/40"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-[#ec1c68]" />
                <span>Open Community Safety Feed &amp; Route Tips</span>
              </span>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-[#ec1c68]">
                {reports.length} nearby
              </span>
            </Link>
          </section>

          <section className="min-h-[440px] lg:col-span-7 lg:min-h-[calc(100vh-115px)] xl:col-span-8">
            <MapCanvas
              origin={origin}
              destination={destination}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={setSelectedRouteId}
              reports={reports}
              livePosition={livePosition}
              isGuidedAnimating={isNavigating}
              followLive={Boolean(activeTrip) || isNavigating}
              pickMode={pickMode}
              pickedPoint={pickedReportPoint}
              onMapClick={handleMapClick}
            />
          </section>
        </div>
      </main>

      <QuickReportModal
        isOpen={reportModalState.isOpen}
        onClose={() => setReportModalState((prev) => ({ ...prev, isOpen: false }))}
        initialMode={reportModalState.mode}
        initialCoords={reportModalState.coords}
        origin={origin}
        destination={destination}
        onSubmitted={() => {
          setPickedReportPoint(null);
          refreshCommunityData();
        }}
      />

      <ShareTripModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        trip={activeTrip}
      />

      <CheckInAlertModal
        isOpen={isCheckInPromptOpen && Boolean(activeTrip)}
        graceSeconds={60}
        onConfirmSafe={handleConfirmCheckIn}
        onEscalateMissed={handleEscalateMissedCheckIn}
        onTriggerSos={() => {
          setIsCheckInPromptOpen(false);
          setIsSosModalOpen(true);
        }}
      />

      <SosModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        activeTrip={activeTrip}
        livePosition={livePosition}
        emergencyContacts={emergencyContacts}
        onConfirmTriggerSos={handleConfirmTriggerSos}
        isTriggering={isTriggeringSos}
      />
    </div>
  );
}