import { useState, useEffect, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Globe, Trash2, MessageSquare } from 'lucide-react';
import {
  CHATBOT_ROLES,
  ChatbotRoleId,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
  formatCoordinate,
} from './utils/spatialParser';
import {
  CITY_VIEWPORT_PRESETS,
  CityViewportPreset,
  ChatMessage,
  LivePlaceItem,
  WorkspaceTab,
} from './types/places';
import { ChatThreadPanel } from './components/ChatThreadPanel';
import { InteractiveMapPanel } from './components/InteractiveMapPanel';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function createInitialGreeting(cityName: string): ChatMessage {
  return {
    id: 'welcome-msg',
    role: 'model',
    text: `Welcome to **AtlasPulse**. I am grounded in real-time **Google Maps** and **Google Search** data around **${cityName}**.\n\nAsk me about neighborhood restaurants, coffee roasters, museums, transit connections, or live local events—and I will cite verified Google Maps & Search sources while plotting matching places directly on the interactive map.`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    usedModel: 'gemini-3.8-flash',
    roleId: 'concierge',
  };
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workspace');

  const [activePreset, setActivePreset] = useState<CityViewportPreset>(
    CITY_VIEWPORT_PRESETS[0]
  );
  const [mapCenter, setMapCenter] = useState<LatLngLiteral>(
    CITY_VIEWPORT_PRESETS[0].center
  );
  const [mapZoom, setMapZoom] = useState<number>(CITY_VIEWPORT_PRESETS[0].zoom);

  const [roleId, setRoleId] = useState<ChatbotRoleId>('concierge');
  const [model, setModel] = useState<GeminiModelId>('gemini-3.8-flash');
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('auto');

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createInitialGreeting(CITY_VIEWPORT_PRESETS[0].name),
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [externalSearchQuery, setExternalSearchQuery] = useState<string>(
    CITY_VIEWPORT_PRESETS[0].initialSearchQuery
  );
  const [livePlaces, setLivePlaces] = useState<LivePlaceItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<LivePlaceItem | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<LivePlaceItem[]>(() => {
    try {
      const raw = localStorage.getItem('atlaspulse_saved_places');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Listen to global Google Maps Platform quota events
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('atlaspulse_saved_places', JSON.stringify(savedPlaces));
    } catch {
      // Ignore storage errors in private browsing
    }
  }, [savedPlaces]);

  const handleToggleSavePlace = useCallback((place: LivePlaceItem) => {
    setSavedPlaces((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      if (exists) {
        return prev.filter((p) => p.id !== place.id);
      }
      return [place, ...prev];
    });
  }, []);

  const handleSendMessage = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || isChatLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsChatLoading(true);
      setChatError(null);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              text: m.text,
            })),
            model,
            roleId,
            groundingMode,
            activeCityName: activePreset.name,
            center: mapCenter,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate grounded response.');
        }

        const assistantMsg: ChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          sources: data.sources || [],
          suggestedPlaceQuery: data.suggestedPlaceQuery,
          usedModel: data.usedModel || model,
          modelNote: data.modelNote,
          strategyUsed: data.strategyUsed,
          roleId,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (data.suggestedPlaceQuery) {
          setExternalSearchQuery(data.suggestedPlaceQuery);
        }
      } catch (err: any) {
        setChatError(
          err instanceof Error
            ? err.message
            : 'Unable to reach Gemini spatial service.'
        );
      } finally {
        setIsChatLoading(false);
      }
    },
    [
      messages,
      isChatLoading,
      model,
      roleId,
      groundingMode,
      activePreset.name,
      mapCenter,
    ]
  );

  const handleNewSession = () => {
    setMessages([createInitialGreeting(activePreset.name)]);
    setChatError(null);
    setActiveTab('workspace');
  };

  // Aggregate all grounding sources across the conversation thread
  const allGroundedSources: GroundedSource[] = [];
  const seenUris = new Set<string>();
  for (const m of messages) {
    for (const s of m.sources || []) {
      if (!seenUris.has(s.uri)) {
        seenUris.add(s.uri);
        allGroundedSources.push(s);
      }
    }
  }

  const activeRoleObj =
    CHATBOT_ROLES.find((r) => r.id === roleId) || CHATBOT_ROLES[0];

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Required Google Maps Platform Demo Quota Banner (Tier 1 & Tier 2) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
        >
          AtlasPulse
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('workspace');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'workspace'
                ? 'text-slate-950 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Workspace
          </a>
          <a
            href="#places"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('places');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'places'
                ? 'text-slate-950 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Live Places ({livePlaces.length})
          </a>
          <a
            href="#grounding"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('grounding');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'grounding'
                ? 'text-slate-950 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Grounded Links ({allGroundedSources.length})
          </a>
          <a
            href="#saved"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('saved');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeTab === 'saved'
                ? 'text-slate-950 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Saved ({savedPlaces.length})
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleNewSession}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            New Session
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 relative">
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          language="en"
          region="US"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {/* Split Chat + Interactive Google Map Workspace */}
          <div
            className={`h-full grid grid-cols-1 lg:grid-cols-12 ${
              activeTab === 'workspace' ? 'block' : 'hidden'
            }`}
          >
            <div className="lg:col-span-5 h-full min-h-0">
              <ChatThreadPanel
                messages={messages}
                isLoading={isChatLoading}
                error={chatError}
                roleId={roleId}
                onRoleChange={setRoleId}
                model={model}
                onModelChange={setModel}
                groundingMode={groundingMode}
                onGroundingModeChange={setGroundingMode}
                activeCityName={activePreset.name}
                center={mapCenter}
                onSendMessage={handleSendMessage}
                onPlotQueryOnMap={(q) => setExternalSearchQuery(q)}
                onClearHistory={handleNewSession}
              />
            </div>

            <div className="lg:col-span-7 h-full min-h-0">
              <InteractiveMapPanel
                activePreset={activePreset}
                onSelectPreset={(preset) => {
                  setActivePreset(preset);
                  setMapCenter(preset.center);
                  setMapZoom(preset.zoom);
                }}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                onCameraChange={(c, z) => {
                  setMapCenter(c);
                  setMapZoom(z);
                }}
                externalSearchQuery={externalSearchQuery}
                livePlaces={livePlaces}
                onUpdateLivePlaces={setLivePlaces}
                selectedPlace={selectedPlace}
                onSelectPlace={setSelectedPlace}
                savedPlaces={savedPlaces}
                onToggleSavePlace={handleToggleSavePlace}
                onAskAboutPlace={(place) => {
                  setActiveTab('workspace');
                  void handleSendMessage(
                    `Tell me more about ${place.displayName} at ${place.formattedAddress}, including what it is known for and any visitor tips.`
                  );
                }}
              />
            </div>
          </div>

          {/* Secondary View: Live Places Data Table */}
          {activeTab === 'places' && (
            <div className="h-full overflow-y-auto p-6 max-w-6xl mx-auto space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950">
                    Live Google Maps Places Directory
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Real-time places retrieved via Google Maps Platform Places API (New) around {activePreset.name} ({formatCoordinate(mapCenter.lat, mapCenter.lng)}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('workspace')}
                  className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Return to Map & Chat
                </button>
              </div>

              {livePlaces.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    No places are currently loaded in the active viewport.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('workspace')}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
                  >
                    Search Places on Map
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Place Name</th>
                        <th className="py-3 px-4">Address</th>
                        <th className="py-3 px-4 text-right">Rating</th>
                        <th className="py-3 px-4 text-right">Distance</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {livePlaces.map((place, i) => (
                        <tr key={place.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                            0{i + 1}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {place.displayName}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {place.formattedAddress}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                            {place.rating !== undefined
                              ? `${place.rating.toFixed(1)} (${place.userRatingCount || 0})`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                            {place.distanceKm !== undefined
                              ? `${place.distanceKm} km`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPlace(place);
                                  setActiveTab('workspace');
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-100"
                              >
                                Focus Pin
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('workspace');
                                  void handleSendMessage(
                                    `What should I know before visiting ${place.displayName} at ${place.formattedAddress}?`
                                  );
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                              >
                                Ask Chat
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Secondary View: Grounded Sources Ledger */}
          {activeTab === 'grounding' && (
            <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950">
                    Google Maps & Google Search Grounding Citations
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Verified grounding links and review snippets extracted from Gemini responses during this session.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  <span>Active Role: {activeRoleObj.label}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono">{model}</span>
                </div>
              </div>

              {allGroundedSources.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    No grounding citations recorded yet. Ask a location question in the chat to populate live Google Maps and Google Search links.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('workspace');
                      void handleSendMessage(activeRoleObj.defaultQuery);
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Run Sample Grounded Query
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {allGroundedSources.map((src) => (
                    <div
                      key={src.id}
                      className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {src.kind === 'maps' ? (
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>
                            {src.kind === 'maps'
                              ? 'Google Maps Grounding'
                              : 'Google Search Grounding'}
                          </span>
                        </div>
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-display font-semibold text-sm text-slate-900 hover:text-blue-700 hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>{src.title}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {src.reviewSnippets && src.reviewSnippets.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {src.reviewSnippets.map((snip, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-slate-600 italic"
                              >
                                “{snip}”
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <a
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        Open Link
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secondary View: Saved Places */}
          {activeTab === 'saved' && (
            <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950">
                    Saved Places Itinerary
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Bookmarked Google Maps locations for quick comparison and multi-turn itinerary planning.
                  </p>
                </div>
                {savedPlaces.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const names = savedPlaces
                        .map((p) => p.displayName)
                        .join(', ');
                      setActiveTab('workspace');
                      void handleSendMessage(
                        `Create a logical walking or transit order to visit my saved places: ${names}.`
                      );
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask Chatbot to Plan Route</span>
                  </button>
                )}
              </div>

              {savedPlaces.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    You have not bookmarked any places yet. Click the bookmark icon next to any live place in the map drawer to save it here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('workspace')}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
                  >
                    Explore Map
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {savedPlaces.map((place) => (
                    <div
                      key={place.id}
                      className="p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <h3 className="font-display font-semibold text-sm text-slate-900">
                          {place.displayName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span>{place.formattedAddress}</span>
                          {place.rating !== undefined && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-slate-700">
                                ★ {place.rating.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {place.googleMapsURI && (
                          <a
                            href={place.googleMapsURI}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100"
                          >
                            Google Maps
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleSavePlace(place)}
                          aria-label={`Remove ${place.displayName}`}
                          className="p-1.5 text-slate-500 hover:text-red-600 border border-slate-200 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </APIProvider>
      </main>
    </div>
  );
}
