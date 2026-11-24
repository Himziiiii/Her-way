// src/components/community/QuickReportModal.jsx
import { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Send,
  Loader2,
  Lightbulb,
  AlertCircle,
  Compass,
} from 'lucide-react';
import {
  REPORT_CATEGORIES,
  createRouteReport,
  createRouteSuggestion,
} from '../../services/communityService';
import { reverseGeocode } from '../../services/geoProvider';

function QuickReportModalBody({
  onClose,
  initialMode,
  initialCoords,
  origin,
  destination,
  onSubmitted,
}) {
  const [mode, setMode] = useState(initialMode);
  const [coords, setCoords] = useState(initialCoords);
  const [areaName, setAreaName] = useState(initialCoords?.label || '');
  const [category, setCategory] = useState('well_lit');
  const [note, setNote] = useState('');

  const [originArea, setOriginArea] = useState(origin?.label || '');
  const [destinationArea, setDestinationArea] = useState(destination?.label || '');
  const [title, setTitle] = useState('');
  const [advice, setAdvice] = useState('');
  const [timeWindow, setTimeWindow] = useState('evening_night');

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!initialCoords?.lat || !initialCoords?.lng || initialCoords?.label) return undefined;
    let active = true;
    reverseGeocode(initialCoords.lat, initialCoords.lng).then((lbl) => {
      if (active) setAreaName(lbl);
    });
    return () => {
      active = false;
    };
  }, [initialCoords?.lat, initialCoords?.lng, initialCoords?.label]);

  function handleGrabCurrentGPS() {
    if (!navigator.geolocation) {
      setErrorMsg('Browser geolocation is unavailable.');
      return;
    }
    setIsLocating(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        const resolved = await reverseGeocode(lat, lng);
        setAreaName(resolved);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setErrorMsg('Could not access GPS. Tap a spot on the map first or allow location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'report') {
        if (!coords?.lat || !coords?.lng) {
          throw new Error('Select a location via GPS or tap on the map first.');
        }

        const created = await createRouteReport({
          lat: coords.lat,
          lng: coords.lng,
          areaName: areaName || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
          category,
          note,
        });

        onSubmitted?.({ type: 'report', item: created });
        onClose?.();
      } else {
        const startLat = origin?.lat ?? coords?.lat;
        const startLng = origin?.lng ?? coords?.lng;
        const endLat = destination?.lat ?? startLat;
        const endLng = destination?.lng ?? startLng;

        if (!startLat || !startLng) {
          throw new Error('Set at least a start location or GPS point for this route tip.');
        }
        if (!originArea.trim() || !destinationArea.trim()) {
          throw new Error('Enter both From and To area names.');
        }
        if (title.trim().length < 3 || advice.trim().length < 5) {
          throw new Error('Add a short headline and helpful route advice.');
        }

        const created = await createRouteSuggestion({
          originArea,
          destinationArea,
          startLat,
          startLng,
          endLat,
          endLng,
          title,
          advice,
          timeWindow,
        });

        onSubmitted?.({ type: 'suggestion', item: created });
        onClose?.();
      }
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to submit update.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-report-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              {mode === 'report' ? <Lightbulb className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
            </span>
            <div>
              <h2 id="quick-report-title" className="text-sm font-bold text-slate-900">
                Community Safety Contribution
              </h2>
              <p className="text-xs text-slate-500">Helps score routes for everyone nearby</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('report');
              setErrorMsg('');
            }}
            className={`rounded-xl py-2 text-xs font-semibold transition ${
              mode === 'report'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Route Update
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('suggestion');
              setErrorMsg('');
            }}
            className={`rounded-xl py-2 text-xs font-semibold transition ${
              mode === 'suggestion'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Safer Route Suggestion
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] space-y-4 overflow-y-auto p-5">
          {mode === 'report' ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-rose-600" />
                    Pinned Spot
                  </span>
                  <button
                    type="button"
                    onClick={handleGrabCurrentGPS}
                    disabled={isLocating}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    {isLocating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Navigation className="h-3.5 w-3.5" />
                    )}
                    <span>Use Current GPS</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="Street, gate, metro exit, or landmark name"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
                />

                {coords?.lat && coords?.lng ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-amber-700">
                    No pin set yet—click &ldquo;Use Current GPS&rdquo; or tap directly on the map.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">
                  What is the current condition?
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((cat) => {
                    const active = category === cat.value;
                    const toneRing =
                      cat.sentiment === 'positive'
                        ? active
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950'
                          : 'border-slate-200 hover:border-emerald-300'
                        : cat.sentiment === 'danger'
                          ? active
                            ? 'border-rose-500 bg-rose-50/80 text-rose-950'
                            : 'border-slate-200 hover:border-rose-300'
                          : active
                            ? 'border-amber-500 bg-amber-50/80 text-amber-950'
                            : 'border-slate-200 hover:border-amber-300';

                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`rounded-xl border p-2.5 text-left transition ${toneRing}`}
                      >
                        <p className="text-xs font-semibold">{cat.label}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{cat.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="report-note" className="text-xs font-semibold text-slate-700">
                    Quick Detail (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400">{note.length}/280</span>
                </div>
                <textarea
                  id="report-note"
                  rows={2}
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Main market road is brightly lit with auto stand open till 11 PM"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    From Area
                  </label>
                  <input
                    type="text"
                    value={originArea}
                    onChange={(e) => setOriginArea(e.target.value)}
                    placeholder="e.g., Hauz Khas Gate 3"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    To Area
                  </label>
                  <input
                    type="text"
                    value={destinationArea}
                    onChange={(e) => setDestinationArea(e.target.value)}
                    placeholder="e.g., SDA Market"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Best Time Window
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'evening_night', label: 'Evening / Night' },
                    { value: 'early_morning', label: 'Early Morning' },
                    { value: 'all_day', label: 'All Day' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimeWindow(opt.value)}
                      className={`rounded-xl border py-2 text-xs font-semibold transition ${
                        timeWindow === opt.value
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Headline
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Take main avenue past pharmacy instead of back lane after 8 PM"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Why this route is safer
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  placeholder="Share landmarks, well-lit turns, e-rickshaw stands, or stretches to avoid..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>{mode === 'report' ? 'Post Update' : 'Share Suggestion'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QuickReportModal({
  isOpen,
  onClose,
  initialMode = 'report',
  initialCoords = null,
  origin = null,
  destination = null,
  onSubmitted,
}) {
  if (!isOpen) return null;

  const modalKey = `${initialMode}-${initialCoords?.lat ?? 'none'}-${initialCoords?.lng ?? 'none'}`;

  return (
    <QuickReportModalBody
      key={modalKey}
      onClose={onClose}
      initialMode={initialMode}
      initialCoords={initialCoords}
      origin={origin}
      destination={destination}
      onSubmitted={onSubmitted}
    />
  );
}