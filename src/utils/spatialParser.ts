export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GroundedSource {
  id: string;
  kind: 'maps' | 'web';
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export type GroundingMode = 'auto' | 'maps' | 'search';
export type ChatbotRoleId = 'concierge' | 'urbanist' | 'transit' | 'culinary';
export type GeminiModelId = 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon';
export type MapStyleId = 'standard' | 'roadmap' | 'satellite' | 'hybrid';

export interface MapStyleConfig {
  id: MapStyleId;
  label: string;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  description: string;
}

export const MAP_STYLE_OPTIONS: MapStyleConfig[] = [
  {
    id: 'standard',
    label: 'Standard',
    mapTypeId: 'roadmap',
    description: 'Default vector map with full landmarks',
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    mapTypeId: 'roadmap',
    description: 'Street and transit corridor layout',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    mapTypeId: 'satellite',
    description: 'High-resolution aerial imagery',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    mapTypeId: 'hybrid',
    description: 'Satellite imagery with street and place labels',
  },
];

export function resolveMapStyleConfig(styleId: string): MapStyleConfig {
  return (
    MAP_STYLE_OPTIONS.find((item) => item.id === styleId) || MAP_STYLE_OPTIONS[0]
  );
}

export interface ChatbotRole {
  id: ChatbotRoleId;
  label: string;
  shortDesc: string;
  defaultQuery: string;
}

export const CHATBOT_ROLES: ChatbotRole[] = [
  {
    id: 'concierge',
    label: 'Local Concierge',
    shortDesc: 'Neighborhood gems, hours, ratings, and curated itineraries',
    defaultQuery: 'What are the highest-rated specialty coffee roasters and bakeries near this area?',
  },
  {
    id: 'culinary',
    label: 'Culinary Scout',
    shortDesc: 'Dining institutions, regional dishes, and late-night kitchens',
    defaultQuery: 'Find iconic local restaurants with great outdoor or counter seating nearby.',
  },
  {
    id: 'urbanist',
    label: 'Urban Historian',
    shortDesc: 'Architecture, landmarks, museums, and cultural context',
    defaultQuery: 'What notable architectural landmarks, public plazas, and museums are within walking distance?',
  },
  {
    id: 'transit',
    label: 'Mobility & Access',
    shortDesc: 'Transit hubs, walkability, EV stations, and route logistics',
    defaultQuery: 'Where are the main transit hubs, ferry terminals, or bike-friendly corridors around here?',
  },
];

/**
 * Decides whether a user prompt should use Google Maps Grounding, Google Search Grounding, or both.
 */
export function determineGroundingStrategy(
  query: string,
  explicitMode: GroundingMode
): 'maps' | 'search' | 'both' {
  if (explicitMode === 'maps') return 'maps';
  if (explicitMode === 'search') return 'search';

  const normalized = query.toLowerCase();
  const searchSignals = [
    'news',
    'event',
    'events',
    'today',
    'tonight',
    'weather',
    'festival',
    'concert',
    'history',
    'founded',
    'schedule',
    '2026',
    'latest',
    'happening',
  ];
  const mapsSignals = [
    'near',
    'nearby',
    'restaurant',
    'coffee',
    'cafe',
    'hotel',
    'museum',
    'park',
    'bar',
    'bakery',
    'open',
    'rating',
    'address',
    'where is',
    'station',
    'walk',
    'closest',
    'best',
    'shop',
  ];

  const hasSearch = searchSignals.some((kw) => normalized.includes(kw));
  const hasMaps = mapsSignals.some((kw) => normalized.includes(kw));

  if (hasSearch && hasMaps) return 'both';
  if (hasSearch && !hasMaps) return 'search';
  return 'both';
}

/**
 * Extracts and deduplicates grounding chunks from Gemini's groundingMetadata
 * for both Google Maps (`chunk.maps`) and Google Search (`chunk.web`).
 */
export function extractGroundingSources(groundingMetadata: any): GroundedSource[] {
  if (!groundingMetadata || !Array.isArray(groundingMetadata.groundingChunks)) {
    return [];
  }

  const seenUris = new Set<string>();
  const sources: GroundedSource[] = [];

  for (let i = 0; i < groundingMetadata.groundingChunks.length; i++) {
    const chunk = groundingMetadata.groundingChunks[i];
    if (!chunk) continue;

    if (chunk.maps && typeof chunk.maps.uri === 'string' && chunk.maps.uri.trim() !== '') {
      const uri = chunk.maps.uri.trim();
      if (!seenUris.has(uri)) {
        seenUris.add(uri);
        const snippets: string[] = [];
        const rawSnippets = chunk.maps.placeAnswerSources?.reviewSnippets;
        if (Array.isArray(rawSnippets)) {
          for (const s of rawSnippets) {
            const text = typeof s === 'string' ? s : s?.text || s?.reviewText || s?.snippet;
            if (typeof text === 'string' && text.trim()) {
              snippets.push(text.trim());
            }
          }
        }
        sources.push({
          id: `maps-${i}-${uri.slice(-12)}`,
          kind: 'maps',
          title: (chunk.maps.title || 'Google Maps Place').trim(),
          uri,
          reviewSnippets: snippets.length > 0 ? snippets : undefined,
        });
      }
    }

    if (chunk.web && typeof chunk.web.uri === 'string' && chunk.web.uri.trim() !== '') {
      const uri = chunk.web.uri.trim();
      if (!seenUris.has(uri)) {
        seenUris.add(uri);
        sources.push({
          id: `web-${i}-${uri.slice(-12)}`,
          kind: 'web',
          title: (chunk.web.title || 'Google Search Source').trim(),
          uri,
        });
      }
    }
  }

  return sources;
}

/**
 * Derives a concise text search query for the client-side Google Maps Places API (`Place.searchByText`)
 * based on the user's question and any grounded Google Maps place titles returned by Gemini.
 */
export function derivePlaceSearchQuery(
  userPrompt: string,
  mapsSources: GroundedSource[],
  activeCityName: string
): string {
  const mapTitles = mapsSources
    .filter((s) => s.kind === 'maps' && s.title && s.title !== 'Google Maps Place')
    .map((s) => s.title);

  if (mapTitles.length > 0) {
    return `${mapTitles[0]} ${activeCityName}`.trim();
  }

  const cleaned = userPrompt
    .replace(/^(what|where|which|can you|please|tell me|find|show me|search for|recommend|are there any)\s+/i, '')
    .replace(/^(are|is)\s+(the\s+)?/i, '')
    .replace(/[?!.]+$/g, '')
    .trim();

  if (!cleaned) {
    return `Points of interest in ${activeCityName}`;
  }

  if (cleaned.toLowerCase().includes(activeCityName.split(',')[0].toLowerCase())) {
    return cleaned.slice(0, 90);
  }

  return `${cleaned.slice(0, 70)} in ${activeCityName}`;
}

/**
 * Calculates great-circle distance in kilometers between two LatLng coordinates.
 */
export function calculateHaversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Number((R * c).toFixed(2));
}

/**
 * Formats latitude and longitude into a clean tabular coordinate string.
 */
export function formatCoordinate(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

/**
 * Builds the system instruction for the multi-turn Gemini chatbot based on the active role and map viewport.
 */
export function buildSystemInstruction(
  roleId: ChatbotRoleId,
  activeCityName: string,
  center: LatLngLiteral
): string {
  const rolePrompts: Record<ChatbotRoleId, string> = {
    concierge:
      'You are AtlasPulse Local Concierge, a spatial intelligence assistant specializing in neighborhood discovery, local institutions, hours, ratings, and practical visitor advice.',
    culinary:
      'You are AtlasPulse Culinary Scout, an expert food and dining specialist focusing on authentic local kitchens, specialty coffee roasters, bakeries, and dining logistics.',
    urbanist:
      'You are AtlasPulse Urban Historian & Architect, focusing on civic landmarks, architectural heritage, museums, public plazas, and neighborhood history.',
    transit:
      'You are AtlasPulse Mobility & Transit Planner, focusing on walkability, public transit connections, ferry/rail access, cycling routes, and travel times.',
  };

  const baseRole = rolePrompts[roleId] || rolePrompts.concierge;

  return `${baseRole}
Current Map Focus: ${activeCityName} (Coordinates: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}).
Guidelines:
1. Ground your answers in real-time Google Maps and Google Search data for ${activeCityName} and the surrounding coordinates.
2. Mention specific place names clearly so the interactive map can highlight them for the user.
3. Include practical details such as neighborhood context, why a place stands out, and what to check before visiting.
4. Keep responses well-structured with concise sections or bullet points (around 120-220 words unless asked for a detailed itinerary).`;
}

export type TravelMode = 'WALKING' | 'DRIVING' | 'BICYCLING' | 'TRANSIT';

export interface RouteColorOption {
  id: string;
  label: string;
  hex: string;
}

export const ROUTE_COLOR_PRESETS: RouteColorOption[] = [
  { id: 'blue', label: 'Sapphire Blue', hex: '#2563eb' },
  { id: 'emerald', label: 'Emerald Green', hex: '#059669' },
  { id: 'purple', label: 'Royal Violet', hex: '#7c3aed' },
  { id: 'amber', label: 'Warm Amber', hex: '#d97706' },
  { id: 'rose', label: 'Vibrant Rose', hex: '#e11d48' },
];

/**
 * Calculates total cumulative distance and estimated travel durations between an ordered sequence of coordinates.
 */
export function calculateMultiStopMetrics(
  coordinates: LatLngLiteral[],
  travelMode: TravelMode = 'WALKING'
): {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  formattedDistance: string;
  formattedDuration: string;
} {
  if (coordinates.length < 2) {
    return {
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      formattedDistance: '0 km',
      formattedDuration: '0 mins',
    };
  }

  let totalKm = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalKm += calculateHaversineDistanceKm(coordinates[i], coordinates[i + 1]);
  }

  totalKm = Number(totalKm.toFixed(2));

  // Average speeds: WALKING: 4.8 km/h, DRIVING: 32 km/h, BICYCLING: 15 km/h, TRANSIT: 24 km/h
  const speedKmh: Record<TravelMode, number> = {
    WALKING: 4.8,
    DRIVING: 32,
    BICYCLING: 15,
    TRANSIT: 24,
  };

  const speed = speedKmh[travelMode] || 4.8;
  const totalMinutes = Math.max(1, Math.round((totalKm / speed) * 60));

  const formattedDistance =
    totalKm < 1 ? `${Math.round(totalKm * 1000)} m` : `${totalKm} km`;

  let formattedDuration = `${totalMinutes} min`;
  if (totalMinutes >= 60) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    formattedDuration = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }

  return {
    totalDistanceKm: totalKm,
    totalDurationMinutes: totalMinutes,
    formattedDistance,
    formattedDuration,
  };
}

