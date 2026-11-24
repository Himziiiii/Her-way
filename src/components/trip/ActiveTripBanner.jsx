// src/components/trip/ActiveTripBanner.jsx
import { useEffect, useState } from 'react';
import {
  Navigation,
  Share2,
  CheckCircle2,
  ShieldAlert,
  Clock,
  FlagOff,
  Square,
  CornerUpRight,
} from 'lucide-react';

function formatCountdown(targetIso) {
  if (!targetIso) return 'Active';
  const diffSec = Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000);
  if (diffSec <= 0) return 'Due now';
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatMetersCompact(meters = 0) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function ActiveTripBanner({
  trip,
  isGpsStreaming = false,
  isGuidedAnimating = false,
  guidedTelemetry = null,
  onStopGuidedAnimation,
  onOpenShareModal,
  onConfirmCheckIn,
  onOpenSosModal,
  onEndTrip,
  isEndingTrip = false,
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!trip && !isGuidedAnimating) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [trip, isGuidedAnimating]);

  if (!trip && !isGuidedAnimating) return null;

  const isSos = trip?.status === 'sos_triggered';
  const isMissed = trip?.status === 'missed_checkin';

  return (
    <div className="space-y-2.5">
      {/* Google Maps-Style Live Turn-by-Turn Guidance Strip */}
      {isGuidedAnimating && guidedTelemetry && (
        <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                <CornerUpRight className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-rose-700">
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 uppercase">
                    Live Guidance Active
                  </span>
                  <span>
                    {guidedTelemetry.remainingMinutes} min ({formatMetersCompact(guidedTelemetry.remainingMeters)} left)
                  </span>
                  {guidedTelemetry.totalSteps > 0 && (
                    <span className="text-slate-500">
                      Step {guidedTelemetry.stepNumber}/{guidedTelemetry.totalSteps}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-extrabold text-slate-900">
                  {guidedTelemetry.stepInstruction}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onStopGuidedAnimation}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop Guidance</span>
            </button>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full rounded-full bg-rose-600 transition-all duration-150"
              style={{ width: `${guidedTelemetry.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Active Supabase Live Tracked Trip Banner */}
      {trip && (
        <div
          className={`rounded-2xl border px-4 py-3 shadow-sm transition ${
            isSos
              ? 'border-rose-400 bg-rose-600 text-white'
              : isMissed
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-slate-800 bg-slate-900 text-white'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Status & Destination */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                    isSos
                      ? 'bg-white text-rose-700'
                      : isMissed
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                  }`}
                >
                  <Navigation className="h-3 w-3" />
                  {isSos
                    ? 'SOS Broadcast Active'
                    : isMissed
                      ? 'Check-In Overdue'
                      : 'Live Trip Active'}
                </span>

                <span
                  className={`text-[11px] ${
                    isMissed ? 'text-amber-800' : 'text-slate-300'
                  }`}
                >
                  {isGpsStreaming ? 'GPS streaming' : 'Waiting for GPS fix'}
                </span>

                {trip.next_checkin_at && !isSos && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      isMissed ? 'text-amber-900' : 'text-slate-300'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    Next check-in: {formatCountdown(trip.next_checkin_at)}
                  </span>
                )}
              </div>

              <p className="mt-1 truncate text-xs font-semibold">
                Heading to: <span className="underline decoration-white/30">{trip.dest_label}</span>
              </p>
            </div>

            {/* Right: Quick Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onConfirmCheckIn}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isMissed
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : isSos
                      ? 'bg-white/15 text-white hover:bg-white/25'
                      : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>I&apos;m Safe</span>
              </button>

              <button
                type="button"
                onClick={onOpenShareModal}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isMissed
                    ? 'border border-amber-300 bg-white text-amber-950 hover:bg-amber-100'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Link</span>
              </button>

              <button
                type="button"
                onClick={onOpenSosModal}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isSos
                    ? 'bg-white text-rose-700 hover:bg-rose-50'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>SOS</span>
              </button>

              <button
                type="button"
                onClick={onEndTrip}
                disabled={isEndingTrip}
                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  isMissed
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-white text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FlagOff className="h-3.5 w-3.5" />
                <span>{isEndingTrip ? 'Ending...' : 'Arrived'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}