// src/components/map/MapCanvas.jsx
import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import RouteOverlay from './RouteOverlay';
import ReportMarkersLayer from './ReportMarkersLayer';

const DEFAULT_CENTER = [28.6139, 77.209]; // New Delhi fallback
const DEFAULT_ZOOM = 13;

function createPinIcon(bgHex, labelText, pulse = false) {
  return L.divIcon({
    className: 'herway-custom-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: ${bgHex};
        color: #ffffff;
        font-weight: 700;
        font-size: 11px;
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.28);
        transform: translate(-50%, -50%);
      ">
        ${pulse ? `<span style="position:absolute;inset:-5px;border-radius:9999px;background:${bgHex};opacity:0.25;"></span>` : ''}
        <span style="position:relative;z-index:1;">${labelText}</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createDirectionalPuckIcon(headingDeg = 0) {
  const rot = typeof headingDeg === 'number' && !Number.isNaN(headingDeg) ? headingDeg : 0;
  return L.divIcon({
    className: 'herway-guided-puck',
    html: `
      <div style="
        position: relative;
        width: 38px;
        height: 38px;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: rgba(225, 29, 72, 0.18);
        "></div>
        <div style="
          transform: rotate(${rot}deg);
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-bottom: 12px solid #e11d48;
          position: relative;
          top: -12px;
        "></div>
        <div style="
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #e11d48;
          border: 3px solid #ffffff;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.35);
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function MapViewportController({
  origin,
  destination,
  activeRoute,
  livePosition,
  followLive,
  isGuidedAnimating,
}) {
  const map = useMap();
  const hasFittedRouteRef = useMemo(() => ({ key: '' }), []);

  useEffect(() => {
    if ((followLive || isGuidedAnimating) && livePosition?.lat && livePosition?.lng) {
      map.panTo([livePosition.lat, livePosition.lng], {
        animate: true,
        duration: 0.25,
      });
      return;
    }

    const routeKey = activeRoute?.id ? `${activeRoute.id}-${activeRoute.latLngCoords?.length || 0}` : '';
    if (activeRoute?.latLngCoords?.length > 1 && routeKey !== hasFittedRouteRef.key) {
      hasFittedRouteRef.key = routeKey;
      const bounds = L.latLngBounds(activeRoute.latLngCoords);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      return;
    }

    if (origin?.lat && origin?.lng && destination?.lat && destination?.lng && !routeKey) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
      return;
    }

    if (origin?.lat && origin?.lng && !routeKey) {
      map.setView([origin.lat, origin.lng], 14, { animate: true });
    }
  }, [map, origin, destination, activeRoute, livePosition, followLive, isGuidedAnimating, hasFittedRouteRef]);

  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (typeof onMapClick === 'function') {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export default function MapCanvas({
  origin = null,
  destination = null,
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
  reports = [],
  livePosition = null,
  isGuidedAnimating = false,
  followLive = false,
  pickMode = null, // null | 'origin' | 'destination' | 'report'
  pickedPoint = null,
  onMapClick,
}) {
  const originIcon = useMemo(() => createPinIcon('#0f172a', 'A'), []);
  const destIcon = useMemo(() => createPinIcon('#be185d', 'B'), []);
  const liveIcon = useMemo(() => createPinIcon('#2563eb', 'YOU', true), []);
  const pickedIcon = useMemo(() => createPinIcon('#7c3aed', 'PIN'), []);
  const guidedPuckIcon = useMemo(
    () => createDirectionalPuckIcon(livePosition?.heading),
    [livePosition?.heading]
  );

  const initialCenter = useMemo(() => {
    if (origin?.lat && origin?.lng) return [origin.lat, origin.lng];
    if (livePosition?.lat && livePosition?.lng) return [livePosition.lat, livePosition.lng];
    return DEFAULT_CENTER;
  }, [origin, livePosition]);

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || routes[0] || null,
    [routes, selectedRouteId]
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      {pickMode && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur">
          Tap anywhere on the map to set {pickMode === 'report' ? 'report pin' : `${pickMode} point`}
        </div>
      )}

      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="z-0 h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportController
          origin={origin}
          destination={destination}
          activeRoute={activeRoute}
          livePosition={livePosition}
          followLive={followLive}
          isGuidedAnimating={isGuidedAnimating}
        />

        <MapClickHandler onMapClick={onMapClick} />

        <RouteOverlay
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={onSelectRoute}
        />

        <ReportMarkersLayer reports={reports} />

        {/* Origin marker */}
        {typeof origin?.lat === 'number' && typeof origin?.lng === 'number' && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold text-slate-900">Start (A)</p>
                <p className="text-slate-600">{origin.label || 'Selected Origin'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {typeof destination?.lat === 'number' && typeof destination?.lng === 'number' && (
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold text-slate-900">Destination (B)</p>
                <p className="text-slate-600">{destination.label || 'Selected Destination'}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Guided animation directional puck OR live GPS marker */}
        {typeof livePosition?.lat === 'number' && typeof livePosition?.lng === 'number' && (
          isGuidedAnimating ? (
            <Marker position={[livePosition.lat, livePosition.lng]} icon={guidedPuckIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold text-rose-700">Live Route Guidance</p>
                  <p className="text-slate-600">Following selected safer corridor</p>
                </div>
              </Popup>
            </Marker>
          ) : (
            <>
              {typeof livePosition.accuracy === 'number' && livePosition.accuracy > 0 && (
                <Circle
                  center={[livePosition.lat, livePosition.lng]}
                  radius={Math.min(livePosition.accuracy, 250)}
                  pathOptions={{
                    color: '#2563eb',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.12,
                    weight: 1,
                  }}
                />
              )}
              <Marker position={[livePosition.lat, livePosition.lng]} icon={liveIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold text-blue-700">Live Position</p>
                    <p className="text-slate-600">Tracking active</p>
                  </div>
                </Popup>
              </Marker>
            </>
          )
        )}

        {/* Temporary map-picked pin */}
        {typeof pickedPoint?.lat === 'number' && typeof pickedPoint?.lng === 'number' && (
          <Marker position={[pickedPoint.lat, pickedPoint.lng]} icon={pickedIcon}>
            <Popup>
              <div className="text-xs font-medium text-purple-900">Selected Pin</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}