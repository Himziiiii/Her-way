// src/pages/LiveTrackPublic.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Clock,
  RefreshCw,
  PhoneCall,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import MapCanvas from '../components/map/MapCanvas';
import { fetchTripByToken, subscribeToTripUpdates } from '../services/tripService';

function formatTimeAgo(isoString, nowMs) {
  if (!isoString) return 'Just now';
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(isoString).getTime()) / 1000));
  if (diffSec < 15) return 'Updated just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function getStatusConfig(status) {
  switch (status) {
    case 'sos_triggered':
      return {
        label: 'SOS EMERGENCY TRIGGERED',
        tone: 'bg-rose-600 text-white border-rose-700',
        banner: 'bg-rose-50 border-rose-300 text-rose-900',
        isAlert: true,
      };
    case 'missed_checkin':
      return {
        label: 'MISSED CHECK-IN ALERT',
        tone: 'bg-amber-600 text-white border-amber-700',
        banner: 'bg-amber-50 border-amber-300 text-amber-950',
        isAlert: true,
      };
    case 'completed':
      return {
        label: 'ARRIVED SAFELY',
        tone: 'bg-emerald-600 text-white border-emerald-700',
        banner: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        isAlert: false,
      };
    default:
      return {
        label: 'LIVE SAFE TRIP ACTIVE',
        tone: 'bg-sky-600 text-white border-sky-700',
        banner: 'bg-sky-50/80 border-sky-200 text-sky-950',
        isAlert: false,
      };
  }
}

export default function LiveTrackPublic() {
  const { shareToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const refreshTripNow = useCallback(async () => {
    if (!shareToken) {
      setErrorMsg('Invalid or missing trip tracking link.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const found = await fetchTripByToken(shareToken);
      if (!found) {
        setErrorMsg('This live trip link was not found or may have expired.');
        setTrip(null);
      } else {
        setTrip(found);
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to load trip tracking details.');
    } finally {
      setIsLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      if (!shareToken) {
        if (active) {
          setErrorMsg('Invalid or missing trip tracking link.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const found = await fetchTripByToken(shareToken);
        if (!active) return;
        if (!found) {
          setErrorMsg('This live trip link was not found or may have expired.');
          setTrip(null);
        } else {
          setTrip(found);
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err?.message || 'Unable to load trip tracking details.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    initialLoad();
    return () => {
      active = false;
    };
  }, [shareToken]);

  useEffect(() => {
    if (!trip?.id) return undefined;
    const unsubscribe = subscribeToTripUpdates(trip.id, (updatedRow) => {
      setTrip((prev) => ({ ...prev, ...updatedRow }));
    });
    return unsubscribe;
  }, [trip?.id]);

  const routeGeoJson = trip?.route_geojson;
  const tripStatus = trip?.status;
  const originLabel = trip?.origin_label;
  const destLabel = trip?.dest_label;
  const currentLat = trip?.current_lat;
  const currentLng = trip?.current_lng;
  const heading = trip?.heading;

  const routeForMap = useMemo(() => {
    const coords = routeGeoJson?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return [];
    const latLngCoords = coords.map(([lng, lat]) => [lat, lng]);
    return [
      {
        id: 'shared-route',
        latLngCoords,
        segments: [
          {
            positions: latLngCoords,
            color: tripStatus === 'sos_triggered' ? '#dc2626' : '#16a34a',
            level: 'safe',
          },
        ],
      },
    ];
  }, [routeGeoJson, tripStatus]);

  const originPt = useMemo(() => {
    const first = routeGeoJson?.coordinates?.[0];
    if (!Array.isArray(first)) return null;
    return { lat: first[1], lng: first[0], label: originLabel };
  }, [routeGeoJson, originLabel]);

  const destPt = useMemo(() => {
    const coords = routeGeoJson?.coordinates;
    const last = Array.isArray(coords) ? coords[coords.length - 1] : null;
    if (!Array.isArray(last)) return null;
    return { lat: last[1], lng: last[0], label: destLabel };
  }, [routeGeoJson, destLabel]);

  const livePosition = useMemo(() => {
    if (typeof currentLat !== 'number' || typeof currentLng !== 'number') {
      return null;
    }
    return {
      lat: currentLat,
      lng: currentLng,
      heading,
    };
  }, [currentLat, currentLng, heading]);

  const statusCfg = getStatusConfig(tripStatus);
  const mapsCoordsUrl =
    livePosition?.lat && livePosition?.lng
      ? `https://www.openstreetmap.org/?mlat=${livePosition.lat}&mlon=${livePosition.lng}#map=16/${livePosition.lat}/${livePosition.lng}`
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">
                HerWay Live Trip Tracker
              </p>
              <p className="text-[11px] text-slate-500">Real-time journey safety share</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshTripNow}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>

            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Open HerWay</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 lg:flex-row">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
            Loading live trip telemetry...
          </div>
        ) : errorMsg || !trip ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <ShieldAlert className="h-10 w-10 text-rose-500" />
            <h1 className="mt-3 text-base font-bold text-slate-900">Trip Link Unavailable</h1>
            <p className="mt-1 max-w-md text-xs text-slate-600">
              {errorMsg || 'We could not find an active trip for this link.'}
            </p>
            <Link
              to="/"
              className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Go to Safe Route Planner
            </Link>
          </div>
        ) : (
          <>
            <aside className="flex w-full flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-[370px] lg:shrink-0">
              <div className={`rounded-xl border p-3.5 ${statusCfg.banner}`}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusCfg.tone}`}
                  >
                    {statusCfg.isAlert ? (
                      <ShieldAlert className="h-3 w-3" />
                    ) : trip.status === 'completed' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Navigation className="h-3 w-3" />
                    )}
                    {statusCfg.label}
                  </span>

                  <span className="text-[11px] font-semibold">
                    Score: {trip.safety_score}/100
                  </span>
                </div>

                <p className="mt-2 text-xs font-semibold">
                  {statusCfg.isAlert
                    ? 'Immediate attention: check in with the traveler or contact emergency services if unreachable.'
                    : trip.status === 'completed'
                      ? 'The traveler has marked this journey as completed.'
                      : 'Location updates stream automatically while the trip is active.'}
                </p>
              </div>

              <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                    A
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Origin</p>
                    <p className="font-semibold text-slate-800">{trip.origin_label}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                    B
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">
                      Destination
                    </p>
                    <p className="font-semibold text-slate-800">{trip.dest_label}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-rose-500" />
                    Last Ping
                  </p>
                  <p className="mt-1 font-bold text-slate-900">
                    {formatTimeAgo(trip.last_ping_at, nowMs)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Navigation className="h-3.5 w-3.5 text-sky-600" />
                    Est. Duration
                  </p>
                  <p className="mt-1 font-bold text-slate-900">
                    {trip.status === 'completed'
                      ? 'Arrived'
                      : typeof trip.eta_minutes === 'number'
                        ? `~${trip.eta_minutes} min`
                        : '—'}
                  </p>
                </div>
              </div>

              {livePosition && (
                <div className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      Latest GPS Pin
                    </span>
                    {mapsCoordsUrl && (
                      <a
                        href={mapsCoordsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                      >
                        <span>OSM Pin</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {livePosition.lat.toFixed(5)}, {livePosition.lng.toFixed(5)}
                  </p>
                </div>
              )}

              <div className="mt-auto rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                <p className="text-[11px] font-bold text-rose-900">Emergency Helpline (India)</p>
                <p className="mt-0.5 text-[11px] text-rose-800">
                  Dial <strong>112</strong> for unified police, fire, and emergency response.
                </p>
                <a
                  href="tel:112"
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Call 112</span>
                </a>
              </div>
            </aside>

            <section className="min-h-[420px] flex-1 lg:min-h-[calc(100vh-110px)]">
              <MapCanvas
                origin={originPt}
                destination={destPt}
                routes={routeForMap}
                selectedRouteId="shared-route"
                livePosition={livePosition}
                followLive={trip.status !== 'completed'}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}