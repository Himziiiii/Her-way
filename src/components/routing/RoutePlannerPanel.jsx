// src/components/routing/RoutePlannerPanel.jsx
import { ArrowUpDown, Footprints, Car, ShieldCheck, Loader2, Compass } from 'lucide-react';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import RouteOptionsList from './RouteOptionsList';

export default function RoutePlannerPanel({
  origin,
  destination,
  onChangeOrigin,
  onChangeDestination,
  onSwapLocations,
  travelMode = 'foot', // 'foot' | 'driving'
  onChangeTravelMode,
  pickMode,
  onTogglePickMode,
  routes = [],
  selectedRouteId = null,
  onSelectRoute,
  isCalculating = false,
  routeError = '',
  onFindSafeRoutes,
  onStartSafeTrip,
  onStopGuidedAnimation,
  onSendLiveTracking,
  isGuidedAnimating = false,
  isStartingTrip = false,
  onOpenReportModal,
  biasCoords = null,
}) {
  const canSearch = Boolean(origin?.lat && origin?.lng && destination?.lat && destination?.lng);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header & Travel Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Safe Route Finder</h2>
            <p className="text-xs text-slate-500">Scored by lighting, POIs &amp; live reports</p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Travel mode"
          className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5"
        >
          <button
            type="button"
            onClick={() => onChangeTravelMode?.('foot')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              travelMode === 'foot'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Footprints className="h-3.5 w-3.5" />
            <span>Walk</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTravelMode?.('driving')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              travelMode === 'driving'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>Cab / Auto</span>
          </button>
        </div>
      </div>

      {/* Origin & Destination Inputs */}
      <div className="relative space-y-3">
        <PlaceAutocompleteInput
          inputId="herway-origin-input"
          label="Start Point (A)"
          placeholder="Current GPS, metro station, or street..."
          value={origin}
          onChange={onChangeOrigin}
          biasCoords={biasCoords}
          allowCurrentLocation
          isPickingOnMap={pickMode === 'origin'}
          onPickFromMap={() => onTogglePickMode?.(pickMode === 'origin' ? null : 'origin')}
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onSwapLocations}
            disabled={!origin && !destination}
            title="Swap start and destination"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Swap A / B</span>
          </button>
        </div>

        <PlaceAutocompleteInput
          inputId="herway-dest-input"
          label="Destination (B)"
          placeholder="Where are you heading?"
          value={destination}
          onChange={onChangeDestination}
          biasCoords={origin || biasCoords}
          isPickingOnMap={pickMode === 'destination'}
          onPickFromMap={() =>
            onTogglePickMode?.(pickMode === 'destination' ? null : 'destination')
          }
        />
      </div>

      {/* Primary Search Action */}
      <button
        type="button"
        onClick={onFindSafeRoutes}
        disabled={!canSearch || isCalculating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        {isCalculating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analyzing Route Safety...</span>
          </>
        ) : (
          <>
            <Compass className="h-4 w-4" />
            <span>Find Safest Routes</span>
          </>
        )}
      </button>

      {routeError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {routeError}
        </div>
      )}

      {/* Map Segment Legend */}
      {routes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-700">Map Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Safe / Lit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
            Moderate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            Caution
          </span>
        </div>
      )}

      {/* Scored Route Comparison List */}
      <RouteOptionsList
        routes={routes}
        selectedRouteId={selectedRouteId}
        onSelectRoute={onSelectRoute}
        onStartSafeTrip={onStartSafeTrip}
        onStopGuidedAnimation={onStopGuidedAnimation}
        onSendLiveTracking={onSendLiveTracking}
        isGuidedAnimating={isGuidedAnimating}
        isStartingTrip={isStartingTrip}
        onOpenReportModal={onOpenReportModal}
      />
    </div>
  );
}