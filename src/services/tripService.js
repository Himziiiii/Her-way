// src/services/tripService.js
import { supabase } from './supabaseClient';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

/**
 * Build the public live-tracking URL for a trip's share_token.
 */
export function buildShareTripUrl(shareToken) {
  const base =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return `${base}/track/${encodeURIComponent(shareToken)}`;
}

/**
 * Start a live tracked trip and generate a shareable link token.
 */
export async function startTrackedTrip({
  origin,
  destination,
  route,
  checkinIntervalMins = 15,
}) {
  const client = ensureSupabase();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new Error('Please sign in to start a live-tracked trip and share a tracking link.');
  }

  const startLat = origin?.lat ?? route?.latLngCoords?.[0]?.[0];
  const startLng = origin?.lng ?? route?.latLngCoords?.[0]?.[1];

  if (typeof startLat !== 'number' || typeof startLng !== 'number') {
    throw new Error('Valid starting coordinates are required to start a trip.');
  }

  const etaMinutes = Math.max(1, Math.round((route?.durationSeconds || 600) / 60));
  const nextCheckinAt = new Date(
    Date.now() + Math.max(1, Number(checkinIntervalMins) || 15) * 60 * 1000
  ).toISOString();

  const { data, error } = await client
    .from('active_trips')
    .insert({
      user_id: user.id,
      status: 'active',
      origin_label: origin?.label || 'Start Point',
      dest_label: destination?.label || 'Destination',
      route_geojson: route?.geometryGeoJson || {
        type: 'LineString',
        coordinates: route?.lngLatCoords || [],
      },
      safety_score: route?.safetyScore ?? 80,
      current_lat: startLat,
      current_lng: startLng,
      heading: null,
      eta_minutes: etaMinutes,
      next_checkin_at: nextCheckinAt,
      last_ping_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not create live trip.');
  }

  return {
    ...data,
    shareUrl: buildShareTripUrl(data.share_token),
  };
}

/**
 * Push live GPS position, optional heading, and remaining ETA for an active trip.
 */
export async function updateTripLocation(tripId, payload = {}) {
  const client = ensureSupabase();
  const updates = {
    last_ping_at: new Date().toISOString(),
  };

  if (typeof payload.lat === 'number') updates.current_lat = payload.lat;
  if (typeof payload.lng === 'number') updates.current_lng = payload.lng;
  if (typeof payload.heading === 'number' && !Number.isNaN(payload.heading)) {
    updates.heading = payload.heading;
  }
  if (typeof payload.etaMinutes === 'number') {
    updates.eta_minutes = Math.max(0, Math.round(payload.etaMinutes));
  }

  const { data, error } = await client
    .from('active_trips')
    .update(updates)
    .eq('id', tripId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update live location.');
  }

  return data;
}

/**
 * Reset next check-in deadline and restore status to 'active' if it was 'missed_checkin'.
 */
export async function renewTripCheckIn(tripId, checkinIntervalMins = 15) {
  const client = ensureSupabase();
  const nextCheckinAt = new Date(
    Date.now() + Math.max(1, Number(checkinIntervalMins) || 15) * 60 * 1000
  ).toISOString();

  const { data, error } = await client
    .from('active_trips')
    .update({
      status: 'active',
      next_checkin_at: nextCheckinAt,
      last_ping_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to confirm check-in.');
  }

  return data;
}

/**
 * Mark a trip as 'missed_checkin' or 'sos_triggered'.
 */
export async function setTripAlertStatus(tripId, status = 'sos_triggered', coords = null) {
  const client = ensureSupabase();
  const updates = {
    status,
    last_ping_at: new Date().toISOString(),
  };
  if (typeof coords?.lat === 'number' && typeof coords?.lng === 'number') {
    updates.current_lat = coords.lat;
    updates.current_lng = coords.lng;
  }

  const { data, error } = await client
    .from('active_trips')
    .update(updates)
    .eq('id', tripId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to update trip alert status.');
  }

  return data;
}

/**
 * End a trip cleanly ('completed').
 */
export async function endTrackedTrip(tripId) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('active_trips')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      last_ping_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to end trip.');
  }

  return data;
}

/**
 * Fetch trip details by share_token for public recipients (no auth required).
 */
export async function fetchTripByToken(shareToken) {
  if (!supabase || !shareToken) return null;

  const { data, error } = await supabase.rpc('get_trip_by_token', {
    p_share_token: shareToken,
  });

  if (error) {
    throw new Error(error.message || 'Unable to load shared trip.');
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

/**
 * Subscribe to real-time updates for a specific trip (by trip.id or share_token).
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToTripUpdates(tripId, onUpdate) {
  if (!supabase || !tripId || typeof onUpdate !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`herway-trip-${tripId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'active_trips',
        filter: `id=eq.${tripId}`,
      },
      (payload) => {
        if (payload?.new) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}