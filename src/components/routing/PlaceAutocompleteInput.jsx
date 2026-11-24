// src/components/routing/PlaceAutocompleteInput.jsx
import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Search, X, Loader2 } from 'lucide-react';
import { searchPlaces, reverseGeocode } from '../../services/geoProvider';

export default function PlaceAutocompleteInput({
  label,
  placeholder = 'Search street, landmark, or area...',
  value = null,
  onChange,
  biasCoords = null,
  allowCurrentLocation = false,
  onPickFromMap,
  isPickingOnMap = false,
  inputId,
}) {
  const [draftQuery, setDraftQuery] = useState(null);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [geoError, setGeoError] = useState('');

  const containerRef = useRef(null);

  const query = draftQuery !== null ? draftQuery : value?.label || '';

  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (draftQuery === null) return undefined;

    const trimmed = draftQuery.trim();
    if (trimmed.length < 2) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const matches = await searchPlaces(trimmed, {
          lat: biasCoords?.lat,
          lng: biasCoords?.lng,
          limit: 5,
          signal: controller.signal,
        });
        setResults(matches);
        setIsOpen(true);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draftQuery, biasCoords?.lat, biasCoords?.lng]);

  function handleInputChange(nextText) {
    setDraftQuery(nextText);
    setGeoError('');
    if (nextText.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setIsOpen(false);
    }
    if (value) {
      onChange?.(null);
    }
  }

  function handleSelectPlace(place) {
    setDraftQuery(null);
    setResults([]);
    setIsOpen(false);
    setGeoError('');
    onChange?.(place);
  }

  function handleClear() {
    setDraftQuery(null);
    setResults([]);
    setIsSearching(false);
    setIsOpen(false);
    setGeoError('');
    onChange?.(null);
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const readable = await reverseGeocode(lat, lng);
        setIsLocating(false);
        handleSelectPlace({
          id: `gps-${Date.now()}`,
          label: readable || 'Current Location',
          subtitle: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          fullLabel: readable || 'Current Location',
          lat,
          lng,
          source: 'gps',
        });
      },
      (err) => {
        setIsLocating(false);
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Search or pick on map instead.'
            : 'Unable to fetch current GPS location.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="mb-1 flex items-center justify-between gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold tracking-wide text-slate-600 uppercase"
          >
            {label}
          </label>
        )}

        <div className="flex items-center gap-2">
          {allowCurrentLocation && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="h-3.5 w-3.5" />
              )}
              <span>{isLocating ? 'Locating...' : 'Use GPS'}</span>
            </button>
          )}

          {typeof onPickFromMap === 'function' && (
            <button
              type="button"
              onClick={onPickFromMap}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition ${
                isPickingOnMap
                  ? 'bg-purple-100 text-purple-800 ring-1 ring-purple-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>{isPickingOnMap ? 'Tap map...' : 'Map pin'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          id={inputId}
          type="text"
          value={query}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
        />

        {isSearching ? (
          <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-slate-400" />
        ) : (
          query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear ${label || 'location'}`}
              className="absolute right-2.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {geoError && <p className="mt-1 text-xs text-rose-600">{geoError}</p>}

      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-[600] mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => handleSelectPlace(place)}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-rose-50/70"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{place.label}</p>
                  {place.subtitle && (
                    <p className="truncate text-xs text-slate-500">{place.subtitle}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}