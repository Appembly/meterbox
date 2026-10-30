import React, { useEffect } from 'react';

export interface ContropsLogoProps {
  /**
   * - 'mark': Standalone Dual Counter-Rotating "C" Gimbals + Beacon (default)
   * - 'app-icon': Rounded squircle tile with Dual Counter-Rotating "C" Gimbals
   * - 'lockup': Animated Mark + "Controps" wordmark
   */
  variant?: 'mark' | 'app-icon' | 'lockup';
  size?: number;
  productName?: string;
  tagline?: string;
  className?: string;
  /**
   * Primary outer C-gimbal & center beacon color (defaults to Radar Copper #E59545 / var(--ui-accent))
   */
  accentColor?: string;
  /**
   * Inner counter-rotating C-gimbal & aperture node color (defaults to Warm Titanium / current text primary)
   */
  inkColor?: string;
  /**
   * Whether the Dual Counter-Rotating "C" Gimbals + Beacon animate (default: true)
   */
  animated?: boolean;
  /**
   * Animation cadence:
   * - 'ambient' (default): Holds the "C" silhouette steady, pulses the beacon, and performs a smooth counter-rotating gimbal calibration every 10s
   * - 'loader': Continuous 2.2s counter-rotating gimbal sweep for app entry, route transitions, and active telemetry sync
   */
  speed?: 'ambient' | 'loader';
}

const CONTROPS_GYRO_STYLES = `
  @keyframes controps-outer-ambient {
    0%, 68% { transform: rotate(0deg); }
    88%, 100% { transform: rotate(360deg); }
  }
  @keyframes controps-inner-ambient {
    0%, 68% { transform: rotate(0deg); }
    88%, 100% { transform: rotate(-360deg); }
  }
  @keyframes controps-outer-loader {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes controps-inner-loader {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-360deg); }
  }
  @keyframes controps-beacon-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.84); }
  }
  .controps-outer-ambient {
    transform-origin: 50px 50px;
    animation: controps-outer-ambient 10.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
  .controps-inner-ambient {
    transform-origin: 50px 50px;
    animation: controps-inner-ambient 10.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
  .controps-outer-loader {
    transform-origin: 50px 50px;
    animation: controps-outer-loader 2.2s cubic-bezier(0.55, 0.1, 0.45, 0.9) infinite;
  }
  .controps-inner-loader {
    transform-origin: 50px 50px;
    animation: controps-inner-loader 1.8s linear infinite;
  }
  .controps-beacon {
    transform-origin: 50px 50px;
    animation: controps-beacon-pulse 2.2s ease-in-out infinite;
  }
`;

/**
 * Live Canvas Browser-Tab Favicon Animator for Controps.
 * Guarantees that Chrome, Safari, Arc, and Firefox animate the Dual Counter-Rotating
 * "C" Gimbals + Beacon directly inside the browser tab favicon.
 */
export function useContropsAnimatedFavicon(fastSync = false) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const start = performance.now();
    const drawFrame = () => {
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      const isDark =
        document.documentElement.classList.contains('dark') ||
        window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const copper = isDark ? '#F43F85' : '#C81E68';
      const ink = isDark ? '#ECEAE4' : '#111318';

      let outerAngle = 0;
      let innerAngle = 0;

      if (fastSync) {
        outerAngle = (elapsed * Math.PI * 2) / 2.2;
        innerAngle = -(elapsed * Math.PI * 2) / 1.8;
      } else {
        const cycle = elapsed % 10.0;
        if (cycle > 7.2) {
          const p = (cycle - 7.2) / 2.8;
          const ease = p * p * (3 - 2 * p);
          outerAngle = ease * Math.PI * 2;
          innerAngle = -ease * Math.PI * 2;
        }
      }

      const pulse = 0.86 + 0.14 * Math.sin(elapsed * 3.0);

      ctx.clearRect(0, 0, 64, 64);

      // Outer C-Gimbal (radius 23, open on right [-40deg to +40deg])
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate(outerAngle);
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0.7, Math.PI * 2 - 0.7, false);
      ctx.strokeStyle = copper;
      ctx.lineWidth = 8.2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Right Aperture Node
      ctx.beginPath();
      ctx.arc(24, 0, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.restore();

      // Inner Counter-Rotating C-Gimbal (radius 13.5, open on left)
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate(innerAngle);
      ctx.beginPath();
      ctx.arc(0, 0, 13.5, Math.PI + 0.75, Math.PI - 0.75, false);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 5.8;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Center Telemetry Beacon
      ctx.beginPath();
      ctx.arc(32, 32, 5.2 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = copper;
      ctx.fill();

      if (link) {
        link.href = canvas.toDataURL('image/png');
      }
    };

    drawFrame();
    const intervalMs = fastSync ? 60 : 120;
    const timer = window.setInterval(drawFrame, intervalMs);
    return () => window.clearInterval(timer);
  }, [fastSync]);
}

/**
 * Official Controps Brand Mark:
 * Dual Counter-Rotating "C" Gimbals + Telemetry Beacon in Radar Copper (#E59545) & Warm Titanium.
 */
export const ContropsLogo: React.FC<ContropsLogoProps> = ({
  variant = 'mark',
  size = 28,
  productName = 'Controps',
  tagline,
  className = '',
  accentColor = 'var(--ui-accent, #F43F85)',
  inkColor = 'var(--ui-text-primary, #ECEAE4)',
  animated = true,
  speed = 'ambient',
}) => {
  const outerClass = !animated
    ? ''
    : speed === 'loader'
      ? 'controps-outer-loader'
      : 'controps-outer-ambient';
  const innerClass = !animated
    ? ''
    : speed === 'loader'
      ? 'controps-inner-loader'
      : 'controps-inner-ambient';
  const beaconClass = animated ? 'controps-beacon' : '';

  const renderMark = (svgSize: number) => {
    if (variant === 'app-icon') {
      return (
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 select-none"
          aria-hidden="true"
        >
          {animated && <style>{CONTROPS_GYRO_STYLES}</style>}
          <rect x="4" y="4" width="92" height="92" rx="22" fill="#14181F" stroke="#262E3B" strokeWidth="2" />
          <g className={outerClass}>
            <path
              d="M 74.5 29.5 A 32 32 0 1 0 74.5 70.5"
              stroke={accentColor}
              strokeWidth="10.5"
              strokeLinecap="round"
            />
            <circle cx="81" cy="50" r="4.5" fill={inkColor} />
          </g>
          <g className={innerClass}>
            <path
              d="M 37.5 34.5 A 19.5 19.5 0 1 1 37.5 65.5"
              stroke={inkColor}
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          </g>
          <circle className={beaconClass} cx="50" cy="50" r="6.8" fill={accentColor} />
        </svg>
      );
    }

    return (
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="10 10 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 select-none"
        aria-hidden="true"
      >
        {animated && <style>{CONTROPS_GYRO_STYLES}</style>}
        {/* Outer Counter-Rotating Copper C-Gimbal + Right Aperture Node */}
        <g className={outerClass}>
          <path
            d="M 74.5 29.5 A 32 32 0 1 0 74.5 70.5"
            stroke={accentColor}
            strokeWidth="10.8"
            strokeLinecap="round"
          />
          <circle cx="81" cy="50" r="4.5" fill={inkColor} />
        </g>
        {/* Inner Counter-Rotating Titanium C-Gimbal */}
        <g className={innerClass}>
          <path
            d="M 37.5 34.5 A 19.5 19.5 0 1 1 37.5 65.5"
            stroke={inkColor}
            strokeWidth="7.8"
            strokeLinecap="round"
          />
        </g>
        {/* Center Telemetry Beacon */}
        <circle className={beaconClass} cx="50" cy="50" r="6.8" fill={accentColor} />
      </svg>
    );
  };

  if (variant === 'lockup') {
    return (
      <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        {renderMark(size)}
        <span className="flex flex-col leading-none">
          <span className="font-bold tracking-tight" style={{ fontSize: Math.round(size * 0.56) }}>
            {productName}
          </span>
          {tagline && (
            <span className="text-[11px] opacity-65 font-medium tracking-wide mt-0.5">
              {tagline}
            </span>
          )}
        </span>
      </span>
    );
  }

  return <span className={`inline-flex items-center justify-center ${className}`}>{renderMark(size)}</span>;
};

export default ContropsLogo;
