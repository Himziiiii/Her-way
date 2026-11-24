// src/services/safetyScorer.js
import { haversineMeters } from './geoProvider';

const CATEGORY_WEIGHTS = {
  well_lit: 7,
  crowded_safe: 8,
  police_patrol: 10,
  poor_lighting: -12,
  deserted: -11,
  blocked_construction: -6,
  harassment_alert: -22,
};

const SEGMENT_COLORS = {
  safe: '#16a34a',
  moderate: '#d97706',
  caution: '#dc2626',
};

export function getTimeContext(date = new Date()) {
  const hour = date.getHours();
  const isNight = hour >= 20 || hour < 6;
  const isEveningTransition = hour >= 18 && hour < 20;

  return {
    hour,
    isNight,
    isEveningTransition,
    label: isNight
      ? 'Night Window (8 PM – 6 AM)'
      : isEveningTransition
        ? 'Dusk / Evening (6 PM – 8 PM)'
        : 'Daytime Window (6 AM – 6 PM)',
    nightMultiplier: isNight ? 1.5 : isEveningTransition ? 1.2 : 1.0,
  };
}

export function getRecencyWeight(createdAt, nowMs = Date.now()) {
  const createdMs = createdAt ? new Date(createdAt).getTime() : nowMs;
  const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));

  if (ageHours <= 3) return 2.0;
  if (ageHours <= 12) return 1.6;
  if (ageHours <= 24) return 1.25;
  if (ageHours <= 48) return 0.85;
  return 0.45;
}

function countNearbyPoints(routeLatLngs, points = [], radiusMeters = 180) {
  if (!Array.isArray(points) || points.length === 0 || !Array.isArray(routeLatLngs)) {
    return 0;
  }

  const stride = Math.max(1, Math.floor(routeLatLngs.length / 80));
  let matchCount = 0;

  for (const pt of points) {
    if (typeof pt?.lat !== 'number' || typeof pt?.lng !== 'number') continue;
    let nearRoute = false;

    for (let i = 0; i < routeLatLngs.length; i += stride) {
      const [rLat, rLng] = routeLatLngs[i];
      if (haversineMeters(rLat, rLng, pt.lat, pt.lng) <= radiusMeters) {
        nearRoute = true;
        break;
      }
    }

    if (nearRoute) matchCount += 1;
  }

  return matchCount;
}

export function scoreCandidateRoute(route, context = {}) {
  const {
    reports = [],
    safetyPOIs = { police: [], medical: [], activePlaces: [], streetLampsCount: 0 },
    preferences = {
      prioritize_lighting: true,
      avoid_deserted: true,
      night_mode_strict: true,
    },
    now = new Date(),
  } = context;

  const timeCtx = getTimeContext(now);
  const nightScale =
    preferences.night_mode_strict === false
      ? Math.max(1.0, timeCtx.nightMultiplier * 0.85)
      : timeCtx.nightMultiplier;

  let score = 74;
  const reasons = [];
  const warnings = [];

  const policeNearby = countNearbyPoints(route.latLngCoords, safetyPOIs.police, 250);
  const medicalNearby = countNearbyPoints(route.latLngCoords, safetyPOIs.medical, 250);
  const activeSpotsNearby = countNearbyPoints(route.latLngCoords, safetyPOIs.activePlaces, 160);
  const lampsCount = safetyPOIs.streetLampsCount || 0;

  if (policeNearby > 0) {
    const bonus = Math.min(10, policeNearby * 5);
    score += bonus;
    reasons.push(`${policeNearby} police point${policeNearby > 1 ? 's' : ''} near corridor`);
  }

  if (medicalNearby > 0) {
    const bonus = Math.min(6, medicalNearby * 3);
    score += bonus;
    reasons.push(`${medicalNearby} clinic/hospital/pharmacy nearby`);
  }

  if (activeSpotsNearby > 0) {
    const activeBonus =
      Math.min(10, Math.round(activeSpotsNearby * 1.5)) * (timeCtx.isNight ? 1.25 : 1);
    score += activeBonus;
    reasons.push(
      `${activeSpotsNearby} open shop/cafe/fuel spot${activeSpotsNearby > 1 ? 's' : ''} along route`
    );
  } else if (timeCtx.isNight && preferences.avoid_deserted !== false) {
    score -= 6;
    warnings.push('Few active commercial spots mapped for late-night hours');
  }

  if (lampsCount > 0) {
    const lampBonus =
      Math.min(6, Math.floor(lampsCount / 4)) *
      (preferences.prioritize_lighting !== false ? 1.2 : 0.8);
    score += lampBonus;
    reasons.push(`${lampsCount} mapped streetlamp${lampsCount > 1 ? 's' : ''} in corridor area`);
  } else if (timeCtx.isNight && preferences.prioritize_lighting !== false) {
    score -= 5;
    warnings.push('Limited mapped streetlighting in this stretch');
  }

  const matchedReports = [];
  let reportDeltaTotal = 0;

  for (const rep of reports) {
    if (typeof rep?.lat !== 'number' || typeof rep?.lng !== 'number') continue;

    const samplePts = route.sampledLngLat?.length
      ? route.sampledLngLat
      : route.lngLatCoords.map(([lng, lat]) => [lng, lat]);
    let minDist = Infinity;
    for (const [lng, lat] of samplePts) {
      const d = haversineMeters(lat, lng, rep.lat, rep.lng);
      if (d < minDist) minDist = d;
    }

    if (minDist <= 160) {
      const baseWeight = CATEGORY_WEIGHTS[rep.category] ?? 0;
      const recency = getRecencyWeight(rep.created_at, now.getTime());
      const upvoteBoost = 1 + Math.min(0.6, (rep.upvotes || 0) * 0.08);

      let prefMultiplier = 1;
      if (rep.category === 'poor_lighting' && preferences.prioritize_lighting !== false) {
        prefMultiplier = 1.25;
      }
      if (rep.category === 'deserted' && preferences.avoid_deserted !== false) {
        prefMultiplier = 1.25;
      }

      const timeMultiplier =
        baseWeight < 0 && rep.category !== 'blocked_construction' ? nightScale : 1;
      const weightedDelta = baseWeight * recency * upvoteBoost * prefMultiplier * timeMultiplier;

      reportDeltaTotal += weightedDelta;
      matchedReports.push({
        ...rep,
        distanceMeters: Math.round(minDist),
        weightedDelta: Number(weightedDelta.toFixed(1)),
      });
    }
  }

  const clampedReportDelta = Math.max(-32, Math.min(24, reportDeltaTotal));
  score += clampedReportDelta;

  const positiveReports = matchedReports.filter((r) => r.weightedDelta > 0);
  const negativeReports = matchedReports.filter((r) => r.weightedDelta < 0);

  if (positiveReports.length > 0) {
    reasons.push(
      `${positiveReports.length} recent positive safety report${positiveReports.length > 1 ? 's' : ''}`
    );
  }
  for (const neg of negativeReports.slice(0, 3)) {
    const label = neg.category.replace(/_/g, ' ');
    warnings.push(`${label} reported nearby (~${neg.distanceMeters}m)`);
  }

  const finalScore = Math.max(15, Math.min(99, Math.round(score)));
  const segments = buildColoredSegments(route.latLngCoords, negativeReports, positiveReports);

  const badge =
    finalScore >= 82
      ? 'High Safety Score'
      : finalScore >= 65
        ? 'Moderate Safety'
        : 'Caution Advised';
  const badgeTone = finalScore >= 82 ? 'emerald' : finalScore >= 65 ? 'amber' : 'rose';

  if (reasons.length === 0) {
    reasons.push('Standard mapped road corridor; add live community reports to refine');
  }

  return {
    ...route,
    safetyScore: finalScore,
    badge,
    badgeTone,
    timeContext: timeCtx,
    reasons: reasons.slice(0, 4),
    warnings: warnings.slice(0, 4),
    matchedReports,
    segments,
  };
}

function buildColoredSegments(latLngCoords = [], negativeReports = [], positiveReports = []) {
  if (!Array.isArray(latLngCoords) || latLngCoords.length < 2) {
    return [];
  }

  const chunkSize = Math.max(2, Math.floor(latLngCoords.length / 10));
  const segments = [];

  for (let i = 0; i < latLngCoords.length - 1; i += chunkSize) {
    const endIdx = Math.min(latLngCoords.length - 1, i + chunkSize);
    const slice = latLngCoords.slice(i, endIdx + 1);
    const midPt = slice[Math.floor(slice.length / 2)];

    let riskScore = 0;
    for (const neg of negativeReports) {
      const dist = haversineMeters(midPt[0], midPt[1], neg.lat, neg.lng);
      if (dist <= 180) {
        riskScore += Math.abs(neg.weightedDelta || 10);
      }
    }

    let safeScore = 0;
    for (const pos of positiveReports) {
      const dist = haversineMeters(midPt[0], midPt[1], pos.lat, pos.lng);
      if (dist <= 180) {
        safeScore += pos.weightedDelta || 6;
      }
    }

    let color = SEGMENT_COLORS.safe;
    let level = 'safe';
    if (riskScore >= 16) {
      color = SEGMENT_COLORS.caution;
      level = 'caution';
    } else if (riskScore >= 7 || (safeScore === 0 && negativeReports.length > 0)) {
      color = SEGMENT_COLORS.moderate;
      level = 'moderate';
    }

    segments.push({
      positions: slice,
      color,
      level,
    });
  }

  return segments;
}

export function rankRoutesBySafety(routes = [], context = {}) {
  if (!Array.isArray(routes) || routes.length === 0) return [];

  const scored = routes.map((r) => scoreCandidateRoute(r, context));

  let safestId = scored[0].id;
  let fastestId = scored[0].id;

  for (const r of scored) {
    const currentSafest = scored.find((item) => item.id === safestId);
    if (
      r.safetyScore > currentSafest.safetyScore ||
      (r.safetyScore === currentSafest.safetyScore && r.durationSeconds < currentSafest.durationSeconds)
    ) {
      safestId = r.id;
    }

    const currentFastest = scored.find((item) => item.id === fastestId);
    if (r.durationSeconds < currentFastest.durationSeconds) {
      fastestId = r.id;
    }
  }

  return scored
    .map((r) => {
      const tags = [];
      if (r.id === safestId) tags.push('Safest Route');
      if (r.id === fastestId) tags.push('Fastest');
      if (tags.length === 0) tags.push('Alternative');

      return {
        ...r,
        routeTags: tags,
        isRecommendedSafest: r.id === safestId,
      };
    })
    .sort((a, b) => {
      if (a.isRecommendedSafest && !b.isRecommendedSafest) return -1;
      if (!a.isRecommendedSafest && b.isRecommendedSafest) return 1;
      return b.safetyScore - a.safetyScore;
    });
}