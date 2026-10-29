import React from 'react';

export interface AtlasPulseLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon-only' | 'badge';
  withPulseEffect?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { icon: 20, container: 'w-5 h-5', text: 'text-sm', badge: 'text-[9px] px-1 py-0.2' },
  sm: { icon: 26, container: 'w-6.5 h-6.5', text: 'text-base', badge: 'text-[10px] px-1.5 py-0.5' },
  md: { icon: 34, container: 'w-8.5 h-8.5', text: 'text-lg', badge: 'text-[10px] px-1.5 py-0.5' },
  lg: { icon: 44, container: 'w-11 h-11', text: 'text-xl', badge: 'text-xs px-2 py-0.5' },
  xl: { icon: 60, container: 'w-15 h-15', text: 'text-2xl', badge: 'text-xs px-2 py-1' },
};

export const AtlasPulseLogo: React.FC<AtlasPulseLogoProps> = ({
  size = 'md',
  variant = 'full',
  withPulseEffect = true,
  className = '',
}) => {
  const currentSize = SIZE_MAP[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Logo Emblem Icon */}
      <div className={`relative ${currentSize.container} shrink-0 flex items-center justify-center`}>
        {/* Subtle Live Radar Pulse Wave */}
        {withPulseEffect && (
          <span
            aria-hidden="true"
            className="absolute -inset-0.5 rounded-xl bg-blue-500/20 animate-ping opacity-60 pointer-events-none"
            style={{ animationDuration: '3s' }}
          />
        )}

        <svg
          viewBox="0 0 120 120"
          className="w-full h-full drop-shadow-xs transition-transform duration-300 hover:scale-105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="AtlasPulse Logo"
        >
          <defs>
            <linearGradient id="ap-bg-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#131D33" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            <linearGradient id="facet-top-left-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            <linearGradient id="facet-top-right-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>

            <linearGradient id="facet-bottom-left-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>

            <linearGradient id="facet-bottom-right-comp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            <radialGradient id="pulse-glow-comp" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#2563EB" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="beacon-glow-comp" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#D97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Squircle Housing with Subtle Border Highlight */}
          <rect
            x="5"
            y="5"
            width="110"
            height="110"
            rx="26"
            fill="url(#ap-bg-comp)"
            stroke="#334155"
            strokeWidth="2.5"
          />

          {/* Radar Echo Rings */}
          <circle cx="60" cy="54" r="44" fill="url(#pulse-glow-comp)" />
          <circle
            cx="60"
            cy="54"
            r="44"
            stroke="#0284C7"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.35"
          />
          <circle
            cx="60"
            cy="54"
            r="32"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeDasharray="3 4"
            opacity="0.45"
          />
          <circle cx="60" cy="54" r="20" stroke="#60A5FA" strokeWidth="1.2" opacity="0.5" />

          {/* Coordinate Crosshairs */}
          <line
            x1="22"
            y1="54"
            x2="98"
            y2="54"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.3"
          />
          <line
            x1="60"
            y1="16"
            x2="60"
            y2="92"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.3"
          />

          {/* Origami Cartographic Compass Facets */}
          <polygon points="60,20 34,50 60,60" fill="url(#facet-top-left-comp)" />
          <polygon points="60,20 86,50 60,60" fill="url(#facet-top-right-comp)" />
          <polygon points="34,50 60,60 60,94" fill="url(#facet-bottom-left-comp)" />
          <polygon points="86,50 60,60 60,94" fill="url(#facet-bottom-right-comp)" />

          {/* Facet Ridges */}
          <polyline
            points="60,20 60,94"
            stroke="#BAE6FD"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          <polyline
            points="34,50 60,60 86,50"
            stroke="#93C5FD"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Central Grounding Pulse Beacon */}
          <circle cx="60" cy="54" r="14" fill="url(#beacon-glow-comp)" />
          <circle cx="60" cy="54" r="4.5" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.8" />
          <circle cx="60" cy="54" r="1.5" fill="#FFFFFF" />

          {/* Signal Pulse Waves */}
          <path
            d="M 88 34 A 38 38 0 0 1 96 54"
            stroke="#F59E0B"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M 94 28 A 46 46 0 0 1 104 54"
            stroke="#F59E0B"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Typographic Wordmark & Spatial Tagline */}
      {variant !== 'icon-only' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-display font-bold tracking-tight text-slate-950 ${currentSize.text} leading-none`}
            >
              Atlas<span className="text-blue-600">Pulse</span>
            </span>
            {variant === 'badge' && (
              <span
                className={`font-mono font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 uppercase ${currentSize.badge}`}
              >
                Maps AI
              </span>
            )}
          </div>
          {size !== 'xs' && size !== 'sm' && (
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
              Grounded Maps & Search
            </span>
          )}
        </div>
      )}
    </div>
  );
};
