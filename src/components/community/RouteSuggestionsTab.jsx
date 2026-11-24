// src/components/community/RouteSuggestionsTab.jsx
import { useState } from 'react';
import { ArrowRight, ThumbsUp, Clock, Compass, MapPin } from 'lucide-react';
import { markSuggestionHelpful } from '../../services/communityService';

const TIME_WINDOW_LABELS = {
  evening_night: 'Evening / Night',
  early_morning: 'Early Morning',
  all_day: 'All Day',
};

export default function RouteSuggestionsTab({
  suggestions = [],
  isLoading = false,
  onFocusLocation,
  onSuggestionHelpful,
  onOpenCreate,
}) {
  const [votedIds, setVotedIds] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);

  async function handleHelpful(id) {
    if (votedIds.has(id) || busyId === id) return;
    setBusyId(id);
    try {
      await markSuggestionHelpful(id);
      setVotedIds((prev) => new Set(prev).add(id));
      onSuggestionHelpful?.(id);
    } catch {
      // Ignore transient RPC error
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((n) => (
          <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
        <Compass className="mx-auto h-5 w-5 text-rose-500" />
        <p className="mt-1.5 text-xs font-semibold text-slate-700">
          No corridor route suggestions here yet
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Know a safer main-road detour or better-lit metro exit path? Share it with the community.
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="mt-3 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
        >
          + Suggest Safer Route
        </button>
      </div>
    );
  }

  return (
    <ul className="max-h-[380px] space-y-2.5 overflow-y-auto pr-0.5">
      {suggestions.map((item) => {
        const hasVoted = votedIds.has(item.id);
        const displayCount = (item.helpful_count || 0) + (hasVoted ? 1 : 0);

        return (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 transition hover:border-slate-300 hover:bg-white"
          >
            {/* Corridor Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                <span className="line-clamp-1 max-w-[120px]">{item.origin_area}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1 max-w-[120px]">{item.destination_area}</span>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                <Clock className="h-2.5 w-2.5" />
                {TIME_WINDOW_LABELS[item.time_window] || 'All Day'}
              </span>
            </div>

            <h4 className="mt-1.5 text-xs font-bold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.advice}</p>

            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
              {typeof item.start_lat === 'number' && typeof item.start_lng === 'number' ? (
                <button
                  type="button"
                  onClick={() =>
                    onFocusLocation?.({
                      lat: item.start_lat,
                      lng: item.start_lng,
                      label: item.origin_area,
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600"
                >
                  <MapPin className="h-3 w-3" />
                  <span>View corridor on map</span>
                </button>
              ) : (
                <span />
              )}

              <button
                type="button"
                disabled={hasVoted || busyId === item.id}
                onClick={() => handleHelpful(item.id)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  hasVoted
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
                <span>
                  {hasVoted ? 'Marked Helpful' : 'Helpful'} ({displayCount})
                </span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}