import { cn } from "@/lib/utils";
import { PageHeader } from "./page-header";

interface CollectionPageProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollectionPage({
  title,
  description,
  actions,
  toolbar,
  children,
  className,
}: CollectionPageProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <PageHeader title={title} description={description} actions={actions} />
      {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      {children}
    </div>
  );
}
