# shadcn/ui

**URL:** https://ui.shadcn.com  
**License:** MIT  
**Usage:** Design system primitives (already installed)

## Primitives present

Already vendored under `apps/web/components/ui/`:

- `sidebar` (collapsible icon)
- `breadcrumb`, `badge`, `button`
- `command`, `tabs`, `sheet`, `drawer`
- `dialog`, `alert-dialog`
- `resizable`, `progress`, `table`
- `dropdown-menu`, `tooltip`, `separator`
- `scroll-area`, `skeleton`

## Configuration

- Style: new-york
- Tailwind CSS variables
- Icon library: Lucide

## P1 additions

Created `components/shell/` with new primitives following shadcn patterns:

- `PageHeader` — title, description, actions
- `WorkspaceHeader` — title, subtitle, meta, status, actions
- `EmptyState` — title, description, action, icon
- `CollectionPage` — PageHeader + toolbar + children
