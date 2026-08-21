"use client";

import Link from "next/link";
import { AlertCircle, Clock, FileWarning, CheckCircle2, RefreshCw, Pencil, DollarSign, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import type { AttentionItem } from "@/lib/home/types";

type Props = {
  items: AttentionItem[];
};

const categoryIcons: Record<AttentionItem["category"], React.ReactNode> = {
  due_pursuit: <Clock className="size-4" />,
  verification: <CheckCircle2 className="size-4" />,
  processing: <FileWarning className="size-4" />,
  exception: <AlertCircle className="size-4" />,
  renewal: <RefreshCw className="size-4" />,
  input_required: <Pencil className="size-4" />,
  pricing: <DollarSign className="size-4" />,
  approval: <Users className="size-4" />,
};

const priorityColors: Record<AttentionItem["priority"], string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
};

export function NeedsAttentionQueue({ items }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing needs immediate attention"
        description="All queues are clear. Check back later or start a new pursuit."
      />
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <span className="text-muted-foreground">{categoryIcons[item.category]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.title}</p>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">{item.context}</span>
          <Badge className={`text-xs ${priorityColors[item.priority]}`} variant="outline">
            {item.priority}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
