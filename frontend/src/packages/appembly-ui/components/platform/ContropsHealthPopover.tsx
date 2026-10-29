import React, { useEffect, useRef, useState } from 'react';
import { LiveDot } from '../primitives/LiveDot';

export interface ContropsServiceHealthItem {
  id: string;
  name: string;
  role: string;
  status: 'healthy' | 'degraded' | 'maintenance';
  latency: string;
  uptime: string;
}

export interface ContropsHealthPopoverProps {
  environment?: string;
  region?: string;
  pendingStepUpCount?: number;
  platformData?: any;
  direction?: 'down' | 'up';
  align?: 'left' | 'right';
  compact?: boolean;
  className?: string;
  onOpenApprovals?: () => void;
}

const DEFAULT_SERVICES: ContropsServiceHealthItem[] = [
  {
    id: 'harnway',
    name: 'AI Gateway & DLP',
    role: 'Semantic model routing & outbound scrub',
    status: 'healthy',
    latency: '18ms',
    uptime: '99.99%',
  },
  {
    id: 'sauthen',
    name: 'Sauthen Identity & STS',
    role: 'Passkey OIDC & 15m Agent STS broker',
    status: 'healthy',
    latency: '11ms',
    uptime: '99.99%',
  },
  {
    id: 'meterbox',
    name: 'Meterbox FinOps',
    role: 'CloudEvents ledger & ClickHouse rollups',
    status: 'healthy',
    latency: '24ms',
    uptime: '99.98%',
  },
  {
    id: 'sandbox',
    name: 'Graviton3 Compute Pool',
    role: 'Isolated arm64 worktree & preview sandboxes',
    status: 'healthy',
    latency: '32ms',
    uptime: '99.97%',
  },
];

export const ContropsHealthPopover: React.FC<ContropsHealthPopoverProps> = ({
  environment = 'Production',
  region = 'us-east-1 · arm64',
  pendingStepUpCount = 0,
  platformData,
  direction = 'down',
  align = 'right',
  compact = false,
  className = '',
  onOpenApprovals,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const services: ContropsServiceHealthItem[] = React.useMemo(() => {
    const rawNodes = platformData?.controps?.nodes;
    if (Array.isArray(rawNodes) && rawNodes.length > 0) {
      return DEFAULT_SERVICES.map((svc) => ({
        ...svc,
        status: 'healthy',
      }));
    }
    return DEFAULT_SERVICES;
  }, [platformData]);

  const hasWarning = pendingStepUpCount > 0 || services.some((s) => s.status !== 'healthy');

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      className={className}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Controps Internal PaaS · ${environment} (${region})`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: compact ? 26 : 30,
          padding: compact ? '0 8px' : '0 10px',
          borderRadius: 999,
          border: '1px solid var(--ui-border)',
          background: open ? 'var(--ui-bg-hover)' : 'var(--ui-bg-surface)',
          color: 'var(--ui-text-secondary)',
          fontFamily: 'var(--font-sans, inherit)',
          fontSize: compact ? 11 : 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease',
        }}
      >
        <LiveDot tone={hasWarning ? 'warn' : 'ok'} active />
        <span style={{ color: 'var(--ui-text-primary)', fontWeight: 550 }}>
          {hasWarning ? 'Attention' : 'Healthy'}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Controps Internal PaaS Health"
          style={{
            position: 'absolute',
            ...(direction === 'up'
              ? { bottom: 'calc(100% + 8px)' }
              : { top: 'calc(100% + 8px)' }),
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            width: 332,
            background: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border-strong)',
            borderRadius: 12,
            boxShadow: 'var(--ui-shadow-lg, 0 20px 44px -10px rgba(0, 0, 0, 0.35))',
            zIndex: 400,
            overflow: 'hidden',
            fontFamily: 'var(--font-sans, inherit)',
            color: 'var(--ui-text-primary)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--ui-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              background: 'color-mix(in srgb, var(--ui-bg-subtle) 55%, var(--ui-bg-surface))',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: 'var(--ui-text-primary)',
                }}
              >
                <LiveDot tone={hasWarning ? 'warn' : 'ok'} active />
                <span>Controps PaaS Runtime</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ui-text-muted)',
                  marginTop: 2,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {environment} · {region}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--ui-ok, #22863A) 12%, transparent)',
                color: 'var(--ui-ok, #22863A)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              99.98% SLO
            </span>
          </div>

          {/* Pending Step-Up Alert if any */}
          {pendingStepUpCount > 0 && (
            <div
              style={{
                padding: '9px 14px',
                borderBottom: '1px solid var(--ui-border)',
                background: 'var(--ui-warn-soft, rgba(229, 192, 123, 0.14))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--ui-text-primary)', fontWeight: 500 }}>
                {pendingStepUpCount} step-up approval{pendingStepUpCount > 1 ? 's' : ''} awaiting review
              </span>
              {onOpenApprovals && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenApprovals();
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ui-accent)',
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: 'pointer',
                  }}
                >
                  Review →
                </button>
              )}
            </div>
          )}

          {/* Service Health List */}
          <div style={{ padding: '6px 0' }}>
            {services.map((svc) => (
              <div
                key={svc.id}
                style={{
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12.5,
                      fontWeight: 550,
                      color: 'var(--ui-text-primary)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background:
                          svc.status === 'healthy'
                            ? 'var(--ui-ok, #22863A)'
                            : 'var(--ui-warn, #E5C07B)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {svc.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--ui-text-muted)',
                      paddingLeft: 13,
                      marginTop: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {svc.role}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    color: 'var(--ui-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  <div>{svc.latency}</div>
                  <div style={{ fontSize: 10, color: 'var(--ui-text-muted)' }}>{svc.uptime}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--ui-border)',
              background: 'color-mix(in srgb, var(--ui-bg-subtle) 45%, var(--ui-bg-surface))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--ui-text-muted)',
            }}
          >
            <span>Orchestrated by Controps</span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ui-text-secondary)' }}>
              All planes online
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
