import React from 'react';

export interface AdapptyIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  /**
   * Color palette variant for the standalone background-free 3-ribbon folded Delta mark:
   * - 'sage-fold' (default): Satin Off-White / Silver outer ribbons with Appembly Sage (#4E8067) inner folds
   * - 'all-sage': Luminous Sage (#68A688 -> #4E8067) outer ribbons with deep forest-sage (#264235) inner folds
   * - 'triloop': Semantic tri-loop palette — Sage (#4E8067), Slate Teal (#3B8EA5), and Warm Amber (#C98A2B)
   * - 'monochrome': Uses `currentColor` with 0.45 opacity on inner folds
   */
  variant?: 'sage-fold' | 'all-sage' | 'triloop' | 'monochrome';
  compact?: boolean;
}

/**
 * 120° rotationally symmetric (center 50, 56) folded-ribbon Delta segment:
 * - OUTER_RIBBON_PATH: Main curved ribbon face from left pinch over rounded apex to right capsule tip
 * - INNER_FOLD_PATH: Dimensional return fold tucked beneath the ribbon crease
 */
const OUTER_RIBBON_PATH =
  'M 29.0 42.0 C 33.8 29.2, 41.2 18.0, 50.0 18.0 C 58.8 18.0, 66.2 29.2, 71.0 42.1 C 72.8 46.8, 67.0 51.0, 61.2 48.6 C 58.0 47.2, 54.4 38.2, 49.5 34.5 C 41.2 32.8, 33.2 35.0, 29.0 42.0 Z';

const INNER_FOLD_PATH =
  'M 29.0 42.0 C 33.2 35.0, 41.2 32.8, 49.5 34.5 L 40.8 46.8 C 39.6 48.2, 37.8 48.0, 36.2 46.4 C 33.8 43.8, 31.2 42.2, 29.0 42.0 Z';

const ANGLES = [0, 120, 240] as const;

/**
 * Adappty product icon — background-free 3-fold rotationally symmetric (120°) folded-ribbon Delta ("A" / Δ)
 * representing the three autonomic control loops (Adaptive, Self-Healing, Evolving).
 */
export const AdapptyIcon: React.FC<AdapptyIconProps> = ({
  size,
  variant = 'sage-fold',
  compact: _compact,
  className = '',
  style,
  ...rest
}) => {
  const uid = React.useId().replace(/:/g, '');

  const triloopColors = [
    { outer: `url(#adp-tri-sage-${uid})`, fold: '#29483A' },
    { outer: `url(#adp-tri-teal-${uid})`, fold: '#1E4E5D' },
    { outer: `url(#adp-tri-amber-${uid})`, fold: '#6E4812' },
  ];

  const getOuterFill = (idx: number) => {
    if (variant === 'monochrome') return 'currentColor';
    if (variant === 'all-sage') return `url(#adp-sage-outer-${uid})`;
    if (variant === 'triloop') return triloopColors[idx].outer;
    return `url(#adp-offwhite-outer-${uid})`;
  };

  const getFoldFill = (idx: number) => {
    if (variant === 'monochrome') return 'currentColor';
    if (variant === 'all-sage') return `url(#adp-sage-fold-dark-${uid})`;
    if (variant === 'triloop') return triloopColors[idx].fold;
    return `url(#adp-sage-fold-${uid})`;
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="14 14 72 74"
      fill="none"
      style={size ? { width: size, height: size, ...style } : style}
      className={className}
      {...rest}
    >
      {variant !== 'monochrome' && (
        <defs>
          <linearGradient id={`adp-offwhite-outer-${uid}`} x1="25%" y1="15%" x2="75%" y2="85%">
            <stop offset="0%" style={{ stopColor: 'var(--ui-text-primary, #F6F7F5)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--ui-text-secondary, #A9AFAB)' }} />
          </linearGradient>
          <linearGradient id={`adp-sage-fold-${uid}`} x1="20%" y1="20%" x2="80%" y2="80%">
            <stop offset="0%" stopColor="#5C9679" />
            <stop offset="100%" stopColor="#2F5241" />
          </linearGradient>
          <linearGradient id={`adp-sage-outer-${uid}`} x1="25%" y1="15%" x2="75%" y2="85%">
            <stop offset="0%" stopColor="#82B99D" />
            <stop offset="55%" stopColor="#4E8067" />
            <stop offset="100%" stopColor="#3B634F" />
          </linearGradient>
          <linearGradient id={`adp-sage-fold-dark-${uid}`} x1="20%" y1="20%" x2="80%" y2="80%">
            <stop offset="0%" stopColor="#355B48" />
            <stop offset="100%" stopColor="#1B3026" />
          </linearGradient>
          <linearGradient id={`adp-tri-sage-${uid}`} x1="25%" y1="15%" x2="75%" y2="85%">
            <stop offset="0%" stopColor="#7EB69A" />
            <stop offset="100%" stopColor="#4E8067" />
          </linearGradient>
          <linearGradient id={`adp-tri-teal-${uid}`} x1="25%" y1="15%" x2="75%" y2="85%">
            <stop offset="0%" stopColor="#63B4CA" />
            <stop offset="100%" stopColor="#3B8EA5" />
          </linearGradient>
          <linearGradient id={`adp-tri-amber-${uid}`} x1="25%" y1="15%" x2="75%" y2="85%">
            <stop offset="0%" stopColor="#E3A84B" />
            <stop offset="100%" stopColor="#C98A2B" />
          </linearGradient>
        </defs>
      )}
      {ANGLES.map((deg, idx) => (
        <g key={deg} transform={`rotate(${deg} 50 56)`}>
          <path
            d={INNER_FOLD_PATH}
            fill={getFoldFill(idx)}
            opacity={variant === 'monochrome' ? 0.45 : 1}
          />
          <path d={OUTER_RIBBON_PATH} fill={getOuterFill(idx)} />
        </g>
      ))}
    </svg>
  );
};
