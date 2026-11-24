// src/components/community/CommunityDrawer.jsx
import { useState } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  MapPin,
  MessageSquareHeart,
  Compass,
} from 'lucide-react';
import DailyUpdatesTab from './DailyUpdatesTab';
import RouteSuggestionsTab from './RouteSuggestionsTab';

export default function CommunityDrawer({
  reports = [],
  suggestions = [],
  isLoading = false,
  onRefresh,
  onOpenReportModal,
  onStartMapPinReport,
  isPickingReportPin = false,
  onFocusLocation,
  onReportVoted,
  onSuggestionHelpful,
}) {
  const [activeTab, setActiveTab] = useState('updates'); // 'updates' | 'suggestions'

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Community Safety Feed</h2>
            <p className="text-xs text-slate-500">Live local updates &amp; safer corridor tips</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh community updates"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onStartMapPinReport}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
              isPickingReportPin
                ? 'border-purple-400 bg-purple-50 text-purple-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 text-purple-600" />
            <span>{isPickingReportPin ? 'Tap Map...' : 'Pin Map'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenReportModal?.(activeTab === 'suggestions' ? 'suggestion' : 'report')
            }
            className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('updates')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            activeTab === 'updates'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquareHeart className="h-3.5 w-3.5 text-rose-600" />
          <span>Daily Updates ({reports.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suggestions')}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            activeTab === 'suggestions'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Compass className="h-3.5 w-3.5 text-rose-600" />
          <span>Route Tips ({suggestions.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'updates' ? (
        <DailyUpdatesTab
          reports={reports}
          isLoading={isLoading}
          onFocusLocation={onFocusLocation}
          onReportVoted={onReportVoted}
          onOpenCreate={() => onOpenReportModal?.('report')}
        />
      ) : (
        <RouteSuggestionsTab
          suggestions={suggestions}
          isLoading={isLoading}
          onFocusLocation={onFocusLocation}
          onSuggestionHelpful={onSuggestionHelpful}
          onOpenCreate={() => onOpenReportModal?.('suggestion')}
        />
      )}
    </div>
  );
}