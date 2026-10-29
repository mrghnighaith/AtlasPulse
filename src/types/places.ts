import {
  ChatbotRoleId,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
} from '../utils/spatialParser';

export interface LivePlaceItem {
  id: string;
  displayName: string;
  formattedAddress: string;
  location: LatLngLiteral;
  rating?: number;
  userRatingCount?: number;
  isOpenNow?: boolean;
  priceLevel?: string;
  primaryTypeDisplayName?: string;
  googleMapsURI?: string;
  websiteURI?: string;
  distanceKm?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  sources?: GroundedSource[];
  suggestedPlaceQuery?: string;
  usedModel?: GeminiModelId;
  modelNote?: string;
  strategyUsed?: 'maps' | 'search' | 'both';
  roleId?: ChatbotRoleId;
}

export interface CityViewportPreset {
  id: string;
  name: string;
  center: LatLngLiteral;
  zoom: number;
  initialSearchQuery: string;
}

export const CITY_VIEWPORT_PRESETS: CityViewportPreset[] = [
  {
    id: 'sf',
    name: 'San Francisco, CA',
    center: { lat: 37.7955, lng: -122.3937 },
    zoom: 14,
    initialSearchQuery: 'specialty coffee and bakeries near Embarcadero San Francisco',
  },
  {
    id: 'nyc',
    name: 'New York, NY',
    center: { lat: 40.7308, lng: -73.9973 },
    zoom: 14,
    initialSearchQuery: 'cultural landmarks and cafes near Washington Square Park New York',
  },
  {
    id: 'tokyo',
    name: 'Tokyo, Japan',
    center: { lat: 35.6595, lng: 139.7004 },
    zoom: 14,
    initialSearchQuery: 'specialty coffee roasters and museums in Shibuya Tokyo',
  },
  {
    id: 'london',
    name: 'London, UK',
    center: { lat: 51.5079, lng: -0.0994 },
    zoom: 14,
    initialSearchQuery: 'galleries, markets and riverside cafes near Tate Modern London',
  },
  {
    id: 'chicago',
    name: 'Chicago, IL',
    center: { lat: 41.8826, lng: -87.6226 },
    zoom: 14,
    initialSearchQuery: 'architecture landmarks and dining near Millennium Park Chicago',
  },
];

export type WorkspaceTab = 'workspace' | 'places' | 'grounding' | 'saved';

export interface ChatSettings {
  roleId: ChatbotRoleId;
  model: GeminiModelId;
  groundingMode: GroundingMode;
}
