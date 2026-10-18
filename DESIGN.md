# DESIGN.md — Telkom Indonesia NSM Command Center

## Identity & Purpose
- **System**: Telkom Indonesia Network Service Management (NSM) Enterprise Operations & SD-WAN Command Center.
- **Audience**: Network Operation Center (NOC) engineers, field project managers, technicians, enterprise tenant administrators (Bank Mandiri, BPJS, Pelindo, etc.).
- **Character**: Authoritative, robust, data-dense, mission-critical infrastructure tool. Feels like high-end telecommunications operations software (similar to Datadog / Grafana enterprise NOC), never generic SaaS or template marketing.

## Anti-Slop Dials
- **ENERGY: 2** (Authoritative, precise, enterprise telecommunications operations).
- **RHYTHM: 3** (High-variance layouts tailored to distinct workflows: geospatial telemetry map, high-density incident tables, structured BA multi-step documentation, conversational agent console).
- **MOTION: 1** (Subtle state transitions $\le 150\text{ms}$; no bouncing, floating cards, or gratuitous template animations).

## Color System
- **Ground / Base**: Slate-50 (`#f8fafc`) page backdrop, pure white (`#ffffff`) surfaces with crisp 1px borders (`#e2e8f0` / `#cbd5e1`).
- **Primary / Brand**: Telkom Slate-900 (`#0f172a`) and Navy (`#1e293b`).
- **Accent**: Telkom Corporate Crimson (`#ee2e24` / `#dc2626`) reserved strictly for DOWN alerts, disconnected tunnels, and critical incidents.
- **Telemetry States**:
  - `UP` / Healthy: Quiet emerald (`#059669` / `#10b981`).
  - `DOWN` / Critical: Telkom crimson (`#dc2626`).
  - `WARNING` / Degraded: Amber (`#d97706`).
  - `SCHEDULED`: Muted slate/indigo (`#475569`).
- **Anti-Slop Banned Color Patterns**:
  - No purple-to-blue neon gradients.
  - No full-page colored radial glow orbs.
  - No rainbow badges.

## Typography & Hierarchy
- **Primary Typeface**: Inter / System UI font with high legibility.
- **Data & Numbers**: Monospaced tabular numerals (`font-mono font-medium`) for SIDs, edge serial numbers, Trace IDs, IP addresses, latencies, and ticket numbers (`PRO-2026-xxxxx`, `DWN-2026-xxxxx`).
- **Copywriting**: Plain, natural language (Bahasa Indonesia and professional English). Zero marketing buzzwords ("revolutionary", "seamless", "next-gen"). Zero em dashes (`—`) in agent copy.

## Component & Layout Architecture
- **Zero-Pill Discipline**: Static metadata (timestamps, tenant names, regions, status labels) rendered as clean unboxed text separated by typographic middots (`·`).
- **Card Integrity**: Solid surfaces, no glassmorphism stack, no floating shadows. Outer padding $\ge 16\text{px}$, inner radius = outer radius - padding.
- **Tables**: Border-collapse, crisp 1px dividers, sticky header, hover rows, monospaced keys, right-aligned numbers.
- **Every Button Works**: Zero dead clicks, zero placeholder links.
