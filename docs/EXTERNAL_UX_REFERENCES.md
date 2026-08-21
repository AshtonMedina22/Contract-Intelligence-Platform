# External UX / shell references

**STATUS:** Routing / knowledge-registry index only. Not a redesign. Not an implementation task.  
**This repository remains the authoritative product.** Canonical IA lives in [UX_UI.md](UX_UI.md). Subsystem mechanic references live in [EXTERNAL_REFERENCE_REPOS.md](EXTERNAL_REFERENCE_REPOS.md).

External UX sources never silently replace:

- canonical IA (sidebar jobs vs workspace tabs)
- four commercial truths
- verification / provenance / View Source
- human-final pricing
- `L&P INPUT REQUIRED`
- purpose-aware retrieval / reuse states
- “no fake analytics / no charts without evidence”

Lazy UX notes: [reference-ux/README.md](reference-ux/README.md). Cursor rule: `.cursor/rules/external-ux-references.mdc`.

---

## UX target — lock this

The UI is **enterprise, information-dense, audit-oriented, desktop-first, responsive, table/grid-centric, and source/evidence-aware.**

**Avoid:** marketing-site layouts, giant hero sections, decorative graphics, excessive gradients, fake AI effects, unnecessary animation, excessive whitespace, fake dashboards, charts without verified trend data.

End-state analog (commercial, not code): Deltek/GovWin-style procurement intelligence **plus** Loopio/Responsive-style proposal intelligence, plus contracts/compliance, grounded GPT, and pricing intelligence. That is **serious procurement operating software**, not a generic SaaS dashboard and not ChatGPT with a sidebar.

### Canonical chrome

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Breadcrumbs        [ Find or Ask GPT... ]       [+ New]      [User]   │
├──────────────────┬──────────────────────────────────────────────────────┤
│ L&P Global       │                                                      │
│ Security ▼       │                                                      │
│                  │                                                      │
│ Home             │                CURRENT WORKSPACE                     │
│ Pursuits         │                                                      │
│ Intelligence     │                                                      │
│ Contracts        │                                                      │
│ Data Ops         │                                                      │
│                  │                                                      │
│ ───────────────  │                                                      │
│ Settings         │                                                      │
└──────────────────┴──────────────────────────────────────────────────────┘
```

**Header:** Breadcrumbs | Find or Ask GPT… | + New | User  
Ask GPT is a **persistent header capability**, not a sidebar app.

### Workspace tabs (never peer global sidebar modules)

```text
PURSUIT
Overview | Requirements | Pricing | Response | Submission | Result

INTELLIGENCE
Buyers | Competitors | Market | Pricing | Win/Loss | Content | Reports

CONTRACT
Overview | Service Plan | Commercial Terms | Changes | Renewal

DATA OPS
Intake | Processing | Verification | Exceptions | Historical Migration
```

### Component grammar

| Role | Control |
| --- | --- |
| Major jobs | Sidebar (five items + Settings footer) |
| Workflow inside a job | Horizontal workspace tabs |
| Collections | TanStack Table |
| Row detail without losing the list | Sheet / drawer (Twenty-style) |
| Create / edit / approve | Dialog |
| Destructive / consequential | AlertDialog |
| Verification + Response | Resizable |
| Pricing spreadsheet | Glide Data Grid only |
| Source review | PDF.js / react-pdf |
| Response editing | Tiptap (+ Novel patterns) |
| Find / Ask | shadcn Command + Morphic-style citations |

**Do not** turn database tables or backend stages into peer global navigation.

### Visual combination (target, not a merge)

| Source | Role |
| --- | --- |
| **Plane** | Overall navigation / workspace architecture |
| **Twenty** | Dense tables + filters + record side panels |
| **Studio Admin / official shadcn** | Actual reusable Next.js shell implementation |
| **OpenContracts** | Source verification workbench |
| **Documenso** | Submission / document workflow polish |
| **Novel** | Response editor |
| **Glide** | Pricing grid |
| **Morphic** | Global Find / Ask intelligence |

---

## How to use this registry

Do **not** analyze all UX references on every task. Do **not** install a new Vercel starter. The app is already Next.js + shadcn + Supabase.

For every UI/shell task:

1. Read [UX_UI.md](UX_UI.md) and inspect **existing local shell code first**.
2. Read **this file**.
3. Identify the chrome being changed (global shell vs list vs workspace vs verification vs editor vs Ask).
4. Select **only** the references that apply.

**Default maximum: 3 external UX references per task.** Use fewer whenever possible.

Then:

5. Prefer existing local components + a targeted upstream pattern. Never rewrite the app from Plane, Twenty, or a dashboard starter.
6. Do **not** clone repositories into this repo. Browse GitHub, or clone outside the project. Never commit upstream `.git` history.
7. For shadcn blocks, start with `npx shadcn@latest add <block> --dry-run`. Do not add `dashboard-01` wholesale.
8. AGPL products (Plane, Twenty, Documenso app, often OpenContracts) are **UX reference only** unless license copy is explicitly approved.
9. If a material inspection happens, write `docs/reference-ux/<slug>.md`. Do not create those notes in advance.
10. **Local canonical IA always wins** on conflict.

A listed reference existing does **not** mean we must restyle to match it.

---

## Routing table

| IF WORKING ON | CONSULT (max 3) |
| --- | --- |
| Global shell / sidebar / header / collapsed nav / workspace tabs | **Plane** (UX) + **shadcn sidebar-07 / sidebar-16** (code) + **Studio Admin** (MIT shell code) |
| Dense record lists / saved views / click-row side panel | **Twenty** (UX) + existing TanStack + shadcn Sheet |
| App shell implementation / page-header rhythm / nav config | **Studio Admin** + official **shadcn blocks** (dry-run) |
| Data Ops Verification split pane / PDF highlight vs facts | **OpenContracts** + shadcn Resizable + local workbench |
| Pursuit → Submission / approvals / document completion | **Documenso design** (UX); app is AGPL |
| Pricing grid interactions | **Glide Data Grid** (already a dependency) |
| Response editor chrome (slash / bubble / AI edit) | **Novel** + local Tiptap |
| Find / Ask GPT streaming / citations / source cards | **Morphic** |
| Tables / filters / empty / skeleton | Official **shadcn** + TanStack; mine `dashboard-01` **data-table only** via dry-run |

If more than three rows apply, pick the **gap being solved**.

---

## Current local shell (inspect before borrowing)

Do not replace these. Reconcile them to the locked IA.

| Piece | Local |
| --- | --- |
| Platform layout | `apps/web/app/(platform)/layout.tsx` (`SidebarProvider`, header, inset) |
| Sidebar | `apps/web/components/app-sidebar.tsx` (`collapsible="icon"`, **five single links**) |
| Header | `apps/web/components/app-shell-header.tsx` (breadcrumbs, Find/Ask form, + New, user) |
| shadcn Sidebar primitive | `apps/web/components/ui/sidebar.tsx` |
| Shell primitives | `apps/web/components/shell/` (`PageHeader`, `WorkspaceHeader`, `EmptyState`, `CollectionPage`) |
| Pursuit workspace tabs | `apps/web/components/opportunity-workspace/workspace-shell.tsx` |
| Contract workspace tabs | `apps/web/components/contract-workspace/workspace-shell.tsx` |
| Verification | `apps/web/app/(platform)/ingestion/verification/` |
| Ask | `apps/web/components/ask/ask-chat.tsx`, `apps/web/app/(platform)/intelligence/ask/page.tsx` |
| Pricing grid | `apps/web/components/opportunity-workspace/pricing-glide-grid.tsx` |
| Response editor | `apps/web/components/opportunity-workspace/response-tiptap-editor.tsx` |

**Known IA gap (do not “fix” unless the task is shell/IA):** Intelligence and Data Ops secondary destinations currently expand **inside the sidebar**. Canonical target is **five sidebar jobs only**; Buyers/…/Reports and Intake/…/Migration are **workspace tabs** after entering Intelligence or Data Ops.

### shadcn primitives already present

Do **not** re-add these unless a dry-run shows a missing piece:

`sidebar` · `breadcrumb` · `command` · `tabs` · `sheet` · `dialog` · `alert-dialog` · `resizable` · `badge` · `progress` · `table` · `dropdown-menu` · `tooltip` · `separator` · `scroll-area` · `skeleton` · `drawer`

`apps/web/components.json` is shadcn **new-york**, Tailwind CSS variables, Lucide.

---

## Target reusable skeleton (future implementation only)

**Not built in this registry task.** When an explicit shell/skeleton task is requested, establish these files by **adapting existing local shell + MIT/shadcn patterns**, without redesigning every page or workflow:

```text
components/
  shell/
    app-shell.tsx
    app-sidebar.tsx          (already exists — reconcile)
    app-header.tsx           (today: app-shell-header.tsx)
    global-find-ask.tsx
    new-menu.tsx
  workspace/
    workspace-header.tsx
    workspace-tabs.tsx
    workspace-toolbar.tsx
  data/
    data-table-shell.tsx
    filter-bar.tsx
    status-badge.tsx
    record-sheet.tsx
    empty-state.tsx
  evidence/
    source-drawer.tsx
    verification-layout.tsx
  shared/
    page-header.tsx
    metric-card.tsx          (actionable summaries only — no fake KPIs)
    attention-list.tsx
```

Six layouts to establish later (structure only, not every page):

1. Home shell  
2. Pursuits list → Pursuit workspace shell  
3. Intelligence shell  
4. Contracts list → Contract workspace shell  
5. Data Ops shell → Verification split-pane shell  
6. Global Find / Ask GPT overlay  

---

## License rule

Do **not** trust a remembered license indefinitely.

**Before copying meaningful source:**

1. Inspect the **current** LICENSE.
2. Record it in `docs/reference-ux/<slug>.md`.
3. Plane, Twenty, Documenso **app**, and other AGPL/non-permissive projects = **UX/visual reference only** unless explicitly approved.
4. Studio Admin / official shadcn examples are the preferred **code** sources (still verify LICENSE / registry terms).
5. Never paste substantial external code without provenance.

---

## Registered UX references

Analysis status at registry creation: **REGISTERED ONLY**. No deep clone/analysis was performed in this task.

---

### 1. Plane

| Field | Value |
| --- | --- |
| **URL** | https://github.com/makeplane/plane |
| **Also** | https://plane.so/blog/introducing-plane-navigation-2 (Navigation 2.0 write-up) |
| **Reference category** | Global shell / workspace IA visual reference |
| **Usage mode** | UX REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | **AGPL-3.0** (verify current LICENSE). Visual/interaction reference **only**. Do not transplant implementation. |

**Why it matters:** Closest public IA analog: global Search in a stable top bar; compact/collapsible left nav; icon-only collapsed state; project-specific features moved out of the sidebar; horizontal tabs inside the current workspace; sidebar stays on major jobs.

**Consult when:** Global top bar; collapsible side rail; icon-only collapsed nav; workspace name/context; horizontal Pursuit/Contract/Intelligence/Data Ops tabs; giving the workbench more horizontal space.

**Inspect / borrow (patterns, not code):** Global top bar → our Breadcrumbs + Find/Ask + New + User; compact collapsible rail → Home/Pursuits/Intelligence/Contracts/Data Ops; workspace context at top → current tenant / current Pursuit; horizontal project tabs → our workspace tabs; dense work-item lists; filters/views without giant cards; global search separated from nav.

**Maps locally:** `app-sidebar.tsx`, `app-shell-header.tsx`, `(platform)/layout.tsx`, opportunity/contract `workspace-shell.tsx`.

**Do not:** copy Plane source; adopt Plane’s product IA; put every feature in the sidebar (that is the mess Plane moved away from).

---

### 2. Twenty

| Field | Value |
| --- | --- |
| **URL** | https://github.com/twentyhq/twenty |
| **Also** | `packages/twenty-docs/getting-started/core-concepts/layout.mdx` (layout concepts) |
| **Reference category** | Dense enterprise records / list → side panel |
| **Usage mode** | UX REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | **AGPL**. UX reference, not copy/paste source. |

**Why it matters:** Compact nav, global search / Cmd+K, dense tables, saved filters/sorts/views, click a record → **right-side panel without losing the list**, then optional full record, tabbed record pages.

**Consult when:** Pursuits, Contracts, Buyers, Competitors, Win/Loss, Documents, Research Sources list UIs; row-click preview; saved views.

**Target list pattern:**

```text
Pursuits Table  →  click row  →  Sheet with status / counts / [Open Workspace]
```

Do not make every row immediately a full page navigation if a Sheet can keep list context.

**Maps locally:** Pursuit/Contracts/Intelligence tables; shadcn `sheet.tsx` / `drawer.tsx`; TanStack tables. Requirements already specify Sheet/Drawer for row detail.

**Do not:** copy Twenty source; turn buyers into CRM accounts; add Twenty’s CRM objects.

---

### 3. Studio Admin / next-shadcn-admin-dashboard

| Field | Value |
| --- | --- |
| **URL** | https://github.com/arhamkhnz/next-shadcn-admin-dashboard |
| **Also** | Vercel template listing for Next.js + shadcn admin dashboard |
| **Reference category** | MIT Next.js/shadcn **shell implementation** |
| **Usage mode** | ADAPT CODE/PATTERN |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Reported **MIT** — still inspect current LICENSE before copying. Preferred code source for shell mechanics. |

**Why it matters:** Next.js + React + TypeScript + Tailwind + shadcn + TanStack Table; collapsible sidebar; variable content widths; layout/header rhythm. Stack matches ours. **This is where shell CODE may be borrowed.**

**Consult when:** App shell; sidebar; collapsed sidebar; header; responsive behavior; layout/content-width; navigation configuration; page header rhythm; data-table styling; user dropdown; empty states; loading/skeleton; theme/token organization.

**Inspect / borrow:** Those shell pieces only.

**Do not:** copy CRM/Finance/analytics screens; fake dashboard datasets; generic SaaS cards; replace our routes or business logic; install this repo as a new app.

**Maps locally:** `(platform)/layout.tsx`, `app-sidebar.tsx`, `app-shell-header.tsx`, `components/ui/*`, future `components/shell/` and `components/data/`.

---

### 4. Official shadcn/ui blocks

| Field | Value |
| --- | --- |
| **URL** | https://ui.shadcn.com/blocks |
| **CLI docs** | https://ui.shadcn.com/docs/cli |
| **Reference category** | Official blocks for sidebar + header + data table |
| **Usage mode** | USE LIBRARY + ADAPT EXAMPLES |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Follow current shadcn registry/license terms. Prefer `--dry-run` before any add. |

**Why it matters:** We do **not** need a new starter. Mine official blocks.

**Consult when:** Before writing custom sidebar/header/data-table chrome.

**Blocks to inspect first (dry-run only until an explicit shell task):**

```bash
npx shadcn@latest add sidebar-07 --dry-run
npx shadcn@latest add sidebar-16 --dry-run
npx shadcn@latest add dashboard-01 --dry-run
```

| Block | Why |
| --- | --- |
| `sidebar-07` | Sidebar that collapses to icons |
| `sidebar-16` | Sidebar + sticky site header / search arrangement |
| `dashboard-01` | Sidebar, site header, TanStack data table — **mine files, do not install wholesale** |

From `dashboard-01`, mine only: `app-sidebar.tsx`, `site-header.tsx`, `data-table.tsx`, `nav-main.tsx`, `nav-user.tsx`.

**Do not automatically copy:** `chart-area-interactive.tsx`, fake dashboard datasets, generic SaaS cards, random analytics.

**Maps locally:** Existing `components/ui/sidebar.tsx` + `app-sidebar.tsx` + `app-shell-header.tsx`. We already have `collapsible="icon"`.

---

### 5. Official shadcn/ui primitives

| Field | Value |
| --- | --- |
| **URL** | https://ui.shadcn.com/docs |
| **Resizable** | https://ui.shadcn.com/docs/components/resizable |
| **Reference category** | Installed design-system primitives |
| **Usage mode** | USE LIBRARY |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Already vendored under `apps/web/components/ui/`. Re-add a primitive only if missing. |

**Why it matters:** shadcn already supplies most of the grammar. Do not invent parallel widgets.

**Consult when:** Command/Find, tabs, sheet/drawer, dialogs, resizable splits, badges, progress, table chrome, menus, tooltips, skeletons.

**Maps locally:** `apps/web/components/ui/*.tsx`. Resizable is the Verification and Response split.

**Do not:** add another UI kit; restyle primitives into a marketing look.

---

### 6. OpenContracts (verification UX)

| Field | Value |
| --- | --- |
| **URL** | https://github.com/Open-Source-Legal/OpenContracts |
| **Mechanic registry** | [EXTERNAL_REFERENCE_REPOS.md](EXTERNAL_REFERENCE_REPOS.md) §3 |
| **Reference category** | Source PDF ↔ extracted facts workbench |
| **Usage mode** | UX REFERENCE (+ ADAPT CODE/PATTERN only after LICENSE check) |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE. If AGPL/restrictive, stay visual/mechanic reference unless approved. |

**Why it matters:** Spec is explicit: SOURCE PDF ↔ EXTRACTED FACTS with verify / edit / reject / conflict. Do not invent what document review should feel like.

**Consult when:** Data Ops Verification; PDF highlight; source vs fact split; keyboard review.

**Target layout:**

```text
┌──────────────────────────────────┬─────────────────────────────────┐
│ SOURCE                           │ EXTRACTED FACTS                 │
│ PDF page + highlighted excerpt   │ fields + ✓ / ? / ⚠              │
│                                  │ [Verify] [Edit] [Reject]        │
└──────────────────────────────────┴─────────────────────────────────┘
```

Local spec already: Resizable + PDF.js + TanStack + badges + keyboard.

**Maps locally:** `apps/web/app/(platform)/ingestion/verification/` (`workbench-client.tsx`, `pdf-source-pane.tsx`).

**Do not:** replace our procurement model or staging/canonical pipeline.

---

### 7. Documenso design

| Field | Value |
| --- | --- |
| **URL** | https://github.com/documenso/design |
| **Reference category** | Document / completion workflow design assets |
| **Usage mode** | UX REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE on the design repo before copying assets. Prefer screenshots/Figma as reference. |

**Why it matters:** Published design/Figma resources for document status, completion steps, action bars — without taking the AGPL app.

**Consult when:** Submission packet UX; required-action state; document history; review/approve/send; future signature/output.

**Maps locally:** `apps/web/components/opportunity-workspace/submission-workbench.tsx`; contract documents; approvals.

**Do not:** make Documenso the platform shell.

---

### 8. Documenso app

| Field | Value |
| --- | --- |
| **URL** | https://github.com/documenso/documenso |
| **Reference category** | Submission / signing / document-completion UX |
| **Usage mode** | UX REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | **AGPL / commercial dual-license considerations.** Design reference first. Do not copy app source unless approved. |

**Why it matters:** Document status, completion steps, required recipient/action state, history, action bars, review/approve/send, signing/completion.

**Maps to:** Pursuit → Submission; contract documents; approvals; future signature/output workflows.

**Do not:** replace Google Docs working-proposal path; copy their product architecture.

---

### 9. Glide Data Grid

| Field | Value |
| --- | --- |
| **URL** | https://github.com/glideapps/glide-data-grid |
| **Mechanic registry** | [EXTERNAL_REFERENCE_REPOS.md](EXTERNAL_REFERENCE_REPOS.md) §14 |
| **Reference category** | Pricing spreadsheet |
| **Usage mode** | USE LIBRARY + ADAPT OFFICIAL EXAMPLES |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Already a dependency (`@glideapps/glide-data-grid`). Inspect LICENSE before copying examples. |

**Consult when:** **Before** writing custom grid interactions (currency, paste, frozen columns, keyboard, validation, etc.).

**Maps locally:** `pricing-glide-grid.tsx`, `pricing-workbench.tsx`. Five truths stay visually distinct; human final bid remains required.

**Do not:** use Glide for ordinary collections (those are TanStack).

---

### 10. Novel

| Field | Value |
| --- | --- |
| **URL** | https://github.com/steven-tey/novel |
| **Mechanic registry** | [EXTERNAL_REFERENCE_REPOS.md](EXTERNAL_REFERENCE_REPOS.md) §15 |
| **Reference category** | Tiptap response-editor UX |
| **Usage mode** | ADAPT UI COMPONENT/PATTERN |
| **Analysis status** | **ADOPTED PATTERN (P6, 2026-08-21)** — see [reference-ux/novel.md](reference-ux/novel.md) |
| **License / copy caution** | **Apache-2.0** verified 2026-08-21. No source copied; bubble menu and slash stub written against our own `@tiptap/react` v3. |

**Consult when:** Slash commands, bubble menus, toolbars, AI rewrite/expand, streaming insert, keyboard — **before** inventing them.

**Maps locally:** `response-tiptap-editor.tsx`. Layout stays LEFT requirements / CENTER editor / RIGHT evidence.

**Do not:** turn Novel into the application shell.

---

### 11. Morphic

| Field | Value |
| --- | --- |
| **URL** | https://github.com/miurla/morphic |
| **Mechanic registry** | [EXTERNAL_REFERENCE_REPOS.md](EXTERNAL_REFERENCE_REPOS.md) §16 |
| **Reference category** | Find / Ask GPT citation + streaming UX |
| **Usage mode** | HIGH-VALUE CODE/PATTERN REFERENCE |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Inspect current LICENSE. UX/streaming/citation patterns only. |

**Consult when:** Header Find/Ask; streaming answer; citations; source cards; follow-ups; public research presentation.

**Maps locally:** `ask-chat.tsx`, `intelligence/ask/page.tsx`, `lib/ask/evidence.ts`. Keep Answer / Sources / Data Scope / Limitations / View Source.

**Do not:** turn the platform into Morphic.

---

### 12. TanStack Table

| Field | Value |
| --- | --- |
| **URL** | https://github.com/TanStack/table |
| **Docs** | https://tanstack.com/table |
| **Reference category** | Collection / matrix tables |
| **Usage mode** | USE LIBRARY |
| **Analysis status** | REGISTERED ONLY |
| **License / copy caution** | Already in the stack. Use official examples for column/filter/sort/virtualization. |

**Why it matters:** Canonical control for pursuits, requirements, portfolios, queues. Twenty/shadcn table chrome sits on top of this, not instead of it.

**Consult when:** Any dense list/matrix; do not reach for Glide unless it is the pricing spreadsheet.

**Maps locally:** Pursuit list, requirement matrix, contracts portfolio, Data Ops queues, Intelligence tables.

**Do not:** replace Glide pricing with TanStack; replace TanStack collections with a custom grid.

---

## Registry completeness

Registered (12/12):

1. Plane  
2. Twenty  
3. Studio Admin / next-shadcn-admin-dashboard  
4. Official shadcn/ui blocks  
5. Official shadcn/ui primitives  
6. OpenContracts (verification UX)  
7. Documenso design  
8. Documenso app  
9. Glide Data Grid  
10. Novel  
11. Morphic  
12. TanStack Table  

Adding a new UX reference: same fields, routing-table row, status **REGISTERED ONLY** until inspected, no lazy note until inspection.
