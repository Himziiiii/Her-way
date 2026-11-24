// src/components/community/DailyUpdatesTab.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  ThumbsUp,
  Flag,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { REPORT_CATEGORIES, voteOnReport } from '../../services/communityService';

function formatRelativeTime(isoString, nowMs) {
  if (!isoString) return 'Just now';
  const diffMs = nowMs - new Date(isoString).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDistanceMeters(meters) {
  if (typeof meters !== 'number') return null;
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

export default function DailyUpdatesTab({
  reports = [],
  isLoading = false,
  onFocusLocation,
  onReportVoted,
  onOpenCreate,
}) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [maxHoursFilter, setMaxHoursFilter] = useState(48);
  const [busyVoteId, setBusyVoteId] = useState(null);
  const [voteFeedback, setVoteFeedback] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const categoryMap = useMemo(() => {
    const map = {};
    for (const c of REPORT_CATEGORIES) {
      map[c.value] = c;
    }
    return map;
  }, []);

  const filteredReports = useMemo(() => {
    const cutoffMs = nowMs - maxHoursFilter * 60 * 60 * 1000;

    return reports.filter((rep) => {
      const createdMs = rep.created_at ? new Date(rep.created_at).getTime() : nowMs;
      if (createdMs < cutoffMs) return false;

      if (sentimentFilter === 'positive') {
        return rep.sentiment === 'positive';
      }
      if (sentimentFilter === 'alerts') {
        return rep.sentiment === 'caution' || rep.sentiment === 'danger';
      }
      return true;
    });
  }, [reports, sentimentFilter, maxHoursFilter, nowMs]);

  async function handleVote(reportId, voteType) {
    setBusyVoteId(reportId);
    setVoteFeedback('');
    try {
      await voteOnReport(reportId, voteType);
      onReportVoted?.();
    } catch (err) {
      setVoteFeedback(err?.message || 'Sign in to vote on updates.');
    } finally {
      setBusyVoteId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'positive', label: 'Safe Spots' },
            { id: 'alerts', label: 'Alerts' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSentimentFilter(pill.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                sentimentFilter === pill.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter updates by age"
          value={maxHoursFilter}
          onChange={(e) => setMaxHoursFilter(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 focus:border-rose-500 focus:outline-none"
        >
          <option value={6}>Last 6 hrs</option>
          <option value={24}>Last 24 hrs</option>
          <option value={48}>Last 48 hrs</option>
        </select>
      </div>

      {voteFeedback && (
        <p className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          {voteFeedback}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
          <p className="text-xs font-semibold text-slate-700">
            No updates match this filter nearby yet
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Share street lighting, crowd levels, or patrol updates to help others walking nearby.
          </p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="mt-3 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            + Add First Update
          </button>
        </div>
      ) : (
        <ul className="max-h-[380px] space-y-2.5 overflow-y-auto pr-0.5">
          {filteredReports.map((rep) => {
            const meta = categoryMap[rep.category];
            const isPositive = rep.sentiment === 'positive';
            const isDanger = rep.sentiment === 'danger';

            const badgeClasses = isPositive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : isDanger
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';

            const StatusIcon = isPositive
              ? ShieldCheck
              : isDanger
                ? ShieldAlert
                : AlertTriangle;

            const distText = formatDistanceMeters(rep.distance_meters);

            return (
              <li
                key={rep.id}
                className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClasses}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    <span>{meta?.label || rep.category.replace(/_/g, ' ')}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(rep.created_at, nowMs)}
                  </span>
                </div>

                {rep.area_name && (
                  <button
                    type="button"
                    onClick={() =>
                      onFocusLocation?.({
                        lat: rep.lat,
                        lng: rep.lng,
                        label: rep.area_name,
                      })
                    }
                    className="mt-1.5 inline-flex items-center gap-1 text-left text-xs font-semibold text-slate-800 hover:text-rose-600"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                    <span className="line-clamp-1">{rep.area_name}</span>
                    {distText && (
                      <span className="shrink-0 font-normal text-slate-400">({distText})</span>
                    )}
                  </button>
                )}

                {rep.note && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{rep.note}</p>
                )}

                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    disabled={busyVoteId === rep.id}
                    onClick={() => handleVote(rep.id, 'upvote')}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    <span>Helpful ({rep.upvotes || 0})</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyVoteId === rep.id}
                    onClick={() => handleVote(rep.id, 'flag')}
                    title="Flag inaccurate or outdated report"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Flag className="h-3 w-3" />
                    <span>Flag</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}