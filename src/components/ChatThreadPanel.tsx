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
} from 'lucide-react';
import {
  CHATBOT_ROLES,
  ChatbotRoleId,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
  formatCoordinate,
} from '../utils/spatialParser';
import { ChatMessage } from '../types/places';
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

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-[14px] leading-[1.6] text-slate-800">
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
              className="font-display font-semibold text-slate-900 text-sm pt-2"
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
}) => {
  const [input, setInput] = useState('');
  const [showConfigBar, setShowConfigBar] = useState(true);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const activeRole = CHATBOT_ROLES.find((r) => r.id === roleId) || CHATBOT_ROLES[0];

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

  const quickPrompts = [
    activeRole.defaultQuery,
    `What live events, exhibitions, or local news are happening in ${activeCityName.split(',')[0]} today?`,
    `Plan a 3-stop walkable afternoon itinerary around ${activeCityName.split(',')[0]} with ratings and hours.`,
  ];

  return (
    <section
      aria-label="Gemini Grounded Spatial Assistant"
      className="flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden"
    >
      {/* Top Control Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AtlasPulseLogo size="xs" variant="icon-only" withPulseEffect={false} />
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Spatial Grounding Chat
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <span>{activeCityName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatCoordinate(center.lat, center.lng)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowConfigBar((prev) => !prev)}
              aria-expanded={showConfigBar}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Persona & Model</span>
            </button>
            <button
              type="button"
              onClick={onClearHistory}
              aria-label="Reset conversation thread"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Role Persona & Model Selector Controls */}
        {showConfigBar && (
          <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
            {/* Chatbot Role Selector */}
            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1">
                Specialist Role (System Instruction)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-200/70 p-1 rounded-lg">
                {CHATBOT_ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onRoleChange(r.id)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                      roleId === r.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model & Grounding Mode Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="gemini-model-select"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Gemini Model
                </label>
                <select
                  id="gemini-model-select"
                  value={model}
                  onChange={(e) => onModelChange(e.target.value as GeminiModelId)}
                  className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.desc})
                    </option>
                  ))}
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

      {/* Scrollable Multi-Turn Conversation Thread */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
        data-testid="chat-thread-scroll"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const mapsSources = (msg.sources || []).filter((s) => s.kind === 'maps');
          const webSources = (msg.sources || []).filter((s) => s.kind === 'web');

          return (
            <article
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Unboxed Metadata Kicker */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-0.5">
                {!isUser && (
                  <AtlasPulseLogo size="xs" variant="icon-only" withPulseEffect={false} className="w-3.5 h-3.5" />
                )}
                <span className="font-medium text-slate-700">
                  {isUser ? 'You' : activeRole.label}
                </span>
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
                className={`max-w-[92%] rounded-xl px-4 py-3 ${
                  isUser
                    ? 'bg-slate-900 text-white text-[14px] leading-relaxed'
                    : 'bg-slate-50 border border-slate-200 text-slate-900'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  renderFormattedText(msg.text)
                )}

                {/* Grounding Citations (Google Maps & Google Search) */}
                {!isUser && (mapsSources.length > 0 || webSources.length > 0) && (
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
                              {src.reviewSnippets && src.reviewSnippets.length > 0 && (
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
                          {webSources.map((src: GroundedSource, idx: number) => (
                            <React.Fragment key={src.id}>
                              {idx > 0 && (
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                              )}
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-700 hover:underline"
                              >
                                <span className="truncate max-w-[220px]">{src.title}</span>
                                <ArrowUpRight className="w-3 h-3 shrink-0" />
                              </a>
                            </React.Fragment>
                          ))}
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
                      onClick={() => onPlotQueryOnMap(msg.suggestedPlaceQuery!)}
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
              <span>Querying Google Maps & Search Grounding...</span>
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

      {/* Quick Prompts & Input Form */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/60 space-y-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSendMessage(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded-md hover:border-blue-400 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {prompt.length > 52 ? `${prompt.slice(0, 52)}...` : prompt}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="chat-location-input" className="sr-only">
            Ask a location-specific question
          </label>
          <input
            id="chat-location-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${activeRole.label} about places, hours, or events in ${
              activeCityName.split(',')[0]
            }...`}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </section>
  );
};
