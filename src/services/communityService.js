// src/services/communityService.js
import { supabase } from './supabaseClient';

export const REPORT_CATEGORIES = [
  {
    value: 'well_lit',
    label: 'Well-Lit Stretch',
    sentiment: 'positive',
    defaultExpiryHours: 72,
    description: 'Working streetlights and clear visibility',
  },
  {
    value: 'crowded_safe',
    label: 'Crowded & Active',
    sentiment: 'positive',
    defaultExpiryHours: 12,
    description: 'Open shops, commuters, and active foot traffic',
  },
  {
    value: 'police_patrol',
    label: 'Police / Patrol Present',
    sentiment: 'positive',
    defaultExpiryHours: 8,
    description: 'PCR van, traffic post, or active patrol spotted',
  },
  {
    value: 'poor_lighting',
    label: 'Poor / Broken Lighting',
    sentiment: 'caution',
    defaultExpiryHours: 120,
    description: 'Dark stretch or non-working streetlights',
  },
  {
    value: 'deserted',
    label: 'Deserted / Isolated',
    sentiment: 'caution',
    defaultExpiryHours: 24,
    description: 'Very low foot traffic or closed storefronts',
  },
  {
    value: 'blocked_construction',
    label: 'Blocked / Construction',
    sentiment: 'caution',
    defaultExpiryHours: 96,
    description: 'Detour, digging, or waterlogging blocking path',
  },
  {
    value: 'harassment_alert',
    label: 'Safety / Harassment Alert',
    sentiment: 'danger',
    defaultExpiryHours: 48,
    description: 'Unsafe gathering, catcalling, or incident reported',
  },
];

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

/**
 * Fetch active daily route reports near a coordinate via PostGIS RPC.
 */
export async function fetchNearbyReports({ lat, lng, radiusMeters = 3500, maxAgeHours = 48 }) {
  if (!supabase || typeof lat !== 'number' || typeof lng !== 'number') {
    return [];
  }

  const { data, error } = await supabase.rpc('get_nearby_reports', {
    lat,
    lng,
    radius_meters: radiusMeters,
    max_age_hours: maxAgeHours,
  });

  if (error) {
    console.error('Error fetching nearby reports:', error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Fetch reports within bufferMeters of a sampled route polyline ([lng, lat][]).
 */
export async function fetchReportsAlongRoute(sampledLngLat = [], bufferMeters = 160) {
  if (!supabase || !Array.isArray(sampledLngLat) || sampledLngLat.length < 2) {
    return [];
  }

  const { data, error } = await supabase.rpc('score_route_points', {
    coords: sampledLngLat,
    buffer_meters: bufferMeters,
  });

  if (error) {
    console.error('Error fetching corridor reports:', error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Submit a new daily route report. Requires an authenticated user.
 */
export async function createRouteReport({
  lat,
  lng,
  areaName = '',
  category,
  note = '',
  expiryHours,
}) {
  const client = ensureSupabase();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new Error('Please sign in to post a daily route update.');
  }

  const meta = REPORT_CATEGORIES.find((c) => c.value === category);
  if (!meta) {
    throw new Error('Please choose a valid report category.');
  }

  const hours = Number(expiryHours) > 0 ? Number(expiryHours) : meta.defaultExpiryHours;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // PostGIS geography(Point, 4326) expects WKT POINT(longitude latitude)
  const wktPoint = `SRID=4326;POINT(${lng} ${lat})`;

  const { data, error } = await client
    .from('route_reports')
    .insert({
      user_id: user.id,
      location: wktPoint,
      area_name: areaName.trim(),
      category: meta.value,
      sentiment: meta.sentiment,
      note: note.trim().slice(0, 280),
      expires_at: expiresAt,
    })
    .select('id, area_name, category, sentiment, note, upvotes, flags, created_at, expires_at')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to submit route update.');
  }

  return {
    ...data,
    lat,
    lng,
  };
}

/**
 * Toggle upvote or flag on a report for the current user.
 */
export async function voteOnReport(reportId, voteType = 'upvote') {
  const client = ensureSupabase();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Sign in to vote or flag community updates.');
  }

  const { data: existing } = await client
    .from('report_votes')
    .select('vote_type')
    .eq('user_id', user.id)
    .eq('report_id', reportId)
    .maybeSingle();

  if (existing?.vote_type === voteType) {
    // Remove vote if clicked again
    const { error } = await client
      .from('report_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('report_id', reportId);
    if (error) throw new Error(error.message);
    return { action: 'removed' };
  }

  const { error } = await client.from('report_votes').upsert(
    {
      user_id: user.id,
      report_id: reportId,
      vote_type: voteType,
    },
    { onConflict: 'user_id,report_id' }
  );

  if (error) throw new Error(error.message);
  return { action: 'saved', voteType };
}

/**
 * Fetch community route suggestions near a point.
 */
export async function fetchNearbySuggestions({ lat, lng, radiusMeters = 6000 }) {
  if (!supabase || typeof lat !== 'number' || typeof lng !== 'number') {
    return [];
  }

  const { data, error } = await supabase.rpc('get_nearby_suggestions', {
    lat,
    lng,
    radius_meters: radiusMeters,
  });

  if (error) {
    console.error('Error fetching nearby suggestions:', error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Submit a community route suggestion / safer corridor tip.
 */
export async function createRouteSuggestion({
  originArea,
  destinationArea,
  startLat,
  startLng,
  endLat,
  endLng,
  title,
  advice,
  timeWindow = 'all_day',
  waypoints = [],
}) {
  const client = ensureSupabase();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    throw new Error('Please sign in to share a route suggestion.');
  }

  const { data, error } = await client
    .from('route_suggestions')
    .insert({
      user_id: user.id,
      origin_area: originArea.trim(),
      destination_area: destinationArea.trim(),
      start_point: `SRID=4326;POINT(${startLng} ${startLat})`,
      end_point: `SRID=4326;POINT(${endLng} ${endLat})`,
      waypoints,
      title: title.trim().slice(0, 120),
      advice: advice.trim().slice(0, 500),
      time_window: timeWindow,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save route suggestion.');
  }

  return data;
}

/**
 * Increment helpful vote counter on a route suggestion.
 */
export async function markSuggestionHelpful(suggestionId) {
  const client = ensureSupabase();
  const { error } = await client.rpc('increment_suggestion_helpful', {
    p_suggestion_id: suggestionId,
  });
  if (error) {
    throw new Error(error.message || 'Could not update helpful count.');
  }
}