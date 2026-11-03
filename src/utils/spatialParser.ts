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
export type ChatbotRoleId =
  | 'concierge'
  | 'culinary'
  | 'urbanist'
  | 'transit'
  | 'nightlife'
  | 'outdoors'
  | 'work'
  | 'family';
export type GeminiModelId =
  | 'gemini-3.8-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-flash-latest'
  | 'gemini-4-argon';
export type MapStyleId =
  | 'standard'
  | 'roadmap'
  | 'satellite'
  | 'hybrid'
  | 'high-contrast';

export interface MapPinPalette {
  defaultBg: string;
  defaultBorder: string;
  defaultGlyph: string;
  selectedBg: string;
  selectedBorder: string;
  selectedGlyph: string;
  defaultScale: number;
  selectedScale: number;
}

export interface MapStyleConfig {
  id: MapStyleId;
  label: string;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  description: string;
  isHighContrast?: boolean;
  colorScheme?: 'LIGHT' | 'DARK';
  canvasFilter?: string;
  pinPalette: MapPinPalette;
  customMapStyles?: Array<{
    featureType?: string;
    elementType?: string;
    stylers: Array<Record<string, string | number>>;
  }>;
}

const STANDARD_PIN_PALETTE: MapPinPalette = {
  defaultBg: '#0f172a',
  defaultBorder: '#475569',
  defaultGlyph: '#ffffff',
  selectedBg: '#1d4ed8',
  selectedBorder: '#ffffff',
  selectedGlyph: '#ffffff',
  defaultScale: 1.05,
  selectedScale: 1.25,
};

const HIGH_CONTRAST_PIN_PALETTE: MapPinPalette = {
  defaultBg: '#facc15', // WCAG AAA High-Visibility Safety Yellow
  defaultBorder: '#000000',
  defaultGlyph: '#000000',
  selectedBg: '#22d3ee', // High-Luminance Electric Cyan
  selectedBorder: '#000000',
  selectedGlyph: '#000000',
  defaultScale: 1.22,
  selectedScale: 1.42,
};

export const HIGH_CONTRAST_MAP_STYLES: Array<{
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string | number>>;
}> = [
  { elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }, { weight: 4 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#facc15' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#000000' }, { weight: 2 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#022c43' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#064e3b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#fde047' }],
  },
];

export const MAP_STYLE_OPTIONS: MapStyleConfig[] = [
  {
    id: 'standard',
    label: 'Standard',
    mapTypeId: 'roadmap',
    description: 'Default vector map with full landmarks',
    colorScheme: 'LIGHT',
    pinPalette: STANDARD_PIN_PALETTE,
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    mapTypeId: 'roadmap',
    description: 'Street and transit corridor layout',
    colorScheme: 'LIGHT',
    pinPalette: STANDARD_PIN_PALETTE,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    mapTypeId: 'satellite',
    description: 'High-resolution aerial imagery',
    colorScheme: 'LIGHT',
    pinPalette: STANDARD_PIN_PALETTE,
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    mapTypeId: 'hybrid',
    description: 'Satellite imagery with street and place labels',
    colorScheme: 'LIGHT',
    pinPalette: STANDARD_PIN_PALETTE,
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    mapTypeId: 'roadmap',
    description:
      'High-contrast accessibility mode (WCAG AAA enhanced labels, bold road outlines, and high-visibility yellow/black pins for low vision)',
    isHighContrast: true,
    colorScheme: 'DARK',
    canvasFilter: 'contrast(1.38) saturate(1.25) brightness(1.05)',
    pinPalette: HIGH_CONTRAST_PIN_PALETTE,
    customMapStyles: HIGH_CONTRAST_MAP_STYLES,
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
  specialtyBadge: string;
  shortDesc: string;
  defaultQuery: string;
  recommendedGrounding: GroundingMode;
  samplePrompts: string[];
}

export const CHATBOT_ROLES: ChatbotRole[] = [
  {
    id: 'concierge',
    label: 'Local Concierge',
    specialtyBadge: 'Discovery',
    shortDesc: 'Neighborhood gems, hours, ratings, and curated itineraries',
    defaultQuery:
      'What are the highest-rated specialty coffee roasters and bakeries near this area?',
    recommendedGrounding: 'auto',
    samplePrompts: [
      'What are the highest-rated specialty coffee roasters and bakeries near this area?',
      'Plan a 3-stop walkable afternoon itinerary around here with ratings and hours.',
      'What hidden neighborhood gems do locals love within 15 minutes of here?',
    ],
  },
  {
    id: 'culinary',
    label: 'Culinary Scout',
    specialtyBadge: 'Dining & Coffee',
    shortDesc: 'Dining institutions, regional dishes, and late-night kitchens',
    defaultQuery:
      'Find iconic local restaurants with great outdoor or counter seating nearby.',
    recommendedGrounding: 'maps',
    samplePrompts: [
      'Find iconic local restaurants with great outdoor or counter seating nearby.',
      'Where can I find authentic regional specialties and standout street food around here?',
      'Which highly rated bakeries, dessert spots, or wine bars are open right now?',
    ],
  },
  {
    id: 'urbanist',
    label: 'Urban Historian',
    specialtyBadge: 'Culture & Design',
    shortDesc: 'Architecture, landmarks, museums, and cultural context',
    defaultQuery:
      'What notable architectural landmarks, public plazas, and museums are within walking distance?',
    recommendedGrounding: 'auto',
    samplePrompts: [
      'What notable architectural landmarks, public plazas, and museums are within walking distance?',
      'Tell me the historical backstory of this neighborhood and its oldest civic buildings.',
      'Which contemporary art galleries, cultural centers, or historic theaters are nearby?',
    ],
  },
  {
    id: 'transit',
    label: 'Mobility & Access',
    specialtyBadge: 'Transit & Routes',
    shortDesc: 'Transit hubs, walkability, EV stations, and route logistics',
    defaultQuery:
      'Where are the main transit hubs, ferry terminals, or bike-friendly corridors around here?',
    recommendedGrounding: 'maps',
    samplePrompts: [
      'Where are the main transit hubs, ferry terminals, or bike-friendly corridors around here?',
      'How walkable is this corridor and what are the best rail or bus connections nearby?',
      'Where are the nearest public parking garages and EV charging stations?',
    ],
  },
  {
    id: 'nightlife',
    label: 'Nightlife & Music',
    specialtyBadge: 'After Hours',
    shortDesc: 'Jazz clubs, listening bars, rooftop lounges, and live gigs',
    defaultQuery:
      'Where are the best live music venues, jazz clubs, and craft cocktail lounges near here?',
    recommendedGrounding: 'auto',
    samplePrompts: [
      'Where are the best live music venues, jazz clubs, and craft cocktail lounges near here?',
      'Recommend a rooftop bar or listening lounge with great ambiance for tonight.',
      'What late-night dining spots and evening entertainment are open past 10 PM nearby?',
    ],
  },
  {
    id: 'outdoors',
    label: 'Nature & Trails',
    specialtyBadge: 'Parks & Views',
    shortDesc: 'Scenic overlooks, urban parks, botanical gardens, and coastal walks',
    defaultQuery:
      'What are the most scenic parks, waterfront trails, and viewpoints near this location?',
    recommendedGrounding: 'maps',
    samplePrompts: [
      'What are the most scenic parks, waterfront trails, and viewpoints near this location?',
      'Where are the best golden-hour photography overlooks or botanical gardens nearby?',
      'Find dog-friendly parks and green walking loops within a short distance.',
    ],
  },
  {
    id: 'work',
    label: 'Remote Work Scout',
    specialtyBadge: 'Laptop & Wi-Fi',
    shortDesc: 'Laptop-friendly cafes, quiet libraries, and coworking lounges',
    defaultQuery:
      'Which cafes, public libraries, or lounges nearby are best for remote work and studying?',
    recommendedGrounding: 'maps',
    samplePrompts: [
      'Which cafes, public libraries, or lounges nearby are best for remote work and studying?',
      'Where can I find spacious seating, reliable Wi-Fi, and great espresso for a 2-hour work block?',
      'Are there quiet reading rooms, hotel lobbies, or day-pass coworking spaces around here?',
    ],
  },
  {
    id: 'family',
    label: 'Family & Access',
    specialtyBadge: 'All-Ages & Step-Free',
    shortDesc: 'Kid-friendly attractions, interactive museums, and step-free access',
    defaultQuery:
      'What are the best family-friendly attractions, interactive museums, and accessible parks nearby?',
    recommendedGrounding: 'auto',
    samplePrompts: [
      'What are the best family-friendly attractions, interactive museums, and accessible parks nearby?',
      'Recommend stroller-friendly and step-free places to visit with casual family dining nearby.',
      'Where are hands-on science centers, playgrounds, or calm rest stops in this area?',
    ],
  },
];

export function getBotRoleById(roleId?: string): ChatbotRole {
  return CHATBOT_ROLES.find((r) => r.id === roleId) || CHATBOT_ROLES[0];
}

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
      'You are AtlasPulse Culinary Scout, an expert food and dining specialist focusing on authentic local kitchens, specialty coffee roasters, bakeries, signature regional dishes, and dining logistics.',
    urbanist:
      'You are AtlasPulse Urban Historian & Architect, focusing on civic landmarks, architectural heritage, museums, galleries, public plazas, and neighborhood history.',
    transit:
      'You are AtlasPulse Mobility & Transit Planner, focusing on walkability, public transit connections, ferry/rail access, cycling routes, EV charging, and travel times.',
    nightlife:
      'You are AtlasPulse Nightlife & Live Music Curator, specializing in jazz clubs, vinyl listening bars, rooftop cocktail lounges, indie concert venues, and vibrant late-night neighborhoods.',
    outdoors:
      'You are AtlasPulse Nature & Trails Explorer, specializing in urban parks, botanical gardens, coastal and riverfront trails, scenic viewpoints, and outdoor recreation.',
    work:
      'You are AtlasPulse Remote Work & Study Scout, specializing in laptop-friendly specialty cafes, quiet public libraries, coworking lounges, seating comfort, and work-friendly amenities.',
    family:
      'You are AtlasPulse Family & Accessibility Guide, specializing in all-ages attractions, interactive science and children’s museums, playgrounds, step-free wheelchair/stroller accessibility, and welcoming family dining.',
  };

  const baseRole = rolePrompts[roleId] || rolePrompts.concierge;

  return `${baseRole}
Current Exact Map Focus: ${activeCityName} (Exact GPS Coordinates: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)} / ${formatCoordinate(center.lat, center.lng)}).
Guidelines:
1. Ground your answers in real-time Google Maps and Google Search data for ${activeCityName} and the exact surrounding coordinates (${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}).
2. Mention specific place names and exact street addresses clearly so the interactive map can highlight them for the user.
3. Include practical details such as neighborhood context, walking distance from the user's exact coordinates, why a place stands out, and what to check before visiting.
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

export type DeviceViewMode = 'auto' | 'pc' | 'android';
export type EffectiveDevicePlatform = 'pc' | 'android';
export type MobileWorkspacePane = 'chat' | 'map';

/**
 * Detects whether the current environment is an Android browser or mobile viewport.
 */
export function detectAndroidOrMobile(
  userAgent: string,
  viewportWidth: number
): boolean {
  const ua = (userAgent || '').toLowerCase();
  const isMobileUserAgent = /android|mobile|wv|silk|mobi|iphone|ipad/i.test(ua);
  const isNarrowViewport = viewportWidth > 0 && viewportWidth < 768;
  return isMobileUserAgent || isNarrowViewport;
}

/**
 * Resolves the effective platform ('pc' or 'android') from the user-selected mode,
 * browser user-agent string, and current viewport width.
 */
export function resolveEffectiveDevicePlatform(
  mode: DeviceViewMode,
  userAgent: string,
  viewportWidth: number
): EffectiveDevicePlatform {
  if (mode === 'pc') return 'pc';
  if (mode === 'android') return 'android';
  return detectAndroidOrMobile(userAgent, viewportWidth) ? 'android' : 'pc';
}

/**
 * Returns a deduplicated ordered list of Gemini models to try so that if one model's
 * rate-limit bucket is exhausted (429), the server automatically tries lighter/alternate models.
 */
export function getModelFallbackChain(
  primaryModel: GeminiModelId
): GeminiModelId[] {
  const candidates: GeminiModelId[] = [
    primaryModel,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];
  return Array.from(new Set(candidates));
}

/**
 * Checks whether an error message or payload indicates a 429 rate-limit or quota exhaustion error.
 */
export function isQuotaOrRateLimitError(rawMessage: string): boolean {
  const normalized = (rawMessage || '').toLowerCase();
  return (
    normalized.includes('429') ||
    normalized.includes('resource_exhausted') ||
    normalized.includes('exceeded your current quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  );
}

/**
 * Builds a grounded spatial fallback response when the Gemini API key reaches its 429 quota limit,
 * ensuring the interactive Google Map still plots live places via Places API and provides direct
 * Google Maps & Search links without failing the user's request.
 */
export function buildQuotaFallbackReply(params: {
  userQuery: string;
  roleId: ChatbotRoleId;
  activeCityName: string;
  center: LatLngLiteral;
}): {
  reply: string;
  sources: GroundedSource[];
  suggestedPlaceQuery: string;
  modelNote: string;
} {
  const { userQuery, roleId, activeCityName, center } = params;
  const botRole = getBotRoleById(roleId);
  const suggestedPlaceQuery = derivePlaceSearchQuery(
    userQuery,
    [],
    activeCityName
  );
  const coordText = formatCoordinate(center.lat, center.lng);
  const encodedQuery = encodeURIComponent(suggestedPlaceQuery);
  const encodedCity = encodeURIComponent(activeCityName);

  const sources: GroundedSource[] = [
    {
      id: `maps-fallback-${Date.now()}-1`,
      kind: 'maps',
      title: `${suggestedPlaceQuery} — Google Maps Live Directory`,
      uri: `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`,
      reviewSnippets: [
        `Live Google Maps search plotted around ${activeCityName} (${coordText}).`,
      ],
    },
    {
      id: `web-fallback-${Date.now()}-2`,
      kind: 'web',
      title: `${activeCityName} Local Guide & Current Hours — Google Search`,
      uri: `https://www.google.com/search?q=${encodedQuery}+${encodedCity}`,
    },
  ];

  const reply = `### ${botRole.label} — Live Map & Spatial Dispatch (${activeCityName})

I have plotted **${suggestedPlaceQuery}** on the interactive Google Map around **${activeCityName}** (\`${coordText}\`) using the live **Google Maps Places API**.

- **Live Map Pins Updated**: Inspect the numbered pins on the map or the **Live Google Maps Places** drawer to compare real-time ratings, review counts, distances, and exact addresses.
- **${botRole.specialtyBadge} Tip**: Select **Reviews** on any place card to fetch top-rated visitor reviews via the Google Places Details API, or bookmark stops to build a multi-stop walking or transit polyline in the **Route Planner**.
- **Note on AI Synthesis**: Your Gemini API key reached its current rate/quota limit (\`429 RESOURCE_EXHAUSTED\`), so live Google Maps place discovery has been activated directly. You can increase your Gemini API quota anytime in **Settings > Secrets**.`;

  return {
    reply,
    sources,
    suggestedPlaceQuery,
    modelNote:
      'Live Google Maps fallback active (Gemini API quota reached — check Settings > Secrets)',
  };
}

export type ChatLayoutMode = 'split' | 'wide' | 'fullscreen';

export interface ChatLayoutConfig {
  mode: ChatLayoutMode;
  label: string;
  shortLabel: string;
  description: string;
  chatColSpanClass: string;
  mapColSpanClass: string;
  showMapInWorkspace: boolean;
}

/**
 * Resolves the responsive grid column span and layout metadata for the AI Chat Box
 * so users can switch between 50/50 Split, Wide Chat (70/30), or Full-Screen AI Studio.
 */
export function resolveChatLayoutConfig(mode: ChatLayoutMode): ChatLayoutConfig {
  switch (mode) {
    case 'wide':
      return {
        mode: 'wide',
        label: 'Wide Chat (67% / 33%)',
        shortLabel: 'Wide',
        description: 'Expands the AI Chat box to 2/3 of the screen while keeping the live map docked on the right.',
        chatColSpanClass: 'lg:col-span-8 h-full min-h-0',
        mapColSpanClass: 'lg:col-span-4 h-full min-h-0',
        showMapInWorkspace: true,
      };
    case 'fullscreen':
      return {
        mode: 'fullscreen',
        label: 'Full-Screen AI Studio',
        shortLabel: 'Full Screen',
        description: 'Dedicates 100% of the workspace to an expanded AI Chat Studio with a live places quick-dispatch sidebar.',
        chatColSpanClass: 'lg:col-span-12 h-full min-h-0',
        mapColSpanClass: 'hidden',
        showMapInWorkspace: false,
      };
    case 'split':
    default:
      return {
        mode: 'split',
        label: 'Balanced Split (50% / 50%)',
        shortLabel: 'Split',
        description: 'Balanced 50/50 split between the AI Concierge chat and interactive Google Map.',
        chatColSpanClass: 'lg:col-span-6 h-full min-h-0',
        mapColSpanClass: 'lg:col-span-6 h-full min-h-0',
        showMapInWorkspace: true,
      };
  }
}

export type UserLocationSource =
  | 'gps'
  | 'pinpoint'
  | 'cached'
  | 'timezone'
  | 'fallback';

export interface ResolvedUserLocation {
  id: string;
  name: string;
  center: LatLngLiteral;
  zoom: number;
  initialSearchQuery: string;
  source: UserLocationSource;
  localityLabel: string;
  exactAddress?: string;
  accuracyMeters?: number;
  isUserLocation: boolean;
}

/**
 * Formats latitude and longitude to high-precision 6 decimal places (~0.11m exact GPS precision).
 */
export function formatExactCoordinate(
  lat: number,
  lng: number,
  decimals = 6
): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}°${latDir}, ${Math.abs(lng).toFixed(decimals)}°${lngDir}`;
}

/**
 * Parses a raw coordinate string (e.g. "37.7955, -122.3937" or "47.606200, -122.332100") into a LatLngLiteral.
 */
export function parseCoordinateInput(input: string): LatLngLiteral | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.trim();
  const match = cleaned.match(
    /^([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)$/
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/**
 * Extracts a clean street-level address from a Google Maps formattedAddress
 * (e.g., "1 Ferry Building, San Francisco, CA 94111, USA" -> "1 Ferry Building, San Francisco, CA 94111").
 */
export function extractExactStreetAddress(
  formattedAddress: string
): string | null {
  if (!formattedAddress || !formattedAddress.trim()) return null;
  const parts = formattedAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (
    parts.length >= 3 &&
    /^(USA|United States|UK|United Kingdom|Canada|Japan|Australia)$/i.test(
      parts[parts.length - 1]
    )
  ) {
    return parts.slice(0, -1).join(', ');
  }
  return parts.join(', ');
}

const KNOWN_LOCALITY_HUBS: Array<{
  name: string;
  exactAddress: string;
  center: LatLngLiteral;
  timeZones: string[];
}> = [
  {
    name: 'San Francisco, CA',
    exactAddress: '1 Ferry Building, Embarcadero, San Francisco, CA 94111',
    center: { lat: 37.7955, lng: -122.3937 },
    timeZones: ['America/Los_Angeles', 'US/Pacific'],
  },
  {
    name: 'New York, NY',
    exactAddress: 'Washington Square Park, Greenwich Village, New York, NY 10012',
    center: { lat: 40.7308, lng: -73.9973 },
    timeZones: ['America/New_York', 'US/Eastern'],
  },
  {
    name: 'Chicago, IL',
    exactAddress: '201 E Randolph St, Millennium Park, Chicago, IL 60602',
    center: { lat: 41.8826, lng: -87.6226 },
    timeZones: ['America/Chicago', 'US/Central'],
  },
  {
    name: 'Denver, CO',
    exactAddress: '1701 Wynkoop St, Union Station, Denver, CO 80202',
    center: { lat: 39.7392, lng: -104.9903 },
    timeZones: ['America/Denver', 'US/Mountain'],
  },
  {
    name: 'Phoenix, AZ',
    exactAddress: '200 W Washington St, Downtown Phoenix, AZ 85003',
    center: { lat: 33.4484, lng: -112.074 },
    timeZones: ['America/Phoenix'],
  },
  {
    name: 'Los Angeles, CA',
    exactAddress: '200 N Spring St, Downtown Los Angeles, CA 90012',
    center: { lat: 34.0522, lng: -118.2437 },
    timeZones: [],
  },
  {
    name: 'Seattle, WA',
    exactAddress: '85 Pike St, Pike Place Market, Seattle, WA 98101',
    center: { lat: 47.6062, lng: -122.3321 },
    timeZones: [],
  },
  {
    name: 'Austin, TX',
    exactAddress: '1100 Congress Ave, Downtown Austin, TX 78701',
    center: { lat: 30.2672, lng: -97.7431 },
    timeZones: [],
  },
  {
    name: 'Boston, MA',
    exactAddress: '1 City Hall Square, Boston, MA 02201',
    center: { lat: 42.3601, lng: -71.0589 },
    timeZones: [],
  },
  {
    name: 'Miami, FL',
    exactAddress: '401 Biscayne Blvd, Bayside, Miami, FL 33132',
    center: { lat: 25.7617, lng: -80.1918 },
    timeZones: [],
  },
  {
    name: 'Washington, DC',
    exactAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
    center: { lat: 38.9072, lng: -77.0369 },
    timeZones: [],
  },
  {
    name: 'Toronto, ON',
    exactAddress: '100 Queen St W, Downtown Toronto, ON M5H 2N2',
    center: { lat: 43.6532, lng: -79.3832 },
    timeZones: ['America/Toronto'],
  },
  {
    name: 'Vancouver, BC',
    exactAddress: '800 Robson St, Vancouver, BC V6Z 3B7',
    center: { lat: 49.2827, lng: -123.1207 },
    timeZones: ['America/Vancouver'],
  },
  {
    name: 'London, UK',
    exactAddress: 'Bankside, Southwark, London SE1 9TG, UK',
    center: { lat: 51.5079, lng: -0.0994 },
    timeZones: ['Europe/London', 'GMT', 'Etc/UTC', 'UTC'],
  },
  {
    name: 'Paris, France',
    exactAddress: 'Place de l’Hôtel de Ville, 75004 Paris, France',
    center: { lat: 48.8566, lng: 2.3522 },
    timeZones: ['Europe/Paris'],
  },
  {
    name: 'Berlin, Germany',
    exactAddress: 'Alexanderplatz 1, 10178 Berlin, Germany',
    center: { lat: 52.52, lng: 13.405 },
    timeZones: ['Europe/Berlin'],
  },
  {
    name: 'Tokyo, Japan',
    exactAddress: '2-2-1 Dogenzaka, Shibuya City, Tokyo 150-0043, Japan',
    center: { lat: 35.6595, lng: 139.7004 },
    timeZones: ['Asia/Tokyo'],
  },
  {
    name: 'Seoul, South Korea',
    exactAddress: '110 Sejong-daero, Jung-gu, Seoul, South Korea',
    center: { lat: 37.5665, lng: 126.978 },
    timeZones: ['Asia/Seoul'],
  },
  {
    name: 'Singapore',
    exactAddress: '10 Bayfront Ave, Marina Bay, Singapore 018956',
    center: { lat: 1.3521, lng: 103.8198 },
    timeZones: ['Asia/Singapore'],
  },
  {
    name: 'Sydney, Australia',
    exactAddress: 'Bennelong Point, Sydney NSW 2000, Australia',
    center: { lat: -33.8688, lng: 151.2093 },
    timeZones: ['Australia/Sydney'],
  },
];

/**
 * Finds the nearest known metropolitan locality within maxRadiusKm, or falls back to formatted coordinates.
 */
export function findNearestKnownLocality(
  coords: LatLngLiteral,
  maxRadiusKm = 65
): string {
  let closestName = '';
  let minDistance = Infinity;

  for (const hub of KNOWN_LOCALITY_HUBS) {
    const dist = calculateHaversineDistanceKm(coords, hub.center);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = hub.name;
    }
  }

  if (closestName && minDistance <= maxRadiusKm) {
    return closestName;
  }

  return formatCoordinate(coords.lat, coords.lng);
}

/**
 * Extracts a clean locality label (e.g. "San Francisco, CA" or "London, UK") from a Google Places formattedAddress.
 */
export function extractLocalityFromFormattedAddress(
  formattedAddress: string
): string | null {
  if (!formattedAddress || !formattedAddress.trim()) return null;
  const parts = formattedAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  // Typical US address: "1 Ferry Building, San Francisco, CA 94111, USA"
  if (parts.length >= 3) {
    const stateZipPart = parts[parts.length - 2];
    const cityPart = parts[parts.length - 3];
    const usStateMatch = stateZipPart.match(/^([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    if (usStateMatch && cityPart) {
      return `${cityPart}, ${usStateMatch[1]}`;
    }
  }

  // International address: "... , Shibuya City, Tokyo 150-0002, Japan"
  const countryPart = parts[parts.length - 1].replace(/\d+/g, '').trim();
  const regionPart = parts[parts.length - 2]
    .replace(/\b\d[\d\s-]*\b/g, '')
    .trim();
  if (regionPart && countryPart) {
    return `${regionPart}, ${countryPart}`;
  }

  return null;
}

/**
 * Builds a CityViewportPreset-compatible object representing the user's exact location.
 */
export function buildUserLocationPreset(params: {
  coords: LatLngLiteral;
  localityName?: string | null;
  exactAddress?: string | null;
  accuracyMeters?: number;
  source?: UserLocationSource;
  zoom?: number;
}): ResolvedUserLocation {
  const {
    coords,
    localityName,
    exactAddress,
    accuracyMeters,
    source = 'gps',
    zoom = 16,
  } = params;
  const resolvedLocality =
    localityName && localityName.trim().length > 0
      ? localityName.trim()
      : findNearestKnownLocality(coords);

  const cleanedExactAddress =
    exactAddress && exactAddress.trim().length > 0
      ? exactAddress.trim()
      : undefined;

  const isCoordinateLabel = resolvedLocality.includes('°');
  const queryContext = cleanedExactAddress
    ? `near ${cleanedExactAddress}`
    : isCoordinateLabel
    ? 'nearby'
    : `near ${resolvedLocality}`;

  const displayTarget = cleanedExactAddress || resolvedLocality;

  return {
    id: 'user-location',
    name: `My Location (${displayTarget})`,
    center: {
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
    },
    zoom,
    initialSearchQuery: `specialty coffee, top rated restaurants and landmarks ${queryContext}`,
    source,
    localityLabel: resolvedLocality,
    exactAddress: cleanedExactAddress,
    accuracyMeters:
      typeof accuracyMeters === 'number' && !Number.isNaN(accuracyMeters)
        ? Math.max(1, Math.round(accuracyMeters))
        : undefined,
    isUserLocation: true,
  };
}

/**
 * Resolves the initial default location preset to the user's exact location on startup.
 * Prioritizes cached user GPS coordinates from localStorage, then infers from the user's
 * browser timezone, and finally falls back to a default user location preset until live
 * navigator.geolocation resolves.
 */
export function resolveInitialUserLocationPreset(options?: {
  cachedJson?: string | null;
  timeZone?: string;
}): ResolvedUserLocation {
  if (options?.cachedJson) {
    try {
      const parsed = JSON.parse(options.cachedJson);
      if (
        parsed &&
        typeof parsed.lat === 'number' &&
        typeof parsed.lng === 'number' &&
        !Number.isNaN(parsed.lat) &&
        !Number.isNaN(parsed.lng)
      ) {
        return buildUserLocationPreset({
          coords: { lat: parsed.lat, lng: parsed.lng },
          localityName:
            typeof parsed.localityLabel === 'string'
              ? parsed.localityLabel
              : undefined,
          exactAddress:
            typeof parsed.exactAddress === 'string'
              ? parsed.exactAddress
              : undefined,
          accuracyMeters:
            typeof parsed.accuracyMeters === 'number'
              ? parsed.accuracyMeters
              : undefined,
          source: 'cached',
          zoom: 16,
        });
      }
    } catch {
      // Ignore malformed JSON cache
    }
  }

  const tz = options?.timeZone?.trim() || '';
  if (tz) {
    const matchedHub = KNOWN_LOCALITY_HUBS.find((h) =>
      h.timeZones.includes(tz)
    );
    if (matchedHub) {
      return buildUserLocationPreset({
        coords: matchedHub.center,
        localityName: matchedHub.name,
        exactAddress: matchedHub.exactAddress,
        source: 'timezone',
        zoom: 16,
      });
    }
  }

  return buildUserLocationPreset({
    coords: KNOWN_LOCALITY_HUBS[0].center,
    localityName: KNOWN_LOCALITY_HUBS[0].name,
    exactAddress: KNOWN_LOCALITY_HUBS[0].exactAddress,
    source: 'fallback',
    zoom: 16,
  });
}

/**
 * Constructs the standard initial welcome greeting for AtlasPulse.
 * Real-time Google Maps and Google Search grounding spans all over the world.
 */
export function buildInitialGreetingMessage(_cityName?: string): string {
  return `Welcome to **AtlasPulse**. I am grounded in real-time **Google Maps** and **Google Search** data all over the world.\n\nSwitch between **8 specialized AI bots** above—including **Local Concierge**, **Culinary Scout**, **Urban Historian**, **Mobility & Access**, **Nightlife & Music**, **Nature & Trails**, **Remote Work Scout**, and **Family & Access**—to explore verified places and plot them directly on the map.`;
}

