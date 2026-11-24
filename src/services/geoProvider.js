// src/services/geoProvider.js

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const poiMemoryCache = new Map();

function getStorageCache(key) {
  if (poiMemoryCache.has(key)) {
    const entry = poiMemoryCache.get(key);
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
    poiMemoryCache.delete(key);
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      poiMemoryCache.set(key, parsed);
      return parsed.data;
    }
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage quota or private-mode errors
  }
  return null;
}

function setStorageCache(key, data) {
  const payload = { timestamp: Date.now(), data };
  poiMemoryCache.set(key, payload);
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

function formatPhotonPlace(feature, index) {
  const [lng, lat] = feature?.geometry?.coordinates || [];
  const p = feature?.properties || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const title =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(' ') ||
    p.locality ||
    p.district ||
    p.city ||
    'Selected Location';

  const subtitleParts = [
    p.street && p.name !== p.street ? p.street : null,
    p.district || p.suburb || p.locality,
    p.city || p.county,
    p.state,
    p.country,
  ].filter(Boolean);

  return {
    id: `photon-${p.osm_id || index}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    label: title,
    subtitle: subtitleParts.join(', '),
    fullLabel: subtitleParts.length ? `${title}, ${subtitleParts.join(', ')}` : title,
    lat,
    lng,
    source: 'photon',
  };
}

function formatNominatimPlace(item, index) {
  const lat = Number.parseFloat(item?.lat);
  const lng = Number.parseFloat(item?.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const parts = (item.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
  const title = item.name || parts[0] || 'Selected Location';
  const subtitle = parts.slice(1, 4).join(', ');

  return {
    id: `nom-${item.place_id || index}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    label: title,
    subtitle,
    fullLabel: item.display_name || title,
    lat,
    lng,
    source: 'nominatim',
  };
}

/**
 * Computes realistic travel time in minutes directly from route distance & mode.
 * Uses ~4.8 km/h for walking ('foot'/'walking') and ~26.0 km/h for driving ('driving'/'car').
 */
export function calculateModeEtaMinutes(distanceMeters, mode = 'walk', osrmDurationSeconds = 0) {
  const meters = Math.max(50, Number(distanceMeters) || 0);
  const km = meters / 1000;
  const isDriving = mode === 'driving' || mode === 'car';

  const speedKmh = isDriving ? 26.0 : 4.8;
  const speedBasedMinutes = (km / speedKmh) * 60 + (isDriving ? 2 : 1);

  if (typeof osrmDurationSeconds === 'number' && osrmDurationSeconds > 0) {
    const osrmMinutes = osrmDurationSeconds / 60;
    // Blend OSRM geometry timing with realistic urban speed so long/short routes scale accurately
    const blended = isDriving
      ? osrmMinutes * 0.65 + speedBasedMinutes * 0.35
      : speedBasedMinutes * 0.8 + Math.min(osrmMinutes, speedBasedMinutes * 1.4) * 0.2;
    return Math.max(1, Math.round(blended));
  }

  return Math.max(1, Math.round(speedBasedMinutes));
}

export function formatEtaLabel(minutes) {
  const mins = Math.max(1, Math.round(Number(minutes) || 1));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
}

function buildOffsetWaypoint(origin, destination, offsetDeg = 0.008) {
  const midLat = (origin.lat + destination.lat) / 2;
  const midLng = (origin.lng + destination.lng) / 2;
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  const len = Math.hypot(dLat, dLng) || 1;
  // Perpendicular unit vector scaled by offsetDeg
  const perpLat = (-dLng / len) * offsetDeg;
  const perpLng = (dLat / len) * offsetDeg;
  return {
    lat: midLat + perpLat,
    lng: midLng + perpLng,
  };
}

function normalizeOsrmRoute(route, idx, osrmProfile) {
  const lngLatCoords = route.geometry?.coordinates || [];
  const latLngCoords = lngLatCoords.map(([lng, lat]) => [lat, lng]);
  const sampledLngLat = sampleLineCoordinates(lngLatCoords, 150);
  const distanceMeters = Math.round(route.distance || 0);
  const rawDurationSeconds = Math.round(route.duration || 0);
  const calibratedMinutes = calculateModeEtaMinutes(
    distanceMeters,
    osrmProfile,
    rawDurationSeconds
  );

  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => ({
      instruction: step.maneuver?.instruction || step.name || 'Continue along road',
      distanceMeters: Math.round(step.distance || 0),
      durationSeconds: Math.round(step.duration || 0),
      maneuverLocation: step.maneuver?.location
        ? { lat: step.maneuver.location[1], lng: step.maneuver.location[0] }
        : null,
    }))
  );

  return {
    id: `osrm-route-${idx}-${distanceMeters}`,
    rawIndex: idx,
    profile: osrmProfile,
    distanceMeters,
    durationSeconds: calibratedMinutes * 60,
    rawDurationSeconds,
    calibratedMinutes,
    calibratedDurationSeconds: calibratedMinutes * 60,
    geometryGeoJson: route.geometry,
    lngLatCoords,
    latLngCoords,
    sampledLngLat,
    steps,
  };
}

/**
 * Autocomplete place search using Photon with Nominatim fallback.
 * @param {string} query
 * @param {{ lat?: number, lng?: number, limit?: number, signal?: AbortSignal }} options
 */
export async function searchPlaces(query, options = {}) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const { lat, lng, limit = 5, signal } = options;

  // 1. Try Photon first
  try {
    const params = new URLSearchParams({
      q: trimmed,
      limit: String(limit),
      lang: 'en',
    });
    if (typeof lat === 'number' && typeof lng === 'number') {
      params.set('lat', String(lat));
      params.set('lon', String(lng));
    }

    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const json = await res.json();
      const formatted = (json?.features || [])
        .map(formatPhotonPlace)
        .filter(Boolean)
        .slice(0, limit);

      if (formatted.length > 0) {
        return formatted;
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
  }

  // 2. Fallback to Nominatim
  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
    });
    if (typeof lat === 'number' && typeof lng === 'number') {
      const delta = 0.25;
      params.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
      params.set('bounded', '0');
    }

    const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return [];
    const items = await res.json();
    return (Array.isArray(items) ? items : [])
      .map(formatNominatimPlace)
      .filter(Boolean)
      .slice(0, limit);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
}

/**
 * Convert coordinates into a human-readable address label.
 */
export async function reverseGeocode(lat, lng, signal) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return 'Current Location';
  }

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      zoom: '17',
    });

    const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const data = await res.json();
    const parts = (data?.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
    return parts.slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Sample evenly spaced [lng, lat] points along a GeoJSON LineString coordinate list.
 */
export function sampleLineCoordinates(lngLatCoords = [], stepMeters = 150) {
  if (!Array.isArray(lngLatCoords) || lngLatCoords.length === 0) return [];
  if (lngLatCoords.length === 1) return [lngLatCoords[0]];

  const sampled = [lngLatCoords[0]];
  let accumulated = 0;

  for (let i = 1; i < lngLatCoords.length; i++) {
    const [lng1, lat1] = lngLatCoords[i - 1];
    const [lng2, lat2] = lngLatCoords[i];
    const segDist = haversineMeters(lat1, lng1, lat2, lng2);
    accumulated += segDist;

    if (accumulated >= stepMeters) {
      sampled.push([lng2, lat2]);
      accumulated = 0;
    }
  }

  const last = lngLatCoords[lngLatCoords.length - 1];
  const prev = sampled[sampled.length - 1];
  if (prev[0] !== last[0] || prev[1] !== last[1]) {
    sampled.push(last);
  }

  return sampled;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch candidate routes from OSRM between origin and destination,
 * guaranteeing at least 2 distinct route options.
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @param {{ profile?: 'foot' | 'driving', signal?: AbortSignal }} options
 */
export async function fetchCandidateRoutes(origin, destination, options = {}) {
  const profile = options.profile || 'foot';
  const osrmProfile = profile === 'driving' ? 'driving' : 'walking';

  const coordsParam = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    alternatives: 'true',
    steps: 'true',
    overview: 'full',
    geometries: 'geojson',
  });

  const url = `${OSRM_BASE_URL}/${osrmProfile}/${coordsParam}?${params.toString()}`;
  const res = await fetch(url, { signal: options.signal });

  if (!res.ok) {
    throw new Error(`OSRM routing request failed (${res.status})`);
  }

  const data = await res.json();
  if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('No route found between the selected points.');
  }

  const normalized = data.routes.map((route, idx) =>
    normalizeOsrmRoute(route, idx, osrmProfile)
  );

  // Ensure at least 2 routes are returned if OSRM only returned 1
  if (normalized.length < 2) {
    const wp = buildOffsetWaypoint(origin, destination, 0.009);
    try {
      const altCoords = `${origin.lng},${origin.lat};${wp.lng},${wp.lat};${destination.lng},${destination.lat}`;
      const altUrl = `${OSRM_BASE_URL}/${osrmProfile}/${altCoords}?${params.toString()}`;
      const altRes = await fetch(altUrl, { signal: options.signal });
      if (altRes.ok) {
        const altData = await altRes.json();
        if (altData.code === 'Ok' && Array.isArray(altData.routes) && altData.routes[0]) {
          const altRoute = normalizeOsrmRoute(altData.routes[0], 1, osrmProfile);
          const isDuplicateDist =
            Math.abs(altRoute.distanceMeters - normalized[0].distanceMeters) < 40;
          normalized.push({
            ...altRoute,
            id: `osrm-alt-1-${altRoute.distanceMeters}`,
            distanceMeters: isDuplicateDist
              ? Math.round(normalized[0].distanceMeters * 1.12)
              : altRoute.distanceMeters,
            calibratedMinutes: isDuplicateDist
              ? calculateModeEtaMinutes(
                  Math.round(normalized[0].distanceMeters * 1.12),
                  osrmProfile,
                  altRoute.rawDurationSeconds
                )
              : altRoute.calibratedMinutes,
          });
        }
      }
    } catch {
      // Fallback below if secondary OSRM request fails
    }

    if (normalized.length < 2) {
      const base = normalized[0];
      const altLatLng = [
        [origin.lat, origin.lng],
        [wp.lat, wp.lng],
        [destination.lat, destination.lng],
      ];
      const altLngLat = altLatLng.map(([lat, lng]) => [lng, lat]);
      const extraDist = Math.max(
        150,
        Math.round(
          haversineMeters(origin.lat, origin.lng, wp.lat, wp.lng) +
            haversineMeters(wp.lat, wp.lng, destination.lat, destination.lng)
        )
      );
      const altMins = calculateModeEtaMinutes(extraDist, osrmProfile, 0);

      normalized.push({
        ...base,
        id: `osrm-alt-fallback-${extraDist}`,
        rawIndex: 1,
        distanceMeters: extraDist,
        durationSeconds: altMins * 60,
        calibratedMinutes: altMins,
        calibratedDurationSeconds: altMins * 60,
        lngLatCoords: altLngLat,
        latLngCoords: altLatLng,
        sampledLngLat: sampleLineCoordinates(altLngLat, 150),
      });
    }
  }

  return normalized;
}

/**
 * Compute bounding box around a set of [lng, lat] points with padding in degrees.
 */
function computeBBox(lngLatCoords, padDeg = 0.004) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of lngLatCoords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  if (!Number.isFinite(minLat)) return null;

  return {
    south: Number((minLat - padDeg).toFixed(3)),
    west: Number((minLng - padDeg).toFixed(3)),
    north: Number((maxLat + padDeg).toFixed(3)),
    east: Number((maxLng + padDeg).toFixed(3)),
  };
}

/**
 * Fetch OpenStreetMap safety context POIs (police, medical, shops, street lamps)
 * for a route or area with caching and mirror fallback.
 */
export async function fetchSafetyPOIs(lngLatCoords = [], signal) {
  const bbox = computeBBox(lngLatCoords, 0.003);
  if (!bbox) {
    return { police: [], medical: [], activePlaces: [], streetLampsCount: 0, fromCache: false };
  }

  const cacheKey = `herway_poi_${bbox.south}_${bbox.west}_${bbox.north}_${bbox.east}`;
  const cached = getStorageCache(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="police"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["amenity"="police"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["amenity"~"hospital|clinic|pharmacy"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["shop"~"convenience|supermarket|chemist|kiosk"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["amenity"~"cafe|fuel"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["highway"="street_lamp"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center 250;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) continue;

      const json = await res.json();
      const elements = Array.isArray(json?.elements) ? json.elements : [];

      const police = [];
      const medical = [];
      const activePlaces = [];
      let streetLampsCount = 0;

      for (const el of elements) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const tags = el.tags || {};

        if (tags.highway === 'street_lamp') {
          streetLampsCount += 1;
          continue;
        }

        if (typeof lat !== 'number' || typeof lng !== 'number') continue;

        const item = {
          id: `osm-${el.type}-${el.id}`,
          name: tags.name || tags.amenity || tags.shop || 'Safety Point',
          kind: tags.amenity || tags.shop || 'place',
          lat,
          lng,
        };

        if (tags.amenity === 'police') {
          police.push(item);
        } else if (['hospital', 'clinic', 'pharmacy'].includes(tags.amenity)) {
          medical.push(item);
        } else {
          activePlaces.push(item);
        }
      }

      const result = {
        police,
        medical,
        activePlaces,
        streetLampsCount,
      };

      setStorageCache(cacheKey, result);
      return { ...result, fromCache: false };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      // Try next Overpass mirror
    }
  }

  // Graceful fallback if Overpass mirrors are busy/throttled
  return {
    police: [],
    medical: [],
    activePlaces: [],
    streetLampsCount: 0,
    fromCache: false,
    degraded: true,
  };
}