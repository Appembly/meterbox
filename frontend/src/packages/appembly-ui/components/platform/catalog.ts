export interface ThemePreset {
  id: string;
  name: string;
  label: string;
  shortLabel: string;
  hex: string;
  swatch: string;
  mid: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'valiscale-cobalt', name: 'Valiscale Cobalt', label: 'Valiscale Cobalt', shortLabel: 'Cobalt', hex: '#0F1E59', swatch: '#4F73FF', mid: '#4F73FF' },
  { id: 'calm-sage', name: 'Calm Sage', label: 'Calm Sage', shortLabel: 'Sage', hex: '#22543B', swatch: '#4E8067', mid: '#4E8067' },
  { id: 'worktree-gold', name: 'Worktree Gold', label: 'Worktree Gold', shortLabel: 'Gold', hex: '#B47828', swatch: '#E5C07B', mid: '#E5C07B' },
  { id: 'scale-sky', name: 'Scale Sky', label: 'Scale Sky', shortLabel: 'Sky', hex: '#0284C7', swatch: '#38BDF8', mid: '#38BDF8' },
  { id: 'wave-amber', name: 'Wave Amber', label: 'Wave Amber', shortLabel: 'Amber', hex: '#C47608', swatch: '#F59E0B', mid: '#F59E0B' },
  { id: 'emerald-teal', name: 'Emerald Teal', label: 'Emerald Teal', shortLabel: 'Teal', hex: '#0F766E', swatch: '#14B8A6', mid: '#14B8A6' },
];

export const PERSONAS = [
  {
    id: 'ConceptExplorer',
    label: 'Concept Validator',
    desc: 'Researches market TAM, evaluates risks, emits a Valiscale Validation Scorecard & promotes Ideas to Projects',
  },
  {
    id: 'AppBuilder',
    label: 'App Assembler',
    desc: 'Guides you conversationally to assemble a business app with auth, AI routing, billing & dev handoff',
  },
  {
    id: 'AgentAssembler',
    label: 'Agent Assembler',
    desc: 'Guides you step-by-step to design, wire, govern, and deploy a custom AI agent',
  },
  {
    id: 'General',
    label: 'General Assistant',
    desc: 'Full-workspace orchestration across identity, routing, and billing',
  },
  {
    id: 'SoftwareEngineer',
    label: 'Software Engineer',
    desc: 'Multi-file architecture, Git worktrees, and test verification',
  },
  {
    id: 'CodeReviewer',
    label: 'Code Reviewer',
    desc: 'Security, performance & diff audit',
  },
  {
    id: 'IssueResolver',
    label: 'Issue Resolver',
    desc: 'Autonomous bug reproduction & patch verification',
  },
  {
    id: 'APMTriage',
    label: 'APM Triage',
    desc: 'ClickHouse trace & latency root-cause analysis',
  },
  {
    id: 'IdentityArchitect',
    label: 'Identity Architect',
    desc: 'RFC 8693 Agent STS policies, passkey step-up & Vault',
  },
  {
    id: 'FinOpsAnalyst',
    label: 'FinOps Analyst',
    desc: 'OpenMeter usage rollups, credit burn & pricing margin simulation',
  },
];

export const MODEL_GROUPS = [
  {
    group: 'Adaptive Orchestration',
    provider: 'auto',
    items: [{ id: 'auto', label: 'Auto Tiering', sub: 'Dynamic Complexity Routing' }],
  },
  {
    group: 'DeepSeek AI',
    provider: 'deepseek',
    items: [
      { id: 'deepseek-flash', label: 'DeepSeek-V4.1-Flash', sub: '552B MoE / 1M Context' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek-V4-Pro', sub: 'High Capacity Frontier' },
      { id: 'deepseek-reasoner', label: 'DeepSeek-R1', sub: 'Hybrid CoT' },
    ],
  },
  {
    group: 'Google Gemini',
    provider: 'gemini',
    items: [
      { id: 'gemini-3.8-pro', label: 'Gemini 3.8 Pro', sub: 'Deep Reasoning & Multimodal' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', sub: 'Sub-second Agentic' },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', sub: 'Agentic Workhorse' },
    ],
  },
  {
    group: 'Anthropic Claude',
    provider: 'anthropic',
    items: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', sub: 'Flagship Autonomous & Coding' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', sub: 'Mythos Frontier Long-Horizon' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', sub: 'Balanced Intelligence' },
    ],
  },
  {
    group: 'OpenAI / Codex',
    provider: 'openai',
    items: [
      { id: 'gpt-6-astra', label: 'GPT-6 Astra', sub: 'Flagship Autonomous' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', sub: 'Complex Work' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', sub: 'Agentic Coding' },
    ],
  },
];

export const ALL_MODELS = MODEL_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.group, provider: g.provider }))
);

export function getModelOption(id: string) {
  return ALL_MODELS.find((m) => m.id === id) || ALL_MODELS[0];
}

export interface ByokProviderMeta {
  id: 'anthropic' | 'openai' | 'gemini' | 'deepseek';
  name: string;
  shortLabel: string;
  modelsSummary: string;
  keyPrefixPlaceholder: string;
  defaultHandleLabel: string;
  latency: string;
  uptime: string;
}

export const BYOK_PROVIDERS: ByokProviderMeta[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    shortLabel: 'DeepSeek (V4.1-Flash / V4-Pro / R1)',
    modelsSummary: 'DeepSeek-V4.1-Flash, DeepSeek-V4-Pro, DeepSeek-R1',
    keyPrefixPlaceholder: 'sk-...',
    defaultHandleLabel: 'deepseek-byok-key',
    latency: '480ms',
    uptime: '99.94%',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortLabel: 'Google (Gemini 3.8 Pro / 3.8 Flash / 3.7 Flash)',
    modelsSummary: 'Gemini 3.8 Pro, Gemini 3.8 Flash, Gemini 3.7 Flash',
    keyPrefixPlaceholder: 'AIzaSy...',
    defaultHandleLabel: 'gemini-byok-key',
    latency: '290ms',
    uptime: '99.99%',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    shortLabel: 'Anthropic (Claude Opus 5.5 / Fable 5.1 / Sonnet 5.5)',
    modelsSummary: 'Claude Opus 5.5, Claude Fable 5.1, Claude Sonnet 5.5',
    keyPrefixPlaceholder: 'sk-ant-api03-...',
    defaultHandleLabel: 'anthropic-byok-key',
    latency: '380ms',
    uptime: '99.98%',
  },
  {
    id: 'openai',
    name: 'OpenAI / Codex',
    shortLabel: 'OpenAI (GPT-6 Astra / GPT-6.1 Sol / GPT-5.3 Codex)',
    modelsSummary: 'GPT-6 Astra, GPT-6.1 Sol, GPT-5.3 Codex',
    keyPrefixPlaceholder: 'sk-proj-...',
    defaultHandleLabel: 'openai-byok-key',
    latency: '410ms',
    uptime: '99.95%',
  },
];

export function getByokProviderMeta(providerId: string): ByokProviderMeta {
  return BYOK_PROVIDERS.find((p) => p.id === providerId) || BYOK_PROVIDERS[0];
}

export const DEFAULT_ORGS = [
  { id: 'ns_live_appembly', name: 'Appembly Autonomous Suite', env: 'Production' },
  { id: 'ns_live_ws-mburun-dev', name: "Ken M.'s Workspace", env: 'Production' },
  { id: 'ns_live_napporay', name: 'Napporay', env: 'Production' },
  { id: 'ns_live_demo', name: 'Demo AI', env: 'Production' },
];

export interface OrgApp {
  id: string;
  name: string;
  env: string;
  url: string;
  desc: string;
  model: string;
  auth: string;
  mrr: string;
  margin: string;
  repo: string;
  handoff: string;
}

export const DEFAULT_ORG_APPS: OrgApp[] = [
  {
    id: 'app_01',
    name: 'Customer Checkout & Billing Portal',
    env: 'Production',
    url: 'portal.acmelabs.com',
    desc: 'Self-serve customer portal with Pro & Enterprise subscriptions, prepaid AI credits, and usage receipts.',
    model: 'claude-sonnet-5-5',
    auth: 'Passkey + OIDC SSO',
    mrr: '$11,240',
    margin: '81.2%',
    repo: 'acme-corp/checkout-api',
    handoff: 'IDE Ready · Synced',
  },
  {
    id: 'app_02',
    name: 'AI Support & Onboarding Concierge',
    env: 'Production',
    url: 'concierge.acmelabs.com',
    desc: 'Customer-facing onboarding assistant and support agent with human approval guardrails on account actions.',
    model: 'gpt-5.3-codex',
    auth: 'Scoped Agent STS',
    mrr: '$4,850',
    margin: '76.4%',
    repo: 'acme-corp/web-storefront',
    handoff: 'IDE Ready · Synced',
  },
  {
    id: 'app_03',
    name: 'Enterprise Revenue & Margin Copilot',
    env: 'Staging',
    url: 'staging-copilot.acmelabs.com',
    desc: 'Internal and enterprise customer analytics application with outbound DLP scrubbing and role-based access.',
    model: 'claude-opus-5-5',
    auth: 'SAML 2.0 + RBAC',
    mrr: '$2,330',
    margin: '78.0%',
    repo: 'acme-corp/revenue-copilot',
    handoff: 'Ready for Dev Handoff',
  },
];

export const AGENT_BUILDING_BLOCKS = {
  skills: [
    'Invoice Reconciliation',
    'Credit Burn Triage',
    'Prorated Plan Upgrade',
    'Customer Onboarding Playbook',
    'Diff & Security Audit',
    'SQL Read-Only Analytics',
    'Incident Root-Cause Triage',
  ],
  tools: [
    'stripe.issue_refund',
    'meterbox.check_quota',
    'zendesk.reply_ticket',
    'slack.post_alert',
    'github.create_pr',
    'postgres.query_readonly',
    'sauthen.request_stepup',
  ],
  memory: [
    'Customer 30d Usage Ledger',
    'Billing & Refund Policy Docs',
    'Session Thread Memory',
    'Product Knowledge Vector Store',
    'Git Repository AST Index',
  ],
  integrations: [
    'Stripe Billing',
    'Slack Enterprise',
    'GitHub App',
    'Zendesk Support',
    'Linear Issues',
    'PostgreSQL Read-Replica',
  ],
  stepUpPolicies: [
    'Passkey step-up on refunds > $100',
    'Passkey step-up on git.force_push & prod deploy',
    'Human approval on external customer emails',
    'Fully autonomous within read-only scopes',
  ],
  triggers: [
    'Webhook: stripe.invoice.disputed',
    'Schedule: Every 15m Quota Check',
    'Event: meterbox.credit_burn_85pct',
    'Webhook: github.pull_request.opened',
    'On-Demand: Chat & API Invocation',
  ],
};

export interface OrgAgent {
  id: string;
  name: string;
  role: string;
  goal: string;
  model: string;
  fallbackModel: string;
  status: string;
  repo: string;
  skills: string[];
  tools: string[];
  memory: string[];
  integrations: string[];
  governance: {
    ttl: string;
    stepUp: string;
    dlp: string;
    maxCost: string;
  };
  triggers: string[];
}

export const DEFAULT_ORG_AGENTS: OrgAgent[] = [
  {
    id: 'agt_billing_concierge',
    name: 'Revenue & Billing Support Agent',
    role: 'FinOps & Customer Billing Specialist',
    goal: 'Reconciles customer invoices, explains token credit burn, and prepares prorated upgrades or refunds with human step-up approval.',
    model: 'claude-sonnet-5-5',
    fallbackModel: 'gpt-4.1',
    status: 'Active · Production',
    repo: 'acme-corp/billing-concierge-agent',
    skills: ['Invoice Reconciliation', 'Credit Burn Triage', 'Prorated Plan Upgrade'],
    tools: ['stripe.issue_refund', 'meterbox.check_quota', 'zendesk.reply_ticket', 'sauthen.request_stepup'],
    memory: ['Customer 30d Usage Ledger', 'Billing & Refund Policy Docs'],
    integrations: ['Stripe Billing', 'Zendesk Support', 'Slack Enterprise'],
    governance: {
      ttl: '15m RFC 8693 STS',
      stepUp: 'Passkey step-up on refunds > $100',
      dlp: 'Strict PII & Card Scrubbing',
      maxCost: '$2.50 / run',
    },
    triggers: ['Webhook: stripe.invoice.disputed', 'Event: meterbox.credit_burn_85pct'],
  },
  {
    id: 'agt_onboarding_copilot',
    name: 'Customer Onboarding & KYB Specialist',
    role: 'Customer Success & Identity Guide',
    goal: 'Guides new enterprise tenants through OIDC SSO setup, BYOK Vault key sealing, and initial quota provisioning.',
    model: 'gpt-5.3-codex',
    fallbackModel: 'claude-sonnet-5-5',
    status: 'Active · Production',
    repo: 'acme-corp/onboarding-copilot-agent',
    skills: ['Customer Onboarding Playbook', 'SQL Read-Only Analytics'],
    tools: ['postgres.query_readonly', 'slack.post_alert', 'zendesk.reply_ticket'],
    memory: ['Product Knowledge Vector Store', 'Session Thread Memory'],
    integrations: ['Slack Enterprise', 'PostgreSQL Read-Replica'],
    governance: {
      ttl: '15m RFC 8693 STS',
      stepUp: 'Human approval on external customer emails',
      dlp: 'Strict PII & Secret Redaction',
      maxCost: '$1.50 / run',
    },
    triggers: ['On-Demand: Chat & API Invocation'],
  },
  {
    id: 'agt_code_release_auditor',
    name: 'PR Security & Margin Release Gate',
    role: 'Principal Security & Cost Reviewer',
    goal: 'Audits pull requests across application repositories for secret leaks, auth regressions, and token cost spikes.',
    model: 'claude-opus-5-5',
    fallbackModel: 'o3',
    status: 'Active · Production',
    repo: 'acme-corp/release-gate-agent',
    skills: ['Diff & Security Audit', 'Incident Root-Cause Triage'],
    tools: ['github.create_pr', 'slack.post_alert', 'sauthen.request_stepup'],
    memory: ['Git Repository AST Index', 'Session Thread Memory'],
    integrations: ['GitHub App', 'Linear Issues', 'Slack Enterprise'],
    governance: {
      ttl: '15m RFC 8693 STS',
      stepUp: 'Passkey step-up on git.force_push & prod deploy',
      dlp: 'Zero-Leak Source Code Shield',
      maxCost: '$4.00 / run',
    },
    triggers: ['Webhook: github.pull_request.opened'],
  },
];
