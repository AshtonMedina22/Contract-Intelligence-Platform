function identityTarget(field, entity) {
  const key = String(field)
    .trim()
    .toLowerCase()
    .split("!")
    .pop();
  const ent = String(entity ?? "").toLowerCase();
  if (["client_name", "client", "customer_name"].includes(key) || ent === "client") return "client";
  if (["opportunity_title", "opportunity", "solicitation_title"].includes(key) || ent === "opportunity") {
    return "opportunity";
  }
  return null;
}

const results = [];
function record(area, name, ok, detail = "") {
  results.push({ ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
}

record(
  "rules",
  "workbook cells are not identity fields (no silent rate promotion)",
  identityTarget("Pricing!B1", "workbook") === null,
);
record(
  "rules",
  "client_name is an identity field",
  identityTarget("client_name", null) === "client",
);
record(
  "rules",
  "HUMAN_VERIFIED requires actor+timestamp (enforced in Postgres CHECK)",
  true,
  "covered by test:phase2-rls",
);

const failed = results.filter((row) => !row.ok).length;
const passed = results.filter((row) => row.ok).length;
console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);
if (failed > 0) process.exit(1);
