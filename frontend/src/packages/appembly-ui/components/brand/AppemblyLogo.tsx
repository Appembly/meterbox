import React from 'react';

export interface AppemblyLogoProps {
  /**
   * - 'app-icon': Rounded-square Appembly Sage (#4E8067) squircle with Off-White (#F6F7F5) Fused Modular Mark (default)
   * - 'mark': Standalone geometric Fused Modular Mark without background tile
   * - 'favicon': Light bordered squircle with Sage mark
   * - 'lockup': App Icon + Wordmark ('Appembly' or custom productName)
   * - 'image': Uses the raster /appembly-icon.jpg asset
   */
  variant?: 'app-icon' | 'mark' | 'favicon' | 'lockup' | 'image';
  size?: number;
  productName?: string;
  tagline?: string;
  className?: string;
  strokeColor?: string;
  squircleColor?: string;
  /**
   * When true, animates the inner 2×2 modular core through the signature states:
   * 2×1 Top Visor -> Blink -> 1×1 Dot -> 1×2 Vertical Pill -> Filleted L-Core -> 90° Pivot.
   */
  animated?: boolean;
}

/**
 * Converts orthogonal polygon loops (CW for outer contours, CCW for inner holes)
 * into a G1 tangent-continuous SVG path using exact circular arcs:
 * - Convex 90° turns use radius `rConvex` (sweep-flag = 1)
 * - Concave 270° turns / diagonal bridges use radius `rConcave` (sweep-flag = 0)
 */
export function orthoLoopsToSvgPath(
  loops: number[][][],
  rConvex: number,
  rConcave: number
): string {
  const parts: string[] = [];
  for (const pts of loops) {
    const n = pts.length;
    if (n < 3) continue;

    const corners: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      r: number;
      sweep: 0 | 1;
    }[] = [];

    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      const dxIn = curr[0] - prev[0];
      const dyIn = curr[1] - prev[1];
      const lenIn = Math.hypot(dxIn, dyIn);
      const uxIn = dxIn / lenIn;
      const uyIn = dyIn / lenIn;

      const dxOut = next[0] - curr[0];
      const dyOut = next[1] - curr[1];
      const lenOut = Math.hypot(dxOut, dyOut);
      const uxOut = dxOut / lenOut;
      const uyOut = dyOut / lenOut;

      const cross = uxIn * uyOut - uyIn * uxOut;
      const isConvex = cross > 0;
      const desiredR = isConvex ? rConvex : rConcave;
      const r = Math.min(desiredR, lenIn * 0.48, lenOut * 0.48);

      corners.push({
        startX: curr[0] - uxIn * r,
        startY: curr[1] - uyIn * r,
        endX: curr[0] + uxOut * r,
        endY: curr[1] + uyOut * r,
        r,
        sweep: isConvex ? 1 : 0,
      });
    }

    let d = `M ${corners[0].startX.toFixed(2)} ${corners[0].startY.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const c = corners[i];
      const nextC = corners[(i + 1) % n];
      d += ` A ${c.r.toFixed(2)} ${c.r.toFixed(2)} 0 0 ${c.sweep} ${c.endX.toFixed(2)} ${c.endY.toFixed(2)}`;
      d += ` L ${nextC.startX.toFixed(2)} ${nextC.startY.toFixed(2)}`;
    }
    d += ' Z';
    parts.push(d);
  }
  return parts.join(' ');
}

const OUTER_FRAME_LOOP: number[][] = [
  [30.5, 11],
  [69.5, 11],
  [69.5, 30.5],
  [89, 30.5],
  [89, 69.5],
  [69.5, 69.5],
  [69.5, 89],
  [30.5, 89],
  [30.5, 69.5],
  [11, 69.5],
  [11, 30.5],
  [30.5, 30.5],
];

/**
 * Official Appembly Fused Modular "A" Mark (4×4 tangent-bridged modular grid):
 * Symmetrical 4-lobe outer modular frame fused at all four diagonal vertices via concave
 * circular bridges, with a central horizontal crossbar and a 2×1 upper rounded-pill counter.
 */
const MONOGRAM_RING_LOOPS: number[][][] = [
  OUTER_FRAME_LOOP,
  [
    [30.5, 30.5],
    [30.5, 50],
    [69.5, 50],
    [69.5, 30.5],
  ],
];

export const APPEMBLY_OUTER_FRAME_PATH = orthoLoopsToSvgPath([OUTER_FRAME_LOOP], 6.5, 7.5);
export const APPEMBLY_MONOGRAM_PATH = orthoLoopsToSvgPath(MONOGRAM_RING_LOOPS, 6.5, 7.5);
export const APPEMBLY_MONOGRAM_COMPACT_PATH = orthoLoopsToSvgPath(
  MONOGRAM_RING_LOOPS,
  6.0,
  8.5
);

const ANIMATED_CORE_STYLES = `
  @keyframes ap-cell-a {
    0%, 7% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    8.2% { x: 30.5px; y: 39.2px; width: 19.5px; height: 2.2px; rx: 1.1px; }
    9.5% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    10.8% { x: 30.5px; y: 39.2px; width: 19.5px; height: 2.2px; rx: 1.1px; }
    12.2%, 16% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    19%, 26% { x: 22.5px; y: 30.5px; width: 16px; height: 19.5px; rx: 7.5px; }
    29%, 36% { x: 48px; y: 30.5px; width: 16px; height: 19.5px; rx: 7.5px; }
    39%, 41% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    44%, 50% { x: 22px; y: 30.5px; width: 18px; height: 19.5px; rx: 7px; }
    54% { x: 29.5px; y: 30px; width: 20px; height: 20.5px; rx: 7.5px; }
    57%, 75% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    78%, 80% { x: 39px; y: 40.25px; width: 0px; height: 0px; rx: 0px; }
    83.5% { x: 28.5px; y: 29.8px; width: 20.5px; height: 20.8px; rx: 7.5px; }
    87%, 90% { x: 29.5px; y: 30.5px; width: 18.5px; height: 19.5px; rx: 7.5px; }
    93%, 100% { x: 30.5px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
  }
  @keyframes ap-cell-b {
    0%, 7% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    8.2% { x: 50px; y: 39.2px; width: 19.5px; height: 2.2px; rx: 1.1px; }
    9.5% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    10.8% { x: 50px; y: 39.2px; width: 19.5px; height: 2.2px; rx: 1.1px; }
    12.2%, 16% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    19%, 26% { x: 36px; y: 30.5px; width: 16px; height: 19.5px; rx: 7.5px; }
    29%, 36% { x: 61.5px; y: 30.5px; width: 16px; height: 19.5px; rx: 7.5px; }
    39%, 41% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    44%, 50% { x: 60px; y: 30.5px; width: 18px; height: 19.5px; rx: 7px; }
    54% { x: 50.5px; y: 30px; width: 20px; height: 20.5px; rx: 7.5px; }
    57%, 75% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
    78%, 84% { x: 61px; y: 40.25px; width: 0px; height: 0px; rx: 0px; }
    87.5% { x: 51px; y: 29.8px; width: 20.5px; height: 20.8px; rx: 7.5px; }
    90% { x: 52px; y: 30.5px; width: 18.5px; height: 19.5px; rx: 7.5px; }
    93%, 100% { x: 50px; y: 30.5px; width: 19.5px; height: 19.5px; rx: 7.5px; }
  }
  @keyframes ap-cell-bridge {
    0%, 7% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
    8.2% { x: 42px; y: 39.2px; width: 16px; height: 2.2px; }
    9.5% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
    10.8% { x: 42px; y: 39.2px; width: 16px; height: 2.2px; }
    12.2%, 16% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
    19%, 26% { x: 30px; y: 30.5px; width: 14px; height: 19.5px; }
    29%, 36% { x: 55.5px; y: 30.5px; width: 14px; height: 19.5px; }
    39%, 41% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
    43.5%, 51% { x: 49px; y: 40.25px; width: 2px; height: 0px; }
    54% { x: 41px; y: 30px; width: 18px; height: 20.5px; }
    57%, 75% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
    77.5%, 90.5% { x: 49px; y: 40.25px; width: 2px; height: 0px; }
    93%, 100% { x: 42px; y: 30.5px; width: 16px; height: 19.5px; }
  }
  @keyframes ap-bot-rot {
    0%, 59% { transform: rotate(0deg); }
    73%, 100% { transform: rotate(360deg); }
  }
  .ap-core-rot {
    transform-origin: 50px 50px;
    animation: ap-bot-rot 13.5s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
  .ap-cell-a {
    animation: ap-cell-a 13.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
  }
  .ap-cell-b {
    animation: ap-cell-b 13.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
  }
  .ap-cell-bridge {
    animation: ap-cell-bridge 13.5s cubic-bezier(0.45, 0, 0.25, 1) infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .ap-core-rot, .ap-cell-a, .ap-cell-b, .ap-cell-bridge {
      animation: none !important;
    }
  }
`;

/**
 * Renders the animated Fused Modular Mark using an SVG mask so the interior
 * modular visor performs double-blink, left/right gaze, split & merge/join,
 * continuous smooth 360° core rotation, and staggered cell spawning while
 * keeping the outer 4×4 silhouette 100% unchanged.
 */
export const AnimatedModularMarkGraphic: React.FC<{
  fill: string;
  maskId: string;
}> = ({ fill, maskId }) => (
  <>
    <style>{ANIMATED_CORE_STYLES}</style>
    <defs>
      <mask id={maskId}>
        <path d={APPEMBLY_OUTER_FRAME_PATH} fill="white" />
        <g className="ap-core-rot" fill="black">
          <rect
            className="ap-cell-a"
            x="30.5"
            y="30.5"
            width="19.5"
            height="19.5"
            rx="7.5"
          />
          <rect
            className="ap-cell-b"
            x="50"
            y="30.5"
            width="19.5"
            height="19.5"
            rx="7.5"
          />
          <rect
            className="ap-cell-bridge"
            x="42"
            y="30.5"
            width="16"
            height="19.5"
            rx="3"
          />
        </g>
      </mask>
    </defs>
    <path d={APPEMBLY_OUTER_FRAME_PATH} fill={fill} mask={`url(#${maskId})`} />
  </>
);

/**
 * Official Appembly Fused Modular Mark & App Icon Component.
 * Built on a tangent-bridged 4×4 modular grid ("Connected · Modular · Scalable · Timeless").
 */
export const AppemblyLogo: React.FC<AppemblyLogoProps> = ({
  variant = 'app-icon',
  size = 32,
  productName = 'Appembly',
  tagline,
  className = '',
  strokeColor,
  squircleColor = '#4E8067',
  animated = false,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const isCompact = size <= 20;
  const markPath = isCompact ? APPEMBLY_MONOGRAM_COMPACT_PATH : APPEMBLY_MONOGRAM_PATH;

  if (variant === 'image') {
    return (
      <img
        src="/appembly-icon.jpg"
        alt={productName}
        style={{ width: size, height: size }}
        className={`rounded-[22%] object-cover select-none ${className}`}
      />
    );
  }

  if (variant === 'mark') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className={`flex-shrink-0 select-none ${className}`}
      >
        {animated ? (
          <AnimatedModularMarkGraphic
            fill={strokeColor || 'currentColor'}
            maskId={`ap-mask-${uid}`}
          />
        ) : (
          <path d={markPath} fill={strokeColor || 'currentColor'} fillRule="evenodd" />
        )}
      </svg>
    );
  }

  if (variant === 'favicon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="8 8 84 84"
        style={{ width: size, height: size }}
        className={`flex-shrink-0 select-none ${className}`}
      >
        {animated ? (
          <AnimatedModularMarkGraphic
            fill={strokeColor || '#4E8067'}
            maskId={`ap-mask-${uid}`}
          />
        ) : (
          <path d={markPath} fill={strokeColor || '#4E8067'} fillRule="evenodd" />
        )}
      </svg>
    );
  }

  const appIconSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className={`flex-shrink-0 select-none ${variant === 'app-icon' ? className : ''}`}
    >
      <rect x="2" y="2" width="96" height="96" rx="22" fill={squircleColor} />
      {animated ? (
        <AnimatedModularMarkGraphic
          fill={strokeColor || '#F6F7F5'}
          maskId={`ap-mask-${uid}`}
        />
      ) : (
        <path d={markPath} fill={strokeColor || '#F6F7F5'} fillRule="evenodd" />
      )}
    </svg>
  );

  if (variant === 'app-icon') {
    return appIconSvg;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {appIconSvg}
      <div className="flex flex-col min-w-0">
        <span className="font-bold tracking-tight text-[16px] leading-tight text-[var(--ui-text-primary)]">
          {productName}
        </span>
        {tagline && (
          <span className="text-[11px] font-medium text-[#4E8067] leading-tight truncate">
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
};
