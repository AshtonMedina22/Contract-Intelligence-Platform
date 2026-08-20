import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve("apps/web/.env.local");
const upsert = {
  LP_OPERATOR_EMAIL: process.env.SET_EMAIL,
  LP_OPERATOR_PASSWORD: process.env.SET_PASSWORD,
  LP_OPERATOR_ORG_NAME: "L&P Global Security",
};

if (!upsert.LP_OPERATOR_EMAIL || !upsert.LP_OPERATOR_PASSWORD) {
  console.error("Missing SET_EMAIL or SET_PASSWORD.");
  process.exit(1);
}

let text = "";
try {
  text = readFileSync(envPath, "utf8");
} catch {
  console.error("apps/web/.env.local not found.");
  process.exit(1);
}

const lines = text.split(/\r?\n/);
const keys = new Set(Object.keys(upsert));
const kept = lines.filter((line) => {
  const key = line.split("=")[0];
  return !keys.has(key);
});
while (kept.length && kept[kept.length - 1] === "") kept.pop();
for (const [key, value] of Object.entries(upsert)) {
  kept.push(`${key}=${value}`);
}
kept.push("");
writeFileSync(envPath, kept.join("\n"));
console.log("Wrote LP_OPERATOR_* to apps/web/.env.local (not printed).");
