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
} from 'lucide-react';
import {
  calculateHaversineDistanceKm,
  formatCoordinate,
  LatLngLiteral,
  MAP_STYLE_OPTIONS,
  MapStyleId,
  resolveMapStyleConfig,
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
}

const PlaceMarkerItem: React.FC<PlaceMarkerItemProps> = ({
  place,
  index,
  isSelected,
  onSelect,
  onCloseInfoWindow,
  onAskAboutPlace,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        title={place.displayName}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={isSelected ? '#1d4ed8' : '#0f172a'}
          borderColor={isSelected ? '#93c5fd' : '#475569'}
          glyphColor={'#ffffff'}
          scale={isSelected ? 1.25 : 1.05}
        >
          <span className="font-mono text-[10px] font-semibold">
            {index + 1}
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
            <div className="pt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAskAboutPlace(place)}
                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Ask Chatbot
              </button>
              {place.googleMapsURI && (
                <a
                  href={place.googleMapsURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                >
                  <span>Google Maps</span>
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
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

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

  // Keep imperative Google Map instance synchronized with selected MapStyleConfig
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(activeStyleConfig.mapTypeId);
  }, [map, activeStyleConfig]);

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
        if (mapped.length > 0 && map) {
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
    [placesLib, map, onUpdateLivePlaces]
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

  return (
    <section
      aria-label="Interactive Google Map and Live Places Explorer"
      className="flex flex-col h-full bg-slate-100 overflow-hidden"
    >
      {/* Map Toolbar: City Presets + Live Places Search + Category Filters */}
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

          {/* Category Filter Buttons & Map Style Control Menu */}
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

            {/* Map Style Control Menu: Standard, Roadmap, Satellite, Hybrid */}
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
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
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
          {livePlaces.map((place, index) => (
            <PlaceMarkerItem
              key={place.id}
              place={place}
              index={index}
              isSelected={selectedPlace?.id === place.id}
              onSelect={(p) => onSelectPlace(p)}
              onCloseInfoWindow={() => onSelectPlace(null)}
              onAskAboutPlace={onAskAboutPlace}
            />
          ))}
        </Map>
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
