import type { JobPort } from "@lp/shared";
import { InlineLifecycleJobPort } from "@/lib/jobs/inline-job-port";
import { VercelWorkflowJobPort } from "@/lib/jobs/vercel-workflow-job-port";

export function getJobPort(): JobPort {
  if (process.env.WORKFLOW_INLINE === "1") {
    return new InlineLifecycleJobPort(null);
  }
  return new VercelWorkflowJobPort();
}
