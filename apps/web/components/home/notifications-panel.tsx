"use client";

import Link from "next/link";
import { Bell, Check, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell";
import type { HomeNotification } from "@/lib/home/types";
import { markNotificationRead, markNotificationResolved } from "@/app/(platform)/overview/actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  items: HomeNotification[];
};

const severityClass: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  info: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200",
};

export function NotificationsPanel({ items }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <EmptyState
        title="No open notifications"
        description="Automation reminders appear here when deadlines, renewals, or backlogs need attention."
      />
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-md border px-3 py-2"
        >
          <Bell className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 space-y-0.5">
            {item.deepLink ? (
              <Link href={item.deepLink} className="text-sm font-medium hover:underline truncate block">
                {item.title}
              </Link>
            ) : (
              <p className="text-sm font-medium truncate">{item.title}</p>
            )}
            {item.body ? (
              <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{item.channel}</p>
          </div>
          <Badge className={`text-xs shrink-0 ${severityClass[item.severity] ?? severityClass.info}`} variant="outline">
            {item.severity}
          </Badge>
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={pending || item.status !== "open"}
              onClick={() => {
                startTransition(async () => {
                  await markNotificationRead(item.id);
                  router.refresh();
                });
              }}
              title="Mark read"
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={pending || item.status === "resolved"}
              onClick={() => {
                startTransition(async () => {
                  await markNotificationResolved(item.id);
                  router.refresh();
                });
              }}
              title="Resolve"
            >
              <Check className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
