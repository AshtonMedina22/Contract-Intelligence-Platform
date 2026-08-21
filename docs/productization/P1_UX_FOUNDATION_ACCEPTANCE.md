# P1 — UX Foundation Acceptance

**Date:** 2026-08-20  
**Scope:** Establish permanent enterprise UX foundation so the app feels like ONE product. Not a rewrite. Preserve business logic.

---

## Before state

| Aspect | Before |
| --- | --- |
| Sidebar IA | Intelligence and Data Ops were **expandable submenus** with chevrons |
| CONTRACTS_TABS | Portfolio, Renewals, Compliance as peer tabs |
| Shell primitives | None — each page had bespoke heading/spacing |
| Workspace headers | Custom implementations per workspace |
| Layout density | Adequate (`p-3 md:p-4`) but inconsistent per-component |
| Empty states | Inconsistent text-only patterns |

---

## Decisions (KEEP / ADAPT / REPLACE)

| Component | Decision | Notes |
| --- | --- | --- |
| Global sidebar structure | **KEEP** | Five jobs: Home, Pursuits, Intelligence, Contracts, Data Ops |
| Intelligence submenu | **REPLACE** → single link | Links to `/intelligence` (redirects to `/intelligence/market`) |
| Data Ops submenu | **REPLACE** → single link | Links to `/ingestion/intake`, active for all `/ingestion/*` |
| Sidebar collapse/icon | **KEEP** | `collapsible="icon"` preserved |
| CONTRACTS_TABS | **ADAPT** | Removed Renewals/Compliance; pages now show breadcrumb back to Portfolio |
| Workspace shells | **ADAPT** | Tighter spacing, smaller buttons, condensed meta |
| Collection pages | **ADAPT** | Wired PageHeader + EmptyState |
| + New menu | **KEEP** | All routes valid (intake, bulk, contracts, intelligence/clients) |
| Find/Ask | **KEEP** | Header form unchanged, labels already "Find or Ask GPT" |

---

## Created primitives

| File | Purpose |
| --- | --- |
| `components/shell/page-header.tsx` | Title, description, actions slot |
| `components/shell/workspace-header.tsx` | Title, subtitle, meta, status, primary/secondary actions |
| `components/shell/empty-state.tsx` | Title, description, optional action, optional icon |
| `components/shell/collection-page.tsx` | Wraps PageHeader + toolbar + children |
| `components/shell/index.ts` | Barrel export |

---

## Files changed

### Critical IA fix

- `components/app-sidebar.tsx` — Intelligence/Data Ops now single links with child-route active state

### Shell primitives

- `components/shell/page-header.tsx` — new
- `components/shell/workspace-header.tsx` — new
- `components/shell/empty-state.tsx` — new
- `components/shell/collection-page.tsx` — new
- `components/shell/index.ts` — new

### Section tabs

- `components/section-tabs.tsx` — removed Renewals/Compliance from CONTRACTS_TABS

### Workspace shells

- `components/opportunity-workspace/workspace-shell.tsx` — condensed spacing, smaller actions
- `components/contract-workspace/workspace-shell.tsx` — condensed spacing

### Collection pages (wired PageHeader/EmptyState)

- `app/(platform)/contracts/page.tsx`
- `app/(platform)/contracts/renewals/page.tsx` — breadcrumb back to Portfolio
- `app/(platform)/contracts/compliance/page.tsx` — breadcrumb back to Portfolio
- `components/pursuits/pursuits-list.tsx`
- `app/(platform)/intelligence/market/page.tsx`
- `app/(platform)/intelligence/clients/page.tsx`
- `app/(platform)/ingestion/intake/page.tsx`
- `app/(platform)/ingestion/processing/page.tsx`
- `app/(platform)/ingestion/verification/page.tsx`
- `app/(platform)/overview/page.tsx`

### Minor fixes

- `app/(platform)/intelligence/ask/page.tsx` — fixed pre-existing lint error (`let` → `const`)

---

## References and licenses

| Source | License | Usage |
| --- | --- | --- |
| **shadcn/ui** | MIT | Primitives (Sidebar, Badge, Button, etc.) already present |
| **Kiranism/next-shadcn-dashboard-starter** | MIT | Pattern reference for dense shell layout (not copied) |
| **Plane** | AGPL-3.0 | UX reference only — visual pattern for compact nav (not copied) |
| **Twenty** | AGPL | UX reference only — dense tables/filters (not copied) |
| **TanStack Table** | MIT | Already a dependency |

No external code was copied. New shell primitives follow existing shadcn/new-york patterns.

---

## Independent P1 verification (2026-08-20)

**Verifier:** independent agent (code + IronBee DevTools browser MCP).  
**Overall:** **PASS** (one fix applied during verify loop; residual console noise non-blocking).

### Routes exercised (browser)

| Route | Purpose |
| --- | --- |
| `/overview` | Home / sidebar labels / header chrome / collapse / viewports |
| `/intelligence` → `/intelligence/market` | Intelligence single sidebar link + horizontal `IntelligenceNav` |
| `/ingestion/intake` | Data Ops single sidebar link + horizontal `DataOpsNav` |
| `/contracts` | `CONTRACTS_TABS` = Portfolio only |

### Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| **A1** Sidebar IA (code) | **PASS** | `app-sidebar.tsx`: Home, Pursuits, Intelligence, Contracts, Data Ops; Settings footer; no expandable submenus; Ask not in sidebar |
| **A2** Header chrome (code) | **PASS** | `app-shell-header.tsx`: breadcrumbs, Find/Ask GPT, + New, UserMenu |
| **A3** Section tabs (code) | **PASS** | `CONTRACTS_TABS` = Portfolio only; `IntelligenceNav` / `DataOpsNav` present |
| **B** Workspace consistency | **PASS** | Opportunity + contract `workspace-shell.tsx` share dense classes; workspace tabs intact (Overview…Result / Overview…Renewal) |
| **C1–C5** Browser IA | **PASS** | ARIA: sidebar peers only five jobs + Settings; Buyers/Competitors **not** sidebar peers; Intelligence → horizontal Buyers…Reports; Data Ops → Intake…Historical Migration |
| **C6** Sidebar collapse | **PASS** | Desktop toggle → `data-state=collapsed`, width ~47px (`collapsible="icon"`) |
| **C7** Responsive nav | **PASS** (after fix) | 1280 / 768 usable; **390 initially FAIL** — no open control (trigger lived only inside closed mobile Sheet). **Fixed:** header `SidebarTrigger` `md:hidden` in `(platform)/layout.tsx` + `aria-label` on trigger. Re-verify: drawer opens with Home…Settings |
| **C8** Console | **PASS WITH NOTES** | No product runtime failures blocking nav. Noise: Next HMR WebSocket handshake failures under browser MCP; shadcn `useIsMobile` hydration mismatch on narrow viewports (SSR assumes desktop). Non-blocking for desktop-first P1 |
| **D** A11y spot-check | **PASS** | Nav items = links; New = button; Ask input focusable + `aria-label="Find or Ask GPT"`; Toggle Sidebar named |
| **E** Regression | **PASS** | `npm run lint` 0; `npx tsc --noEmit` 0; `npm run build` 68 routes. No VERIFY0/phase0 nav scripts found |

### Screenshots / snapshots

- ARIA snapshots captured for overview, intelligence/market, ingestion/intake, contracts, mobile drawer open, desktop collapsed.
- Screenshot: `p1-desktop-overview-20260820-233030.png` (temp). In-`execute` screenshot once failed MCP schema (`_artifacts`); direct `content_take-screenshot` OK.

### Fixes made during verification

1. **`apps/web/app/(platform)/layout.tsx`** — `SidebarTrigger` in inset header with `className="md:hidden"` so mobile can open the Sheet.
2. **`apps/web/components/ui/sidebar.tsx`** — `aria-label="Toggle Sidebar"` on `SidebarTrigger`.

### External / residual blockers

| Item | Severity | Notes |
| --- | --- | --- |
| Next.js HMR WebSocket errors in MCP browser | External / dev | Does not block product nav |
| Sidebar hydration warning on `<768` | Known shadcn `useIsMobile` | SSR renders desktop peer; client swaps to Sheet. Nav works after hydrate; optional follow-up |
| `WorkspaceHeader` primitive unused by workspace shells | Limitation | Shells already dense; wiring deferred |

---

## Verification results (tooling)

| Check | Result |
| --- | --- |
| `npm run lint` | **PASS** (0 errors) — re-run after mobile fix |
| `npx tsc --noEmit` | **PASS** (0 errors) — re-run after mobile fix |
| `npm run build` | **PASS** (68 routes) |

---

## Limitations

1. **Not all pages updated** — bulk, exceptions, more intelligence pages retain old heading style (functional, just not wired to PageHeader yet)
2. **No TanStack Table migration for pursuits-list.tsx** — kept native table with EmptyState; TanStack already used by contracts-table
3. **Renewals/Compliance demoted** — pages still exist and work, now show breadcrumb back to Portfolio
4. **No thin data-table wrapper created** — existing `contracts-table.tsx` TanStack pattern adequate; no duplication to reduce
5. **Mobile Sheet hydration** — see residual blockers above

---

## Not done (by design)

- No Supabase/RLS/pricing/Ask/Response rewrite
- No fake data/charts
- No dashboard-01 wholesale install
- No Plane code import
- No schema changes
- No deletion of unrelated working code
