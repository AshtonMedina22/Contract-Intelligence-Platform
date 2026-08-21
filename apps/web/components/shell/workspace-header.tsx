import { cn } from "@/lib/utils";

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  className?: string;
}

export function WorkspaceHeader({
  title,
  subtitle,
  meta,
  status,
  actions,
  secondaryActions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <div className={cn("space-y-2 border-b pb-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      {actions || secondaryActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {secondaryActions}
        </div>
      ) : null}
    </div>
  );
}
