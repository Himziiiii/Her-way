// src/components/map/RouteOverlay.jsx
import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';

export default function RouteOverlay({
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
}) {
  const activeRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) || routes[0] || null,
    [routes, selectedRouteId]
  );

  const otherRoutes = useMemo(
    () => routes.filter((r) => r.id !== activeRoute?.id && Array.isArray(r.latLngCoords)),
    [routes, activeRoute]
  );

  return (
    <>
      {/* Unselected alternative routes */}
      {otherRoutes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.latLngCoords}
          pathOptions={{
            color: '#64748b',
            weight: 5,
            opacity: 0.45,
            dashArray: '6 8',
          }}
          eventHandlers={{
            click: () => onSelectRoute?.(route.id),
          }}
        />
      ))}

      {/* Active route base shadow/outline */}
      {activeRoute?.latLngCoords?.length > 1 && (
        <Polyline
          positions={activeRoute.latLngCoords}
          pathOptions={{
            color: '#0f172a',
            weight: 9,
            opacity: 0.16,
          }}
        />
      )}

      {/* Active route safety-colored segments */}
      {activeRoute?.segments?.length > 0
        ? activeRoute.segments.map((seg, idx) => (
            <Polyline
              key={`${activeRoute.id}-seg-${idx}`}
              positions={seg.positions}
              pathOptions={{
                color: seg.color,
                weight: 6.5,
                opacity: 0.92,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))
        : activeRoute?.latLngCoords?.length > 1 && (
            <Polyline
              positions={activeRoute.latLngCoords}
              pathOptions={{
                color: '#16a34a',
                weight: 6.5,
                opacity: 0.9,
              }}
            />
          )}
    </>
  );
}