import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';
import { IconButton } from './Button';
import { useOverlayFocusTrap } from './focusTrap';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  /** Default width is 480px per Appembly Calm UI progressive disclosure spec */
  width?: number | string;
  children: React.ReactNode;
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  description,
  badge,
  footer,
  width = 480,
  children,
  className = '',
}) => {
  const { mounted, state } = usePresence(open, 220);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const titleId = `ap-sheet-title-${rawId}`;
  const descId = `ap-sheet-desc-${rawId}`;

  useOverlayFocusTrap(open, panelRef, onClose);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="ap-sheet-root" data-state={state}>
      <div
        className="ap-scrim"
        data-state={state}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-state={state}
        className={`ap-sheet-panel sheet ${className}`.trim()}
        style={{ maxWidth: width }}
      >
        {(title || description || badge) && (
          <div className="ap-sheet-header">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {title && (
                  <h2 id={titleId} className="ap-sheet-title">
                    {title}
                  </h2>
                )}
                {badge}
              </div>
              {description && (
                <p id={descId} className="ap-sheet-desc">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              aria-label="Close drawer"
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </IconButton>
          </div>
        )}
        <div className="ap-sheet-body appembly-scrollbar">{children}</div>
        {footer && <div className="ap-sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};
