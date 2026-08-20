import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ ok, name, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [9] ${name}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const workflow = read("apps/web/workflows/document-lifecycle.ts");
const jobPort = read("packages/shared/src/job-port.ts");
const getPort = read("apps/web/lib/jobs/get-job-port.ts");
const vercelPort = read("apps/web/lib/jobs/vercel-workflow-job-port.ts");
const inlinePort = read("apps/web/lib/jobs/inline-job-port.ts");
const runProcessor = read("apps/web/lib/jobs/run-processor.ts");
const ingest = read("apps/web/lib/intake/ingest.ts");

record(
  "lifecycle is a Vercel Workflow with human hook",
  workflow.includes('"use workflow"') &&
    workflow.includes("createHook") &&
    workflow.includes("await hook") &&
    !workflow.includes("promote_verified_fact"),
);

record(
  "JobPort exposes lifecycle start only (Queues are not lifecycle)",
  /export type JobPort = \{[\s\S]*startDocumentLifecycle\(/.test(jobPort) &&
    !jobPort.includes("@vercel/queue") &&
    jobPort.includes("Vercel Queues must not start or advance"),
);

record(
  "default JobPort adapter is Vercel Workflow",
  getPort.includes("VercelWorkflowJobPort") &&
    getPort.includes('WORKFLOW_INLINE === "1"') &&
    vercelPort.includes('from "workflow/api"') &&
    vercelPort.includes("documentLifecycleWorkflow"),
);

record(
  "intake starts lifecycle through JobPort, not Queues",
  ingest.includes("getJobPort().startDocumentLifecycle") &&
    !ingest.includes("@vercel/queue"),
);

record(
  "processor completion cannot mark VERIFIED",
  runProcessor.includes('payload.document_status === "VERIFIED"') &&
    inlinePort.includes("runProcessorParseExtract") &&
    !inlinePort.includes("promote_verified_fact"),
);

const failed = results.filter((row) => !row.ok).length;
console.log(`\n${results.filter((r) => r.ok).length} passed, ${failed} failed, ${results.length} total`);
if (failed > 0) process.exit(1);
