import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Compass,
  Globe,
  MapPin,
  ExternalLink,
  RotateCcw,
  ArrowUpRight,
  SlidersHorizontal,
  Utensils,
  Landmark,
  Train,
  Music,
  Trees,
  Laptop,
  HeartHandshake,
  Sparkles,
  Lock,
  Maximize2,
  Minimize2,
  Columns2,
  PanelLeftOpen,
  ChevronDown,
  ChevronUp,
  Star,
  Map as MapIcon,
} from 'lucide-react';
import {
  CHATBOT_ROLES,
  ChatLayoutMode,
  ChatbotRoleId,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
  formatCoordinate,
  getBotRoleById,
} from '../utils/spatialParser';
import {
  GatedFeatureId,
  isBotRoleGatedForGuest,
  isModelGatedForGuest,
} from '../utils/authValidator';
import { ChatMessage, LivePlaceItem } from '../types/places';
import { AtlasPulseLogo } from './AtlasPulseLogo';

interface ChatThreadPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  roleId: ChatbotRoleId;
  onRoleChange: (role: ChatbotRoleId) => void;
  model: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  groundingMode: GroundingMode;
  onGroundingModeChange: (mode: GroundingMode) => void;
  activeCityName: string;
  center: LatLngLiteral;
  onSendMessage: (text: string) => void;
  onPlotQueryOnMap: (query: string) => void;
  onClearHistory: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (featureId: GatedFeatureId) => void;
  chatLayoutMode?: ChatLayoutMode;
  onChatLayoutModeChange?: (mode: ChatLayoutMode) => void;
  onOpenFullScreenStudio?: () => void;
  onReturnToSplitMap?: () => void;
  isAndroidView?: boolean;
  isDrawerView?: boolean;
  onCloseDrawer?: () => void;
  livePlaces?: LivePlaceItem[];
  onSelectPlaceOnMap?: (place: LivePlaceItem) => void;
  onViewPlaceReviews?: (place: LivePlaceItem) => void;
}

const MODEL_OPTIONS: { id: GeminiModelId; label: string; desc: string }[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    desc: 'General & Search Grounding',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    desc: 'Ultra-low latency',
  },
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash Latest',
    desc: 'Rolling latest Flash engine',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    desc: 'Complex spatial synthesis',
  },
];

const GROUNDING_OPTIONS: { id: GroundingMode; label: string }[] = [
  { id: 'auto', label: 'Hybrid' },
  { id: 'maps', label: 'Maps' },
  { id: 'search', label: 'Search' },
];

function renderBotIcon(roleId: ChatbotRoleId, className = 'w-3.5 h-3.5') {
  switch (roleId) {
    case 'concierge':
      return <Compass className={className} />;
    case 'culinary':
      return <Utensils className={className} />;
    case 'urbanist':
      return <Landmark className={className} />;
    case 'transit':
      return <Train className={className} />;
    case 'nightlife':
      return <Music className={className} />;
    case 'outdoors':
      return <Trees className={className} />;
    case 'work':
      return <Laptop className={className} />;
    case 'family':
      return <HeartHandshake className={className} />;
    default:
      return <Compass className={className} />;
  }
}

function renderFormattedText(text: string, isSpacious = false) {
  const lines = text.split('\n');
  return (
    <div
      className={`space-y-2 ${
        isSpacious ? 'text-[15px] leading-[1.7]' : 'text-[14px] leading-[1.6]'
      } text-slate-800`}
    >
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        const renderBold = (str: string) => {
          const parts = str.split(/(\*\*.*?\*\*)/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-950">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <React.Fragment key={pIdx}>{part}</React.Fragment>;
          });
        };

        if (line.startsWith('### ') || line.startsWith('## ')) {
          return (
            <h4
              key={idx}
              className={`font-display font-semibold text-slate-900 ${
                isSpacious ? 'text-base pt-2.5' : 'text-sm pt-2'
              }`}
            >
              {renderBold(line.replace(/^#{2,3}\s+/, ''))}
            </h4>
          );
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-slate-400 select-none mt-0.5">•</span>
              <span className="flex-1">{renderBold(line.slice(2))}</span>
            </div>
          );
        }

        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-mono text-xs text-slate-500 mt-0.5 tabular-nums">
                {numMatch[1]}.
              </span>
              <span className="flex-1">{renderBold(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={idx}>{renderBold(line)}</p>;
      })}
    </div>
  );
}

export const ChatThreadPanel: React.FC<ChatThreadPanelProps> = ({
  messages,
  isLoading,
  error,
  roleId,
  onRoleChange,
  model,
  onModelChange,
  groundingMode,
  onGroundingModeChange,
  activeCityName,
  center,
  onSendMessage,
  onPlotQueryOnMap,
  onClearHistory,
  isAuthenticated = false,
  onRequireAuth,
  chatLayoutMode = 'split',
  onChatLayoutModeChange,
  onOpenFullScreenStudio,
  onReturnToSplitMap,
  isAndroidView = false,
  isDrawerView = false,
  onCloseDrawer,
  livePlaces = [],
  onSelectPlaceOnMap,
  onViewPlaceReviews,
}) => {
  const [input, setInput] = useState('');
  // Default collapsed in compact split view so the chat message thread has maximum vertical height
  const [showConfigBar, setShowConfigBar] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeRole = getBotRoleById(roleId);
  const activeModelObj =
    MODEL_OPTIONS.find((m) => m.id === model) || MODEL_OPTIONS[0];
  const isFullScreen = chatLayoutMode === 'fullscreen';
  const isSpaciousView = isFullScreen || chatLayoutMode === 'wide' || isDrawerView;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      onSendMessage(trimmed);
      setInput('');
    }
  };

  const cityShortName = activeCityName.split(',')[0];
  const quickPrompts = [
    ...activeRole.samplePrompts.slice(0, 2),
    `What live events, exhibitions, or local news are happening in ${cityShortName} today?`,
  ];

  return (
    <section
      aria-label="Gemini Grounded Spatial Assistant"
      className="flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden"
    >
      {/* Top Control Header — Streamlined so Chat Thread Gets Maximum Vertical Space */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <AtlasPulseLogo size="xs" variant="icon-only" withPulseEffect={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {isFullScreen ? 'AI Spatial Concierge Studio' : 'Spatial AI Chat'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowConfigBar((prev) => !prev)}
                  title="Click to switch AI Bot Persona or Gemini Model"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {renderBotIcon(activeRole.id, 'w-3 h-3')}
                  <span>{activeRole.label}</span>
                  {showConfigBar ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-slate-200/70">
                  {activeModelObj.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                <span>{activeCityName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatCoordinate(center.lat, center.lng)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Quick Signature Ask, Layout Size Switcher, Bot Drawer Toggle, Reset */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Signature Ask Button — Always Accessible in 1 Click */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onSendMessage(activeRole.defaultQuery)}
              data-testid="ask-bot-signature-btn"
              title={`Ask ${activeRole.label}: "${activeRole.defaultQuery}"`}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask {activeRole.label.split(' ')[0]}</span>
            </button>

            {/* Chat Box Size Switcher (PC Desktop Workspace) */}
            {!isAndroidView && !isDrawerView && onChatLayoutModeChange && (
              <div
                role="group"
                aria-label="Chat Panel Size Switcher"
                data-testid="chat-size-switcher"
                className="hidden sm:inline-flex items-center bg-slate-200/80 p-0.5 rounded-md border border-slate-300/60 text-[11px] font-medium"
              >
                <button
                  type="button"
                  onClick={() => onChatLayoutModeChange('split')}
                  data-testid="chat-size-split"
                  aria-pressed={chatLayoutMode === 'split'}
                  title="Balanced 50/50 Split with Map"
                  className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                    chatLayoutMode === 'split'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns2 className="w-3 h-3 text-blue-600" />
                  <span>50/50</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChatLayoutModeChange('wide')}
                  data-testid="chat-size-wide"
                  aria-pressed={chatLayoutMode === 'wide'}
                  title="Wide Chat Box (67% Chat / 33% Map)"
                  className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                    chatLayoutMode === 'wide'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PanelLeftOpen className="w-3 h-3 text-blue-600" />
                  <span>Wide</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChatLayoutModeChange('fullscreen');
                    onOpenFullScreenStudio?.();
                  }}
                  data-testid="chat-size-fullscreen"
                  aria-pressed={chatLayoutMode === 'fullscreen'}
                  title="Expand AI Chat to Full-Screen Studio"
                  className={`px-2 py-1 rounded flex items-center gap-1 transition-all ${
                    chatLayoutMode === 'fullscreen'
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Full</span>
                </button>
              </div>
            )}

            {/* Return to Split Map button when in Full-Screen Studio */}
            {isFullScreen && onReturnToSplitMap && (
              <button
                type="button"
                onClick={onReturnToSplitMap}
                data-testid="exit-fullscreen-chat-btn"
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Minimize2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Split Map View</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowConfigBar((prev) => !prev)}
              aria-expanded={showConfigBar}
              data-testid="toggle-bot-roster-btn"
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                showConfigBar
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>AI Bots ({CHATBOT_ROLES.length})</span>
            </button>

            <button
              type="button"
              onClick={onClearHistory}
              aria-label="Reset conversation thread"
              className="px-2 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Reset</span>
            </button>

            {isDrawerView && onCloseDrawer && (
              <button
                type="button"
                onClick={onCloseDrawer}
                data-testid="close-ai-drawer-btn"
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Role Persona & Model Controls Drawer */}
        {showConfigBar && (
          <div
            className="pt-2 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150"
            data-testid="ai-bot-roster-panel"
          >
            {/* Chatbot Role Selector (8 Specialist Bots, 6 Gated for Guests) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-slate-500">
                  Select Specialist AI Bot ({CHATBOT_ROLES.length} Personas)
                </span>
                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => onRequireAuth?.('specialist_bots')}
                    data-testid="unlock-specialist-bots-link"
                    className="text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 transition-colors"
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                    <span>Sign in to unlock 6 Pro Bots</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-medium text-blue-700">
                    {activeRole.specialtyBadge}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-200/70 p-1 rounded-lg">
                {CHATBOT_ROLES.map((r) => {
                  const isSelected = roleId === r.id;
                  const isLocked = !isAuthenticated && isBotRoleGatedForGuest(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-testid={`bot-role-btn-${r.id}`}
                      data-locked={isLocked ? 'true' : 'false'}
                      onClick={() => {
                        if (isLocked) {
                          onRequireAuth?.('specialist_bots');
                          return;
                        }
                        onRoleChange(r.id);
                      }}
                      title={
                        isLocked
                          ? `${r.label} (Sign in required): ${r.shortDesc}`
                          : `${r.label}: ${r.shortDesc}`
                      }
                      className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap truncate ${
                        isSelected
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-blue-500/30'
                          : isLocked
                          ? 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <span
                        className={
                          isSelected
                            ? 'text-blue-600 shrink-0'
                            : 'text-slate-400 shrink-0'
                        }
                      >
                        {renderBotIcon(r.id, 'w-3.5 h-3.5')}
                      </span>
                      <span className="truncate flex-1 text-left">{r.label}</span>
                      {isLocked && (
                        <Lock
                          data-testid={`bot-lock-${r.id}`}
                          className="w-3 h-3 text-amber-600 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model & Grounding Mode Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="gemini-model-select"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Gemini AI Model Engine
                </label>
                <select
                  id="gemini-model-select"
                  value={model}
                  onChange={(e) => {
                    const nextModel = e.target.value as GeminiModelId;
                    if (!isAuthenticated && isModelGatedForGuest(nextModel)) {
                      onRequireAuth?.('pro_models');
                      return;
                    }
                    onModelChange(nextModel);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {MODEL_OPTIONS.map((m) => {
                    const lockedModel =
                      !isAuthenticated && isModelGatedForGuest(m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.desc})
                        {lockedModel ? ' — 🔒 Sign In Required' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500 mb-1">
                  Grounding Data Source
                </div>
                <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-md">
                  {GROUNDING_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onGroundingModeChange(g.id)}
                      className={`flex-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap truncate ${
                        groundingMode === g.id
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Body: Widescreen Studio Split (when Full Screen) or Spacious Conversation Thread */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Scrollable Multi-Turn Conversation Thread */}
        <div
          className={`flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-5 ${
            isFullScreen ? 'max-w-4xl mx-auto w-full' : ''
          }`}
          data-testid="chat-thread-scroll"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const msgBot = getBotRoleById(msg.roleId || roleId);
            const mapsSources = (msg.sources || []).filter(
              (s) => s.kind === 'maps'
            );
            const webSources = (msg.sources || []).filter(
              (s) => s.kind === 'web'
            );

            return (
              <article
                key={msg.id}
                className={`flex flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {/* Unboxed Metadata Kicker */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-0.5">
                  {!isUser && (
                    <span className="text-blue-600 flex items-center">
                      {renderBotIcon(msgBot.id, 'w-3.5 h-3.5')}
                    </span>
                  )}
                  <span className="font-medium text-slate-700">
                    {isUser ? 'You' : msgBot.label}
                  </span>
                  {!isUser && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                      {msgBot.specialtyBadge}
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  {!isUser && msg.usedModel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{msg.usedModel}</span>
                    </>
                  )}
                </div>

                {/* Message Body */}
                <div
                  className={`${
                    isSpaciousView ? 'max-w-[95%]' : 'max-w-[94%]'
                  } rounded-xl px-4 py-3.5 ${
                    isUser
                      ? 'bg-slate-900 text-white text-[14px] leading-relaxed'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 shadow-2xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    renderFormattedText(msg.text, isSpaciousView)
                  )}

                  {/* Grounding Citations (Google Maps & Google Search) */}
                  {!isUser &&
                    (mapsSources.length > 0 || webSources.length > 0) && (
                      <div className="mt-3.5 pt-3 border-t border-slate-200/80 space-y-2.5">
                        {mapsSources.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Verified Google Maps Grounding Links</span>
                            </div>
                            <div className="space-y-1.5">
                              {mapsSources.map((src: GroundedSource) => (
                                <div key={src.id} className="text-xs">
                                  <a
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900 hover:underline"
                                  >
                                    <span>{src.title}</span>
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                  </a>
                                  {src.reviewSnippets &&
                                    src.reviewSnippets.length > 0 && (
                                      <p className="text-[11px] text-slate-600 italic mt-0.5 pl-2 border-l border-slate-300">
                                        “{src.reviewSnippets[0]}”
                                      </p>
                                    )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {webSources.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Google Search Grounding Sources</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              {webSources.map(
                                (src: GroundedSource, idx: number) => (
                                  <React.Fragment key={src.id}>
                                    {idx > 0 && (
                                      <span
                                        aria-hidden="true"
                                        className="text-slate-300"
                                      >
                                        ·
                                      </span>
                                    )}
                                    <a
                                      href={src.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-700 hover:underline"
                                    >
                                      <span className="truncate max-w-[260px]">
                                        {src.title}
                                      </span>
                                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                                    </a>
                                  </React.Fragment>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Sync Grounded Query to Map Button */}
                  {!isUser && msg.suggestedPlaceQuery && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 truncate">
                        Map query: {msg.suggestedPlaceQuery}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onPlotQueryOnMap(msg.suggestedPlaceQuery!)
                        }
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Plot on Map</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {/* Loading Skeleton */}
          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-start space-y-1.5"
            >
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>{activeRole.label}</span>
                <span aria-hidden="true">·</span>
                <span>Querying Google Maps &amp; Search Grounding...</span>
              </div>
              <div className="w-[85%] rounded-xl px-4 py-3.5 bg-slate-50 border border-slate-200 space-y-2.5 animate-pulse">
                <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                <div className="h-3.5 bg-slate-200 rounded w-full" />
                <div className="h-3.5 bg-slate-200 rounded w-2/3" />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="rounded-lg px-3.5 py-2.5 bg-red-50 border border-red-200 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Full-Screen AI Studio Companion Sidebar: Live Plotted Places & Persona Switcher */}
        {isFullScreen && !isAndroidView && (
          <aside
            aria-label="Live Map Context & Quick Places Sidebar"
            data-testid="fullscreen-chat-sidebar"
            className="hidden lg:flex lg:w-[340px] xl:w-[380px] border-l border-slate-200 bg-slate-50/60 flex-col h-full overflow-y-auto p-4 space-y-4 shrink-0"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Map Context
                </h3>
                <p className="font-display text-sm font-semibold text-slate-900 mt-0.5">
                  {activeCityName} ({livePlaces.length} Live Places)
                </p>
              </div>
              {onReturnToSplitMap && (
                <button
                  type="button"
                  onClick={onReturnToSplitMap}
                  className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Open Map</span>
                </button>
              )}
            </div>

            {/* Quick Specialist Bot Switcher inside Full-Screen Studio */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                <span>Switch AI Specialist Bot</span>
                <span className="text-[10px] text-blue-600 font-medium">
                  {activeRole.specialtyBadge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CHATBOT_ROLES.map((r) => {
                  const selected = r.id === roleId;
                  const locked = !isAuthenticated && isBotRoleGatedForGuest(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        if (locked) {
                          onRequireAuth?.('specialist_bots');
                          return;
                        }
                        onRoleChange(r.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-left transition-all ${
                        selected
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                      }`}
                    >
                      <span className="shrink-0">
                        {renderBotIcon(r.id, 'w-3.5 h-3.5')}
                      </span>
                      <span className="truncate flex-1">{r.label}</span>
                      {locked && (
                        <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plotted Places List for 1-Click AI Deep-Dive */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-600">
                Plotted Map Places (Click to Ask AI)
              </div>
              {livePlaces.length === 0 ? (
                <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl p-3">
                  Ask a question in the chat to automatically plot and inspect places here.
                </p>
              ) : (
                <div className="space-y-2">
                  {livePlaces.slice(0, 6).map((place, idx) => (
                    <div
                      key={place.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-semibold text-blue-600">
                            0{idx + 1}
                          </span>
                          <h4 className="font-display text-xs font-semibold text-slate-900 truncate">
                            {place.displayName}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {place.formattedAddress}
                          </p>
                        </div>
                        {place.rating !== undefined && (
                          <span className="text-[11px] font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                            ★ {place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onSendMessage(
                              `Tell me more about ${place.displayName} at ${place.formattedAddress}, including what it is known for and any visitor tips.`
                            )
                          }
                          className="flex-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors text-center"
                        >
                          Ask AI About Place
                        </button>
                        {onViewPlaceReviews && (
                          <button
                            type="button"
                            onClick={() => onViewPlaceReviews(place)}
                            className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md flex items-center gap-1"
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            <span>Reviews</span>
                          </button>
                        )}
                        {onSelectPlaceOnMap && (
                          <button
                            type="button"
                            onClick={() => onSelectPlaceOnMap(place)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                          >
                            Map Pin
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Quick Prompts & Expandable Multi-Line Input Composer */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1">
            {quickPrompts.map((prompt, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSendMessage(prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded-md hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {prompt.length > 56 ? `${prompt.slice(0, 56)}...` : prompt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsComposerExpanded((prev) => !prev)}
            data-testid="toggle-composer-height-btn"
            title={
              isComposerExpanded
                ? 'Shrink message input box'
                : 'Make message input box taller'
            }
            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-100 flex items-center gap-1 shrink-0"
          >
            {isComposerExpanded ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Compact Box</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Larger Box</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label htmlFor="chat-location-input" className="sr-only">
            Ask a location-specific question
          </label>
          <textarea
            id="chat-location-input"
            data-testid="chat-location-input"
            rows={isComposerExpanded || isFullScreen ? 4 : 2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${activeRole.label} about places, hours, itineraries, or events in ${
              activeCityName.split(',')[0]
            }... (Press Enter to send, Shift+Enter for new line)`}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-60 resize-y min-h-[54px] max-h-[220px]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            data-testid="chat-submit-btn"
            className="px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 shadow-xs"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </section>
  );
};
