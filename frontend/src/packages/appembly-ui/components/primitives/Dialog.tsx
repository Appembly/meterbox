import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../motion/usePresence';
import { IconButton } from './Button';
import { useOverlayFocusTrap } from './focusTrap';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number | string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  footer,
  maxWidth = 480,
  children,
  className = '',
}) => {
  const { mounted, state } = usePresence(open, 150);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const titleId = `ap-dialog-title-${rawId}`;
  const descId = `ap-dialog-desc-${rawId}`;

  useOverlayFocusTrap(open, panelRef, onClose);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="ap-dialog-root" data-state={state}>
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
        className={`ap-dialog-panel ${className}`.trim()}
        style={{ maxWidth }}
      >
        {(title || description) && (
          <div className="ap-sheet-header">
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <h2 id={titleId} className="ap-sheet-title">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="ap-sheet-desc">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              aria-label="Close dialog"
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
