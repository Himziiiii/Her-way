// src/components/routing/RouteOptionsList.jsx
import {
  AlertTriangle,
  Clock,
  Route,
  Share2,
  Navigation,
  Square,
  MessageSquarePlus,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { calculateModeEtaMinutes, formatEtaLabel } from '../../services/geoProvider';

function formatDistance(meters = 0) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function getScoreStyle(score) {
  if (score >= 82) {
    return {
      ring: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  if (score >= 65) {
    return {
      ring: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }
  return {
    ring: 'border-rose-200 bg-rose-50 text-rose-800',
  };
}

export default function RouteOptionsList({
  routes = [],
  selectedRouteId = null,
  travelMode = 'foot',
  onSelectRoute,
  onStartSafeTrip,
  onStopGuidedAnimation,
  onSendLiveTracking,
  isGuidedAnimating = false,
  isStartingTrip = false,
  onOpenReportModal,
}) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return null;
  }

  const activeId = selectedRouteId || routes[0]?.id;
  const modeKey = travelMode === 'driving' ? 'car' : 'walk';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wide text-slate-600 uppercase">
          Route Options ({routes.length})
        </h3>
        {routes[0]?.timeContext?.label && (
          <span className="text-[11px] font-medium text-slate-500">
            {routes[0].timeContext.label}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {routes.map((route) => {
          const isSelected = route.id === activeId;
          const scoreStyle = getScoreStyle(route.safetyScore);
          const etaMinutes =
            typeof route.calibratedMinutes === 'number'
              ? route.calibratedMinutes
              : calculateModeEtaMinutes(
                  route.distanceMeters,
                  modeKey,
                  route.rawDurationSeconds || route.durationSeconds
                );
          const etaLabel = formatEtaLabel(etaMinutes);
          const isThisRouteNavigating = isSelected && isGuidedAnimating;

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute?.(route.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectRoute?.(route.id);
                }
              }}
              className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                isSelected
                  ? 'border-rose-400 bg-rose-50/35 ring-2 ring-rose-500/15'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(route.routeTags || []).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          tag === 'Safest Route'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tag === 'Fastest'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                      <Clock className="h-3.5 w-3.5 text-rose-500" />
                      {etaLabel} ({modeKey === 'car' ? 'Cab/Auto' : 'Walk'})
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Route className="h-3.5 w-3.5 text-slate-400" />
                      {formatDistance(route.distanceMeters)}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-center ${scoreStyle.ring}`}
                >
                  <span className="text-base leading-none font-extrabold">
                    {route.safetyScore}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    Safety
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 space-y-2.5 border-t border-slate-200/80 pt-3">
                  {route.reasons?.length > 0 && (
                    <ul className="space-y-1">
                      {route.reasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-xs text-slate-700"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {route.warnings?.length > 0 && (
                    <ul className="space-y-1 rounded-xl bg-amber-50/90 p-2.5">
                      {route.warnings.map((warn, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1.5 text-xs text-amber-900"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span className="capitalize">{warn}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div
                    className="flex flex-wrap items-center gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isThisRouteNavigating ? (
                      <button
                        type="button"
                        onClick={() => onStopGuidedAnimation?.()}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" />
                        <span>Stop Navigation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartSafeTrip?.(route)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ec1c68] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#d8165d]"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>Start Navigation</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSendLiveTracking?.(route)}
                      disabled={isStartingTrip}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isStartingTrip ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Creating Link...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5 text-rose-400" />
                          <span>Share Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenReportModal?.(route)}
                      title="Report lighting, crowd, or safety update along this route"
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5 text-[#ec1c68]" />
                      <span>Report</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}