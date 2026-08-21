import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { loadActionCenter } from "@/lib/home/load-action-center";
import { ActionCenter } from "@/components/home";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";

async function HomeContent() {
  if (!hasEnvVars) {
    return (
      <div className="max-w-xl space-y-2">
        <PageHeader
          title="Home"
          description="Supabase environment variables are not configured on this deployment."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-xl space-y-4">
        <PageHeader
          title="Home"
          description="Sign in as the L&P operator to load organization data. This is not a CRM or customer portal."
        />
      </div>
    );
  }

  const data = await loadActionCenter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        description="What matters right now — queues, deadlines, and verified intelligence."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/ingestion/intake">
                Start intake
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/procurement/opportunities">
                All pursuits
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        }
      />

      <ActionCenter data={data} />

      {/* Brief operational guidance (minimized to not dominate) */}
      <section className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Quick paths</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <Link href="/ingestion/intake" className="hover:underline">
              Intake
            </Link>{" "}
            → Process → Verify → Promote to canonical truth
          </li>
          <li>
            <Link href="/procurement/opportunities" className="hover:underline">
              Pursuits
            </Link>{" "}
            → Overview → Requirements → Pricing → Response → Submission → Result
          </li>
          <li>
            <Link href="/intelligence/ask" className="hover:underline">
              Ask GPT
            </Link>{" "}
            for cross-corpus queries (searches verified facts only)
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <HomeContent />
    </Suspense>
  );
}
