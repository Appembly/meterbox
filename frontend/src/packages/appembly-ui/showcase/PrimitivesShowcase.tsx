import React, { useState } from 'react';
import {
  AppemblyLogo,
  Badge,
  Button,
  CommandItem,
  CommandPalette,
  CountUp,
  Dialog,
  EmptyState,
  IconButton,
  LiveDot,
  Menu,
  Popover,
  Sheet,
  Skeleton,
  StatusPill,
  Tooltip,
  useAppemblyTheme,
  useToast,
} from '../index';

export const PrimitivesShowcaseSection: React.FC = () => {
  const { theme, toggleTheme } = useAppemblyTheme();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [counterValue, setCounterValue] = useState(14280);
  const [latencyValue, setLatencyValue] = useState(4.2);

  const commandItems: CommandItem[] = [
    {
      id: 'approve-failover',
      label: 'Approve payments-api region failover (eu-west-1 → eu-central-1)',
      group: 'Decisions & Step-Up',
      shortcut: '↵',
      badge: 'Approval',
      onSelect: () =>
        toast({
          title: 'Step-Up Approval Granted',
          description: 'payments-api traffic draining from eu-west-1.',
          tone: 'ok',
        }),
    },
    {
      id: 'open-sheet',
      label: 'Inspect MAPE-K Evidence Drawer (480px Sheet)',
      group: 'Progressive Disclosure',
      shortcut: '⌘I',
      onSelect: () => setSheetOpen(true),
    },
    {
      id: 'open-dialog',
      label: 'Open Confirmation Dialog',
      group: 'Progressive Disclosure',
      shortcut: '⌘D',
      onSelect: () => setDialogOpen(true),
    },
    {
      id: 'toggle-theme',
      label: `Switch to ${theme === 'light' ? 'Graphite Dark' : 'Off-White Light'} Theme`,
      group: 'Appearance',
      shortcut: '⌘T',
      onSelect: () => toggleTheme(),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Banner */}
      <section
        style={{
          backgroundColor: 'var(--ui-bg-surface)',
          border: '1px solid var(--ui-border)',
          borderRadius: 'var(--ui-radius-lg)',
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                margin: 0,
              }}
            >
              @appembly/ui — Calm UI Primitives &amp; Motion Tokens
            </h2>
            <StatusPill tone="accent" live>
              Phase 1 + 2 Foundations
            </StatusPill>
          </div>
          <p
            style={{
              fontSize: 13.5,
              color: 'var(--ui-text-muted)',
              margin: '4px 0 0',
              lineHeight: 1.55,
            }}
          >
            Zero-dependency React 18/19 + Tailwind 3/4 compatible primitives driven by{' '}
            <code>usePresence</code>, <code>useReducedMotion</code>, and{' '}
            <code>useCountUp</code>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setCmdkOpen(true)}>
            Command Palette (⌘K)
          </Button>
          <Button variant="secondary" onClick={toggleTheme}>
            Theme: {theme === 'light' ? 'Light (#F6F7F5)' : 'Dark (#111618)'}
          </Button>
          <Button variant="primary" onClick={() => setSheetOpen(true)}>
            Open 480px Sheet
          </Button>
        </div>
      </section>

      {/* Grid Row 1: Buttons, Badges, LiveDot & CountUp */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
        }}
      >
        {/* Buttons & IconButton */}
        <section
          style={{
            backgroundColor: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--ui-radius)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0 }}>
              Button &amp; IconButton
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '2px 0 0' }}>
              Variants (primary, secondary, ghost, danger), sizes (sm, md), and focus rings.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Revoke Token</Button>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--ui-border)',
              paddingTop: 14,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Button variant="primary" size="sm">
              Small Primary
            </Button>
            <Button variant="secondary" size="sm">
              Small Secondary
            </Button>
            <Button variant="secondary" size="sm" loading>
              Verifying
            </Button>
            <Tooltip content="Accessible IconButton with required aria-label">
              <IconButton aria-label="Refresh telemetry" variant="secondary" size="sm">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </IconButton>
            </Tooltip>
          </div>
        </section>

        {/* Badges, StatusPills & LiveDot */}
        <section
          style={{
            backgroundColor: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--ui-radius)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0 }}>
              Badge, StatusPill &amp; LiveDot
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '2px 0 0' }}>
              Semantic status tones with <code>tabular-nums</code> and a single calm 2.4s breathe.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge tone="neutral" dot>
              Neutral · 42
            </Badge>
            <Badge tone="accent" live>
              Executing · 4m 12s
            </Badge>
            <Badge tone="ok" dot>
              Healthy · 99.98%
            </Badge>
            <Badge tone="warn" live>
              Verifying · 18ms
            </Badge>
            <Badge tone="danger" dot>
              DLQ Alert · 3
            </Badge>
            <Badge tone="approval" live>
              Needs Approval · 2
            </Badge>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--ui-border)',
              paddingTop: 14,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <LiveDot tone="ok" label="Ingestion Stream Live" />
            <LiveDot tone="approval" label="Step-Up Gate Active" />
            <LiveDot tone="accent" active={false} label="Static (Settled)" />
          </div>
        </section>
      </div>

      {/* Grid Row 2: Overlays, Toasts, CountUp, Logo Loader */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
        }}
      >
        {/* Overlays, Menus & Toasts */}
        <section
          style={{
            backgroundColor: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--ui-radius)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0 }}>
              Sheet, Dialog, Menu, Popover &amp; Toast
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '2px 0 0' }}>
              Enter + exit animations via <code>usePresence</code>, Escape to dismiss, and focus traps.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
              Open 480px Sheet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
              Open Dialog
            </Button>

            <Menu
              items={[
                {
                  id: 'prod',
                  label: 'Production (us-east-1)',
                  shortcut: '⌘1',
                  selected: true,
                },
                {
                  id: 'staging',
                  label: 'Staging Canary',
                  shortcut: '⌘2',
                },
                {
                  id: 'revoke',
                  label: 'Revoke Active Lease',
                  tone: 'danger',
                },
              ]}
              onSelect={(id) =>
                toast({
                  title: `Selected menu action: ${id}`,
                  tone: id === 'revoke' ? 'danger' : 'neutral',
                })
              }
              trigger={
                <Button variant="secondary" size="sm">
                  Roving Menu ▾
                </Button>
              }
            />

            <Popover
              trigger={
                <Button variant="secondary" size="sm">
                  Anchored Popover
                </Button>
              }
            >
              <div style={{ padding: 14, width: 250 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  Token Lease Details
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ui-text-muted)',
                    margin: '4px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  Scoped Sauthen STS lease expires in <strong className="ap-tabular-nums">14m 20s</strong>.
                </p>
              </div>
            </Popover>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--ui-border)',
              paddingTop: 14,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  title: 'Failover verified in Frankfurt',
                  description: 'P99 latency settled at 4.2ms across 6 Graviton nodes.',
                  tone: 'ok',
                })
              }
            >
              Toast (OK)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  title: 'Human Step-Up Required',
                  description: 'Approve production schema migration on RDS.',
                  tone: 'approval',
                  action: {
                    label: 'Inspect in Sheet →',
                    onClick: () => setSheetOpen(true),
                  },
                })
              }
            >
              Toast (Approval)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  title: 'Rate limit threshold reached',
                  description: 'OpenMeter bucket throttled for tenant org_91a.',
                  tone: 'warn',
                })
              }
            >
              Toast (Warn)
            </Button>
          </div>
        </section>

        {/* CountUp & AppemblyLogo Loader Rework */}
        <section
          style={{
            backgroundColor: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--ui-radius)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0 }}>
                CountUp &amp; AppemblyLogo Loader
              </h3>
              <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '2px 0 0' }}>
                rAF <code>easeOutQuart</code> counter tween + flicker-free 3.2s loader keyframes.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCounterValue((v) => v + Math.floor(Math.random() * 1850 + 320));
                setLatencyValue((v) => Number((Math.max(1.8, v + (Math.random() - 0.5) * 1.4)).toFixed(1)));
              }}
            >
              Tween Values +
            </Button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 16,
              alignItems: 'center',
              borderTop: '1px solid var(--ui-border)',
              paddingTop: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                Billable Events Ingested
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <CountUp value={counterValue} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-muted)' }}>
                P99 Broker Latency
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <CountUp value={latencyValue} decimals={1} suffix="ms" />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tooltip content="speed='loader' (3.2s flicker-free keyframes)">
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <AppemblyLogo
                    variant="mark"
                    size={42}
                    strokeColor="var(--ui-accent)"
                    animated
                    speed="loader"
                  />
                  <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>loader</span>
                </div>
              </Tooltip>
              <Tooltip content="speed='ambient' (13.5s calm loop)">
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <AppemblyLogo
                    variant="mark"
                    size={42}
                    strokeColor="var(--ui-text-secondary)"
                    animated
                    speed="ambient"
                  />
                  <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>ambient</span>
                </div>
              </Tooltip>
            </div>
          </div>
        </section>
      </div>

      {/* Grid Row 3: Skeleton & EmptyState */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
        }}
      >
        <section
          style={{
            backgroundColor: 'var(--ui-bg-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 'var(--ui-radius)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0 }}>
              Skeleton (Transform Shimmer)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--ui-text-muted)', margin: '2px 0 0' }}>
              GPU-composited <code>translate3d</code> shimmer, static under reduced motion.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton width={40} height={40} radius="md" />
            <div style={{ flex: 1 }}>
              <Skeleton lines={2} height={12} />
            </div>
          </div>
          <Skeleton height={52} radius="md" />
        </section>

        <EmptyState
          title="No pending human approvals"
          description="All autonomic runbooks and Sauthen step-up leases are operating within policy."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  title: 'Simulated step-up request queued',
                  tone: 'approval',
                })
              }
            >
              Simulate Step-Up Interrupt
            </Button>
          }
        />
      </div>

      {/* 480px Right Slide-Over Sheet Demo */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Fail over payments-api to Frankfurt (eu-central-1)"
        description="Deep technical evidence, pre-flight evaluation gates, and scoped Sauthen STS lease."
        badge={<StatusPill tone="approval" live>Needs Approval</StatusPill>}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              Deny
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSheetOpen(false);
                toast({
                  title: 'Failover approved and executing',
                  description: 'Drain initiated on eu-west-1.',
                  tone: 'ok',
                });
              }}
            >
              Approve with Passkey
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13.5 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Why &amp; Blast Radius</div>
            <p style={{ color: 'var(--ui-text-secondary)', margin: 0, lineHeight: 1.55 }}>
              Elevated P99 packet loss detected on Dublin upstream transit. Blast radius: 34% of EU checkout traffic · Auto-reverts on error.
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--ui-border)', paddingTop: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Execution Command</div>
            <pre
              className="code"
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 'var(--ui-radius-sm)',
                backgroundColor: 'var(--ui-bg-subtle)',
                border: '1px solid var(--ui-border)',
                fontSize: 12,
                overflowX: 'auto',
              }}
            >
              {`adappty traffic shift --service payments-api \\\n  --from eu-west-1 --to eu-central-1 \\\n  --grant st_stepup_91f0a8c2`}
            </pre>
          </div>
        </div>
      </Sheet>

      {/* Centered Dialog Demo */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Rotate Sauthen Signing Key?"
        description="Existing active agent tokens will remain valid for their 15-minute grace window."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialogOpen(false);
                toast({
                  title: 'JWKS signing key rotated',
                  tone: 'warn',
                });
              }}
            >
              Rotate Key Now
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ui-text-secondary)', lineHeight: 1.55 }}>
          This action publishes a new <code>kid</code> to <code>/.well-known/jwks.json</code> and records an immutable audit event.
        </p>
      </Dialog>

      {/* Command Palette (⌘K) */}
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        onOpen={() => setCmdkOpen(true)}
        enableGlobalShortcut
        items={commandItems}
      />
    </div>
  );
};
