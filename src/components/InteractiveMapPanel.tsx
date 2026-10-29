import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
  MapCameraChangedEvent,
} from '@vis.gl/react-google-maps';
import {
  Search,
  Navigation,
  Star,
  ExternalLink,
  MessageSquarePlus,
  Bookmark,
  BookmarkCheck,
  MapPin,
  Layers,
  Route as RouteIcon,
  Footprints,
  Car,
  Bike,
  Bus,
  Check,
  ArrowUp,
  ArrowDown,
  X,
  Maximize2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  calculateHaversineDistanceKm,
  calculateMultiStopMetrics,
  formatCoordinate,
  LatLngLiteral,
  MAP_STYLE_OPTIONS,
  MapStyleId,
  resolveMapStyleConfig,
  ROUTE_COLOR_PRESETS,
  TravelMode,
} from '../utils/spatialParser';
import {
  CITY_VIEWPORT_PRESETS,
  CityViewportPreset,
  LivePlaceItem,
} from '../types/places';

interface InteractiveMapPanelProps {
  activePreset: CityViewportPreset;
  onSelectPreset: (preset: CityViewportPreset) => void;
  mapCenter: LatLngLiteral;
  mapZoom: number;
  onCameraChange: (center: LatLngLiteral, zoom: number) => void;
  externalSearchQuery: string;
  livePlaces: LivePlaceItem[];
  onUpdateLivePlaces: (places: LivePlaceItem[]) => void;
  selectedPlace: LivePlaceItem | null;
  onSelectPlace: (place: LivePlaceItem | null) => void;
  savedPlaces: LivePlaceItem[];
  onToggleSavePlace: (place: LivePlaceItem) => void;
  onAskAboutPlace: (place: LivePlaceItem) => void;
  onViewReviews?: (place: LivePlaceItem) => void;
  routePlaceIds?: string[];
  onRoutePlaceIdsChange?: (ids: string[]) => void;
}

const QUICK_PLACE_CATEGORIES = [
  { label: 'Coffee & Bakeries', query: 'specialty coffee and bakery' },
  { label: 'Local Dining', query: 'top rated local restaurants' },
  { label: 'Museums & Art', query: 'museums and art galleries' },
  { label: 'Parks & Plazas', query: 'scenic parks and public plazas' },
  { label: 'Transit & Stations', query: 'transit station and ferry terminal' },
];

interface PlaceMarkerItemProps {
  place: LivePlaceItem;
  index: number;
  isSelected: boolean;
  onSelect: (place: LivePlaceItem) => void;
  onCloseInfoWindow: () => void;
  onAskAboutPlace: (place: LivePlaceItem) => void;
  onViewReviews?: (place: LivePlaceItem) => void;
  routeStopIndex?: number;
  routeColor?: string;
}

const PlaceMarkerItem: React.FC<PlaceMarkerItemProps> = ({
  place,
  index,
  isSelected,
  onSelect,
  onCloseInfoWindow,
  onAskAboutPlace,
  onViewReviews,
  routeStopIndex,
  routeColor,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isRouteStop = routeStopIndex !== undefined;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={isRouteStop ? `Stop ${routeStopIndex + 1}: ${place.displayName}` : place.displayName}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={
            isRouteStop
              ? routeColor || '#2563eb'
              : isSelected
              ? '#1d4ed8'
              : '#0f172a'
          }
          borderColor={isSelected || isRouteStop ? '#ffffff' : '#475569'}
          glyphColor={'#ffffff'}
          scale={isSelected ? 1.25 : isRouteStop ? 1.2 : 1.05}
        >
          <span className="font-mono text-[10px] font-semibold">
            {isRouteStop ? `S${routeStopIndex + 1}` : index + 1}
          </span>
        </Pin>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={280}
          onCloseClick={onCloseInfoWindow}
        >
          <div className="p-1 text-slate-900 space-y-1.5">
            {isRouteStop && (
              <div
                className="inline-block px-1.5 py-0.5 text-[10px] font-semibold text-white rounded"
                style={{ backgroundColor: routeColor || '#2563eb' }}
              >
                Route Stop #{routeStopIndex + 1}
              </div>
            )}
            <div className="font-display font-semibold text-sm text-slate-950">
              {place.displayName}
            </div>
            <div className="text-xs text-slate-600">{place.formattedAddress}</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono tabular-nums">
              {place.rating !== undefined && (
                <>
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  <span>{place.rating.toFixed(1)}</span>
                  {place.userRatingCount !== undefined && (
                    <span className="text-slate-500">({place.userRatingCount})</span>
                  )}
                  <span aria-hidden="true">·</span>
                </>
              )}
              {place.distanceKm !== undefined && (
                <span>{place.distanceKm} km away</span>
              )}
            </div>
            <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAskAboutPlace(place)}
                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Ask Chatbot
              </button>
              {onViewReviews && (
                <button
                  type="button"
                  onClick={() => onViewReviews(place)}
                  className="px-2 py-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors inline-flex items-center gap-1"
                  title="View top-rated user reviews summary"
                >
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  <span>Reviews</span>
                </button>
              )}
              {place.googleMapsURI && (
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                >
                  <span>Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const InteractiveMapPanel: React.FC<InteractiveMapPanelProps> = ({
  activePreset,
  onSelectPreset,
  mapCenter,
  mapZoom,
  onCameraChange,
  externalSearchQuery,
  livePlaces,
  onUpdateLivePlaces,
  selectedPlace,
  onSelectPlace,
  savedPlaces,
  onToggleSavePlace,
  onAskAboutPlace,
  onViewReviews,
  routePlaceIds,
  onRoutePlaceIdsChange,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [mapStyle, setMapStyle] = useState<MapStyleId>('standard');
  const activeStyleConfig = resolveMapStyleConfig(mapStyle);

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesStatusMsg, setPlacesStatusMsg] = useState<string | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const lastExecutedQueryRef = useRef<string>('');

  // Route drawing state
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>(
    routePlaceIds && routePlaceIds.length > 0
      ? routePlaceIds
      : savedPlaces.slice(0, 3).map((p) => p.id)
  );
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [routeColorHex, setRouteColorHex] = useState<string>('#2563eb');
  const [isRouteDrawerOpen, setIsRouteDrawerOpen] = useState(false);
  const [isComputingRoute, setIsComputingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeMetrics, setRouteMetrics] = useState<{
    distanceText: string;
    durationText: string;
    stopsCount: number;
    travelMode: TravelMode;
    isActualDirections: boolean;
  } | null>(null);

  // Sync with incoming routePlaceIds prop from parent
  useEffect(() => {
    if (routePlaceIds && routePlaceIds.length > 0) {
      setSelectedRouteIds(routePlaceIds);
      setIsRouteDrawerOpen(true);
    }
  }, [routePlaceIds]);

  // Keep imperative Google Map instance synchronized with selected MapStyleConfig
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(activeStyleConfig.mapTypeId);
  }, [map, activeStyleConfig]);

  // Cleanup polylines on unmount
  useEffect(() => {
    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, []);

  // Clear current active route polyline
  const clearCurrentRoute = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setRouteMetrics(null);
    setRouteError(null);
  }, []);

  // Compute and draw route connecting selected saved places
  const calculateAndDrawRoute = useCallback(
    async (
      placeIds: string[],
      currentSavedPlaces: LivePlaceItem[],
      mode: TravelMode,
      color: string
    ) => {
      const placesToConnect = placeIds
        .map((id) => currentSavedPlaces.find((p) => p.id === id))
        .filter((p): p is LivePlaceItem => Boolean(p && p.location));

      if (!map || placesToConnect.length < 2) {
        clearCurrentRoute();
        return;
      }

      setIsComputingRoute(true);
      setRouteError(null);
      clearCurrentRoute();

      const origin = placesToConnect[0].location;
      const destination = placesToConnect[placesToConnect.length - 1].location;
      const intermediates = placesToConnect
        .slice(1, -1)
        .map((p) => ({ location: p.location }));

      let directionsSuccess = false;

      // 1. Primary: Use Google Maps Routes API (Route.computeRoutes) per Zero-Legacy SDK standard
      if (
        routesLib?.Route &&
        typeof (routesLib.Route as any).computeRoutes === 'function'
      ) {
        try {
          const req: any = {
            origin,
            destination,
            travelMode: mode,
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
          };
          if (intermediates.length > 0) {
            req.intermediates = intermediates;
          }

          const response = await (routesLib.Route as any).computeRoutes(req);
          if (response?.routes && response.routes.length > 0) {
            const primaryRoute = response.routes[0];
            let newPolylines: google.maps.Polyline[] = [];

            if (typeof primaryRoute.createPolylines === 'function') {
              newPolylines = primaryRoute.createPolylines();
            } else if (primaryRoute.path) {
              const poly = new google.maps.Polyline({
                path: primaryRoute.path,
                strokeColor: color,
                strokeWeight: 6,
                strokeOpacity: 0.85,
              });
              newPolylines = [poly];
            }

            newPolylines.forEach((poly) => {
              poly.setOptions({
                strokeColor: color,
                strokeWeight: 6,
                strokeOpacity: 0.85,
              });
              poly.setMap(map);
            });
            polylinesRef.current = newPolylines;

            if (primaryRoute.viewport) {
              map.fitBounds(primaryRoute.viewport);
            } else {
              const bounds = new google.maps.LatLngBounds();
              placesToConnect.forEach((p) => bounds.extend(p.location));
              map.fitBounds(bounds, 60);
            }

            const distKm = (primaryRoute.distanceMeters || 0) / 1000;
            const durMins = Math.round((primaryRoute.durationMillis || 0) / 60000);

            setRouteMetrics({
              distanceText:
                distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(2)} km`,
              durationText:
                durMins >= 60
                  ? `${Math.floor(durMins / 60)} hr ${durMins % 60} min`
                  : `${durMins} min`,
              stopsCount: placesToConnect.length,
              travelMode: mode,
              isActualDirections: true,
            });

            directionsSuccess = true;
          }
        } catch (err: any) {
          console.warn('Routes API computeRoutes notice:', err);
          const msg = String(err?.message || err || '');
          if (
            msg.includes('OVER_QUERY_LIMIT') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('429')
          ) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
      }

      // 2. High-fidelity Polyline Fallback with calculated multi-stop metrics
      if (!directionsSuccess) {
        try {
          const coords = placesToConnect.map((p) => p.location);
          const fallbackPolyline = new google.maps.Polyline({
            path: coords,
            geodesic: true,
            strokeColor: color,
            strokeWeight: 6,
            strokeOpacity: 0.85,
            map: map,
          });

          polylinesRef.current = [fallbackPolyline];

          const bounds = new google.maps.LatLngBounds();
          coords.forEach((c) => bounds.extend(c));
          map.fitBounds(bounds, 60);

          const metrics = calculateMultiStopMetrics(coords, mode);
          setRouteMetrics({
            distanceText: metrics.formattedDistance,
            durationText: metrics.formattedDuration,
            stopsCount: placesToConnect.length,
            travelMode: mode,
            isActualDirections: false,
          });
        } catch (fallbackErr: any) {
          setRouteError('Unable to render route polyline on map.');
        }
      }

      setIsComputingRoute(false);
    },
    [map, routesLib, clearCurrentRoute]
  );

  // Trigger route computation whenever selection or travel mode or color changes
  useEffect(() => {
    if (selectedRouteIds.length >= 2) {
      void calculateAndDrawRoute(
        selectedRouteIds,
        savedPlaces,
        travelMode,
        routeColorHex
      );
    } else {
      clearCurrentRoute();
    }
  }, [
    selectedRouteIds,
    savedPlaces,
    travelMode,
    routeColorHex,
    calculateAndDrawRoute,
    clearCurrentRoute,
  ]);

  // Execute live Google Maps Places API (New) `Place.searchByText`
  const executeTextSearch = useCallback(
    async (queryText: string, targetCenter: LatLngLiteral) => {
      if (!placesLib || !queryText.trim()) return;

      setIsSearchingPlaces(true);
      setPlacesStatusMsg(null);

      try {
        const { Place } = placesLib;
        const request: google.maps.places.SearchByTextRequest = {
          textQuery: queryText,
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'googleMapsURI',
            'websiteURI',
            'primaryTypeDisplayName',
          ],
          locationBias: {
            center: targetCenter,
            radius: 3500,
          },
          maxResultCount: 8,
        };

        const { places } = await Place.searchByText(request);
        if (!places || places.length === 0) {
          onUpdateLivePlaces([]);
          setPlacesStatusMsg(`No live places returned for "${queryText}".`);
          setIsSearchingPlaces(false);
          return;
        }

        const mapped: LivePlaceItem[] = [];
        for (const p of places) {
          if (!p.location) continue;
          const lat =
            typeof p.location.lat === 'function'
              ? p.location.lat()
              : Number((p.location as any).lat);
          const lng =
            typeof p.location.lng === 'function'
              ? p.location.lng()
              : Number((p.location as any).lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

          mapped.push({
            id: p.id || `${lat}-${lng}`,
            displayName: p.displayName || 'Unnamed Place',
            formattedAddress: p.formattedAddress || '',
            location: { lat, lng },
            rating: p.rating ?? undefined,
            userRatingCount: p.userRatingCount ?? undefined,
            primaryTypeDisplayName:
              (p as any).primaryTypeDisplayName ?? undefined,
            googleMapsURI: p.googleMapsURI ?? undefined,
            websiteURI: p.websiteURI ?? undefined,
            distanceKm: calculateHaversineDistanceKm(targetCenter, { lat, lng }),
          });
        }

        onUpdateLivePlaces(mapped);
        if (mapped.length > 0 && map && selectedRouteIds.length < 2) {
          map.panTo(mapped[0].location);
        }
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('QuotaExceededError') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setPlacesStatusMsg('Live Places search temporarily unavailable.');
      } finally {
        setIsSearchingPlaces(false);
      }
    },
    [placesLib, map, onUpdateLivePlaces, selectedRouteIds.length]
  );

  // Trigger initial or external search query when placesLib is ready
  useEffect(() => {
    if (!placesLib) return;
    const queryToRun = externalSearchQuery || activePreset.initialSearchQuery;
    if (queryToRun && queryToRun !== lastExecutedQueryRef.current) {
      lastExecutedQueryRef.current = queryToRun;
      void executeTextSearch(queryToRun, mapCenter);
    }
  }, [placesLib, externalSearchQuery, activePreset, mapCenter, executeTextSearch]);

  // Autocomplete suggestions via AutocompleteSuggestion.fetchAutocompleteSuggestions
  useEffect(() => {
    if (!placesLib || searchInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: searchInput.trim(),
          sessionToken: sessionTokenRef.current,
          locationBias: {
            center: mapCenter,
            radius: 5000,
          },
        });
        setSuggestions(res.suggestions || []);
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [placesLib, searchInput, mapCenter]);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'googleMapsURI',
          'websiteURI',
        ],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchInput('');

      if (place.location) {
        const lat =
          typeof place.location.lat === 'function'
            ? place.location.lat()
            : Number((place.location as any).lat);
        const lng =
          typeof place.location.lng === 'function'
            ? place.location.lng()
            : Number((place.location as any).lng);
        const item: LivePlaceItem = {
          id: place.id || `${lat}-${lng}`,
          displayName: place.displayName || 'Selected Place',
          formattedAddress: place.formattedAddress || '',
          location: { lat, lng },
          rating: place.rating ?? undefined,
          userRatingCount: place.userRatingCount ?? undefined,
          googleMapsURI: place.googleMapsURI ?? undefined,
          websiteURI: place.websiteURI ?? undefined,
          distanceKm: calculateHaversineDistanceKm(mapCenter, { lat, lng }),
        };
        onUpdateLivePlaces([
          item,
          ...livePlaces.filter((p) => p.id !== item.id),
        ]);
        onSelectPlace(item);
        onCameraChange({ lat, lng }, 16);
        map?.panTo({ lat, lng });
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (
        msg.includes('OVER_QUERY_LIMIT') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('429')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSuggestions([]);
    lastExecutedQueryRef.current = searchInput.trim();
    void executeTextSearch(searchInput.trim(), mapCenter);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onCameraChange(nextCenter, 15);
        map?.panTo(nextCenter);
        void executeTextSearch('restaurants and coffee nearby', nextCenter);
      },
      () => {
        setPlacesStatusMsg('Browser geolocation permission was not granted.');
      }
    );
  };

  // Route stop toggle handlers
  const handleToggleRoutePlace = (placeId: string) => {
    setSelectedRouteIds((prev) => {
      let next: string[];
      if (prev.includes(placeId)) {
        next = prev.filter((id) => id !== placeId);
      } else {
        next = [...prev, placeId];
      }
      onRoutePlaceIdsChange?.(next);
      return next;
    });
  };

  const handleSelectAllSavedPlaces = () => {
    const allIds = savedPlaces.map((p) => p.id);
    setSelectedRouteIds(allIds);
    onRoutePlaceIdsChange?.(allIds);
  };

  const handleClearRouteSelection = () => {
    setSelectedRouteIds([]);
    onRoutePlaceIdsChange?.([]);
    clearCurrentRoute();
  };

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedRouteIds.length) return;

    setSelectedRouteIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      onRoutePlaceIdsChange?.(next);
      return next;
    });
  };

  // Prepare places for rendering
  const routeStops = selectedRouteIds
    .map((id) => savedPlaces.find((p) => p.id === id))
    .filter((p): p is LivePlaceItem => Boolean(p && p.location));

  // Merge live places and saved route places so all route stops are guaranteed pins
  const routePlaceIndexMap: Record<string, number> = {};
  routeStops.forEach((p, idx) => {
    routePlaceIndexMap[p.id] = idx;
  });

  const allRenderedPlaces = [...livePlaces];
  for (const stop of routeStops) {
    if (!allRenderedPlaces.some((p) => p.id === stop.id)) {
      allRenderedPlaces.push(stop);
    }
  }

  const travelModesConfig: { id: TravelMode; label: string; icon: React.ReactNode }[] = [
    { id: 'WALKING', label: 'Walk', icon: <Footprints className="w-3.5 h-3.5" /> },
    { id: 'DRIVING', label: 'Drive', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'BICYCLING', label: 'Bike', icon: <Bike className="w-3.5 h-3.5" /> },
    { id: 'TRANSIT', label: 'Transit', icon: <Bus className="w-3.5 h-3.5" /> },
  ];

  return (
    <section
      aria-label="Interactive Google Map, Places Explorer and Route Planner"
      className="flex flex-col h-full bg-slate-100 overflow-hidden relative"
    >
      {/* Map Toolbar: City Presets + Search + Style & Route Planner */}
      <div className="p-3 bg-white border-b border-slate-200 space-y-2.5 shrink-0">
        {/* City Preset Switcher & Geolocation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="City viewport presets"
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto"
          >
            {CITY_VIEWPORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelectPreset(preset);
                  map?.panTo(preset.center);
                  map?.setZoom(preset.zoom);
                  lastExecutedQueryRef.current = preset.initialSearchQuery;
                  void executeTextSearch(preset.initialSearchQuery, preset.center);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activePreset.id === preset.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.name.split(',')[0]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUseMyLocation}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span>My Location</span>
          </button>
        </div>

        {/* Live Google Places Autocomplete & Text Search Bar */}
        <div className="relative">
          <form onSubmit={handleSearchFormSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="places-live-search" className="sr-only">
                Search live Google Maps places
              </label>
              <input
                id="places-live-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={`Search live places in ${activePreset.name}...`}
                className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingPlaces}
              className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {isSearchingPlaces ? 'Searching...' : 'Search Map'}
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Place autocomplete suggestions"
              className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 divide-y divide-slate-100 max-h-56 overflow-y-auto"
            >
              {suggestions.map((s, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {s.placePrediction?.text?.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filter Categories + Map Style Controls + Route Planner Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {QUICK_PLACE_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  const q = `${cat.query} in ${activePreset.name}`;
                  lastExecutedQueryRef.current = q;
                  void executeTextSearch(q, mapCenter);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Route Planner Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsRouteDrawerOpen((prev) => !prev)}
              aria-expanded={isRouteDrawerOpen}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isRouteDrawerOpen || selectedRouteIds.length >= 2
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              <span>Route Planner</span>
              {selectedRouteIds.length >= 2 && (
                <span className="px-1.5 py-0.2 bg-white/20 text-white rounded text-[10px] font-mono">
                  {selectedRouteIds.length}
                </span>
              )}
            </button>

            {/* Map Style Control Menu */}
            <div
              role="group"
              aria-label="Map style control menu"
              className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0"
            >
              <span className="inline-flex items-center gap-1 px-1.5 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Style</span>
              </span>
              {MAP_STYLE_OPTIONS.map((styleOpt) => {
                const isActive = mapStyle === styleOpt.id;
                return (
                  <button
                    key={styleOpt.id}
                    type="button"
                    onClick={() => setMapStyle(styleOpt.id)}
                    aria-pressed={isActive}
                    title={styleOpt.description}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {styleOpt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Google Map Canvas (CF2: explicit height container) */}
      <div className="relative flex-1 min-h-[280px] w-full" data-testid="google-map-canvas">
        <Map
          defaultCenter={activePreset.center}
          defaultZoom={activePreset.zoom}
          mapId="DEMO_MAP_ID"
          mapTypeId={activeStyleConfig.mapTypeId}
          mapTypeControl={false}
          clickableIcons={mapStyle === 'standard'}
          gestureHandling="greedy"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onCameraChanged={(ev: MapCameraChangedEvent) => {
            onCameraChange(ev.detail.center, ev.detail.zoom);
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {allRenderedPlaces.map((place, index) => {
            const stopIdx = routePlaceIndexMap[place.id];
            return (
              <PlaceMarkerItem
                key={place.id}
                place={place}
                index={index}
                isSelected={selectedPlace?.id === place.id}
                onSelect={(p) => onSelectPlace(p)}
                onCloseInfoWindow={() => onSelectPlace(null)}
                onAskAboutPlace={onAskAboutPlace}
                onViewReviews={onViewReviews}
                routeStopIndex={stopIdx}
                routeColor={routeColorHex}
              />
            );
          })}
        </Map>

        {/* Floating Route Metrics HUD (Visible when 2+ stops are connected) */}
        {routeMetrics && (
          <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-lg p-3 max-w-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block shrink-0 shadow-xs"
                  style={{ backgroundColor: routeColorHex }}
                />
                <span className="font-display font-semibold text-xs text-slate-900">
                  Connected Route
                </span>
              </div>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                {routeMetrics.travelMode}
              </span>
            </div>

            <div className="flex items-baseline gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Distance</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {routeMetrics.distanceText}
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-200">|</span>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Est. Time</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {routeMetrics.durationText}
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-200">|</span>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Stops</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {routeMetrics.stopsCount}
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-1 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (map && routeStops.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    routeStops.forEach((s) => bounds.extend(s.location));
                    map.fitBounds(bounds, 60);
                  }
                }}
                className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fit Route</span>
              </button>
              <button
                type="button"
                onClick={clearCurrentRoute}
                className="px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Polyline</span>
              </button>
            </div>
          </div>
        )}

        {/* Route Planner Overlay Drawer */}
        {isRouteDrawerOpen && (
          <div
            role="region"
            aria-label="Route Planner configuration panel"
            className="absolute top-3 right-3 z-20 w-80 max-h-[85%] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-display font-semibold text-xs text-slate-900">
                  Connect Saved Places
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRouteDrawerOpen(false)}
                aria-label="Close route planner"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Travel Mode & Polyline Color Selector */}
            <div className="p-3 border-b border-slate-100 space-y-3 bg-white shrink-0 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">
                  Travel Mode (Google Directions)
                </label>
                <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg">
                  {travelModesConfig.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTravelMode(m.id)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                        travelMode === m.id
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">
                  Polyline Color
                </label>
                <div className="flex items-center gap-2">
                  {ROUTE_COLOR_PRESETS.map((col) => {
                    const isSelected = routeColorHex === col.hex;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setRouteColorHex(col.hex)}
                        title={col.label}
                        aria-label={col.label}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                          isSelected ? 'scale-110 ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: col.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Saved Places Stop Selection & Reordering List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 pb-1">
                <span>Select 2+ Saved Places ({selectedRouteIds.length} chosen)</span>
                {savedPlaces.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSavedPlaces}
                      className="text-blue-600 hover:underline"
                    >
                      All
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleClearRouteSelection}
                      className="text-slate-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {savedPlaces.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1.5">
                  <p className="text-xs text-slate-600">
                    No Saved Places found in your itinerary.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Bookmark places from the map or chat using the bookmark icon to connect them on a route.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {savedPlaces.map((place) => {
                    const isChecked = selectedRouteIds.includes(place.id);
                    const stopIndex = selectedRouteIds.indexOf(place.id);

                    return (
                      <div
                        key={place.id}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${
                          isChecked
                            ? 'bg-blue-50/50 border-blue-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleRoutePlace(place.id)}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              {isChecked && (
                                <span
                                  className="w-4 h-4 rounded-full text-white text-[10px] font-mono flex items-center justify-center shrink-0 font-bold"
                                  style={{ backgroundColor: routeColorHex }}
                                >
                                  {stopIndex + 1}
                                </span>
                              )}
                              <span className="font-medium text-slate-900 truncate">
                                {place.displayName}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {place.formattedAddress}
                            </span>
                          </div>
                        </label>

                        {/* Order adjustment buttons */}
                        {isChecked && selectedRouteIds.length > 1 && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveStop(stopIndex, 'up')}
                              disabled={stopIndex === 0}
                              aria-label={`Move ${place.displayName} up`}
                              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded hover:bg-slate-100"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStop(stopIndex, 'down')}
                              disabled={stopIndex === selectedRouteIds.length - 1}
                              aria-label={`Move ${place.displayName} down`}
                              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded hover:bg-slate-100"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2">
              {routeError && (
                <div className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{routeError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  void calculateAndDrawRoute(
                    selectedRouteIds,
                    savedPlaces,
                    travelMode,
                    routeColorHex
                  );
                }}
                disabled={isComputingRoute || selectedRouteIds.length < 2}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <RouteIcon className="w-3.5 h-3.5" />
                <span>
                  {isComputingRoute
                    ? 'Calculating Directions...'
                    : selectedRouteIds.length < 2
                    ? 'Select at least 2 places'
                    : `Draw Route (${selectedRouteIds.length} Stops)`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Live Places Strip / Inspector */}
      <div className="h-52 bg-white border-t border-slate-200 flex flex-col shrink-0">
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-slate-900">
              Live Google Maps Places
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              {livePlaces.length} results
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              {formatCoordinate(mapCenter.lat, mapCenter.lng)} (z{Math.round(mapZoom)})
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-600 font-medium">
              Style: {activeStyleConfig.label}
            </span>
          </div>
          {placesStatusMsg && (
            <span className="text-slate-500 text-[11px]">{placesStatusMsg}</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {livePlaces.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6 text-xs text-slate-500">
              <p>
                {isSearchingPlaces
                  ? 'Loading live places from Google Maps Platform...'
                  : 'Ask a location question in the chat or click a category above to load live Google Maps places.'}
              </p>
            </div>
          ) : (
            livePlaces.map((place, idx) => {
              const isSelected = selectedPlace?.id === place.id;
              const isSaved = savedPlaces.some((s) => s.id === place.id);
              const stopIndex = routePlaceIndexMap[place.id];

              return (
                <div
                  key={place.id}
                  className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlace(place);
                      map?.panTo(place.location);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                        0{idx + 1}.
                      </span>
                      <span className="font-display font-semibold text-xs text-slate-900 truncate">
                        {place.displayName}
                      </span>
                      {stopIndex !== undefined && (
                        <span
                          className="px-1.5 py-0.2 text-[10px] font-mono font-bold text-white rounded shrink-0"
                          style={{ backgroundColor: routeColorHex }}
                        >
                          Stop #{stopIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                      {place.rating !== undefined && (
                        <>
                          <span className="font-mono text-slate-700 font-medium tabular-nums">
                            ★ {place.rating.toFixed(1)}
                          </span>
                          {place.userRatingCount !== undefined && (
                            <span className="font-mono tabular-nums">
                              ({place.userRatingCount})
                            </span>
                          )}
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      {place.distanceKm !== undefined && (
                        <>
                          <span className="font-mono tabular-nums">
                            {place.distanceKm} km
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="truncate">{place.formattedAddress}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onViewReviews && (
                      <button
                        type="button"
                        onClick={() => onViewReviews(place)}
                        aria-label={`View reviews summary for ${place.displayName}`}
                        className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
                        title="View top-rated user reviews summary via Google Places Details API"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        <span>Reviews</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onAskAboutPlace(place)}
                      aria-label={`Ask chatbot about ${place.displayName}`}
                      className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Ask AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleSavePlace(place)}
                      aria-label={
                        isSaved
                          ? `Remove ${place.displayName} from saved places`
                          : `Save ${place.displayName}`
                      }
                      className={`p-1.5 rounded border transition-colors ${
                        isSaved
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {place.googleMapsURI && (
                      <a
                        href={place.googleMapsURI}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${place.displayName} on Google Maps`}
                        className="p-1.5 text-slate-600 hover:text-blue-700 border border-slate-200 rounded bg-white transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
