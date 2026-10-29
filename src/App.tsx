import { useState, useEffect, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  ExternalLink,
  MapPin,
  Globe,
  Trash2,
  MessageSquare,
  LogOut,
  Cloud,
  CheckCircle2,
  Route,
  Star,
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import {
  savePlaceToFirestore,
  removePlaceFromFirestore,
  subscribeToSavedPlaces,
} from './lib/firebase';
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
import { AtlasPulseLogo } from './components/AtlasPulseLogo';
import { PlaceReviewsSummary } from './components/live-places';

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

  const {
    user,
    loading: isAuthLoading,
    authError,
    signInWithGoogle,
    signOut,
    clearAuthError,
  } = useAuth();

  const [externalSearchQuery, setExternalSearchQuery] = useState<string>(
    CITY_VIEWPORT_PRESETS[0].initialSearchQuery
  );
  const [livePlaces, setLivePlaces] = useState<LivePlaceItem[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<LivePlaceItem | null>(null);
  const [reviewModalPlace, setReviewModalPlace] = useState<LivePlaceItem | null>(null);
  const [routePlaceIds, setRoutePlaceIds] = useState<string[]>([]);
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

  // Sync saved places with Firebase Firestore when user is authenticated
  useEffect(() => {
    if (!user) {
      // User is logged out: restore from localStorage
      try {
        const raw = localStorage.getItem('atlaspulse_saved_places');
        if (raw) setSavedPlaces(JSON.parse(raw));
      } catch {
        // Ignore storage errors
      }
      return;
    }

    // User is logged in: read from Firestore subcollection
    const localPlaces = (() => {
      try {
        const raw = localStorage.getItem('atlaspulse_saved_places');
        return raw ? (JSON.parse(raw) as LivePlaceItem[]) : [];
      } catch {
        return [];
      }
    })();

    const unsubscribe = subscribeToSavedPlaces(
      user.uid,
      (firestorePlaces) => {
        // If Firestore subcollection is initially empty and user had places in localStorage, migrate them to Firestore
        if (firestorePlaces.length === 0 && localPlaces.length > 0) {
          for (const p of localPlaces) {
            void savePlaceToFirestore(user.uid, p);
          }
        } else {
          setSavedPlaces(firestorePlaces);
        }
      },
      (err) => {
        console.warn('Firestore subscription notice:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Persist to localStorage when not authenticated
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem('atlaspulse_saved_places', JSON.stringify(savedPlaces));
      } catch {
        // Ignore storage errors in private browsing
      }
    }
  }, [savedPlaces, user]);

  const handleToggleSavePlace = useCallback(
    (place: LivePlaceItem) => {
      const exists = savedPlaces.some((p) => p.id === place.id);
      if (user) {
        if (exists) {
          void removePlaceFromFirestore(user.uid, place.id);
        } else {
          void savePlaceToFirestore(user.uid, place);
        }
      } else {
        setSavedPlaces((prev) => {
          if (exists) {
            return prev.filter((p) => p.id !== place.id);
          }
          return [place, ...prev];
        });
      }
    },
    [savedPlaces, user]
  );

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
        {/* Zone 1: Custom Brand Logo & Wordmark */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="flex items-center shrink-0 hover:opacity-90 transition-opacity"
          aria-label="AtlasPulse Home"
        >
          <AtlasPulseLogo size="sm" variant="badge" />
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

        {/* Zone 3: Authentication & New Session */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 bg-slate-100 py-1 pl-1.5 pr-2 rounded-full border border-slate-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-slate-800 max-w-[100px] sm:max-w-[130px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <span
                className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200"
                title="Your saved places and itineraries are synced with Firebase Firestore"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                <span>Synced</span>
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                title="Sign out of Firebase"
                aria-label="Sign out of Firebase"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/70 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={isAuthLoading}
              className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shadow-xs disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isAuthLoading ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNewSession}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            New Session
          </button>
        </div>
      </header>

      {/* Auth Error Banner */}
      {authError && (
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2 text-xs flex items-center justify-between gap-2 shrink-0">
          <span>Authentication Notice: {authError}</span>
          <button
            type="button"
            onClick={clearAuthError}
            className="underline font-semibold hover:text-red-950 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 relative">
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          language="en"
          region="US"
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
                onViewReviews={setReviewModalPlace}
                routePlaceIds={routePlaceIds}
                onRoutePlaceIdsChange={setRoutePlaceIds}
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
                                onClick={() => setReviewModalPlace(place)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 flex items-center gap-1 transition-colors"
                                title="View top-rated user reviews summary via Google Places Details API"
                              >
                                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                <span>Reviews</span>
                              </button>
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
                  <div className="flex items-center gap-2.5">
                    <h1 className="font-display text-xl font-bold text-slate-950">
                      Saved Places Itinerary
                    </h1>
                    {user ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Cloud className="w-3 h-3 text-emerald-600" />
                        <span>Firebase Cloud Synced</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        <span>Local Browser Storage</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {user
                      ? `Bookmarked Google Maps locations synced in real time to your Firebase account (${user.email}).`
                      : 'Bookmarked Google Maps locations saved locally. Sign in with Google to sync across devices.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {savedPlaces.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setRoutePlaceIds(savedPlaces.map((p) => p.id));
                        setActiveTab('workspace');
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
                    >
                      <Route className="w-3.5 h-3.5" />
                      <span>Draw Route on Map</span>
                    </button>
                  )}
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
                      className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ask Chatbot to Plan Route</span>
                    </button>
                  )}
                </div>
              </div>

              {!user && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-blue-600" />
                      <span>Back up and sync your saved places</span>
                    </div>
                    <p className="text-xs text-blue-800">
                      Sign in with your Google account to automatically store bookmarks in Firebase Firestore and access your trip across devices.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signInWithGoogle()}
                    disabled={isAuthLoading}
                    className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-blue-200 rounded-lg hover:bg-blue-100/50 transition-colors whitespace-nowrap shrink-0 shadow-xs"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

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
                        <button
                          type="button"
                          onClick={() => setReviewModalPlace(place)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 flex items-center gap-1 transition-colors"
                          title="View top-rated user reviews summary via Google Places Details API"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>Reviews</span>
                        </button>
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

          {/* Place Reviews Summary Modal (Google Places Details API) */}
          {reviewModalPlace && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="w-full max-w-2xl max-h-[90vh] flex flex-col">
                <PlaceReviewsSummary
                  place={reviewModalPlace}
                  onClose={() => setReviewModalPlace(null)}
                  onAskChatAboutReviews={(place, summaryData) => {
                    setReviewModalPlace(null);
                    setActiveTab('workspace');
                    void handleSendMessage(
                      `Based on recent Google Places reviews for ${place.displayName} (${summaryData.averageRating.toFixed(1)}/5 from ${summaryData.totalRatingsCount.toLocaleString()} reviews): ${summaryData.generatedSummary}. What specific dishes, features, or tips do reviewers recommend most?`
                    );
                  }}
                  isModal={true}
                />
              </div>
            </div>
          )}
        </APIProvider>
      </main>
    </div>
  );
}
