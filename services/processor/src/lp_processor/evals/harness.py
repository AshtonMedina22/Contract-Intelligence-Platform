from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from lp_processor.evals.fixtures import fixture_cases, run_case
from lp_processor.routing_policy import load_routing_policy

REPO_ROOT = Path(__file__).resolve().parents[5]
RESULTS_JSON = REPO_ROOT / "docs" / "benchmarks" / "pilot-results.json"
RESULTS_MD = REPO_ROOT / "docs" / "benchmarks" / "PILOT_RESULTS.md"

PILOT_GAP = [
    "wins / losses as complete packages",
    "RFP / RFQ / IFB originals (L&P)",
    "proposals + pricing workbooks from the same opportunity",
    "scorecards",
    "contracts / amendments / renewals",
    "nested government tables",
    "real scanned PDFs (not empty-page synthetic)",
    "real DOCX",
]


def run_benchmark() -> dict:
    policy = load_routing_policy()
    rows = [run_case(case) for case in fixture_cases()]
    routed = sum(1 for row in rows if row["route_ok"])
    return {
        "generated_on": date.today().isoformat(),
        "policy_version": policy.version,
        "cloud_run_required": policy.cloud_run_required,
        "lp_packages_scored": 0,
        "lp_documents_scored": 0,
        "pilot_target_packages": 20,
        "pilot_target_documents": 30,
        "fixture_cases": len(rows),
        "fixture_routes_ok": routed,
        "missing_from_pilot": PILOT_GAP,
        "rows": rows,
        "notes": (
            "These scores are the locked fixture baseline. They do not replace a 20-30 package L&P pilot. "
            "DOCX is wired via python-docx. OCR (ocr-mistral) is wired only when MISTRAL_API_KEY is set."
        ),
    }


def render_markdown(report: dict) -> str:
    lines = [
        "# Pilot benchmark results",
        "",
        f"Generated **{report['generated_on']}**. Routing policy **{report['policy_version']}** "
        f"([ROUTING_POLICY.md](../ROUTING_POLICY.md)).",
        "",
        f"L&P packages scored: **{report['lp_packages_scored']}** / target {report['pilot_target_packages']}.",
        f"L&P documents scored: **{report['lp_documents_scored']}** / target {report['pilot_target_documents']}.",
        f"Fixture cases: **{report['fixture_cases']}** (routes ok: {report['fixture_routes_ok']}).",
        f"Cloud Run required by this evidence: **{report['cloud_run_required']}**.",
        "",
        report["notes"],
        "",
        "## Fixture scores",
        "",
        "| Case | Role | Parser | Route | Cells | Reqs | Entities | Dates | Provenance | Forms | Scan | Time ms | API $ |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in report["rows"]:
        forms = "n/a" if row["forms"] is None else row["forms"]
        lines.append(
            f"| {row['case_id']} | {row['package_role']} | `{row['parser_id']}` | "
            f"{'ok' if row['route_ok'] else 'FAIL'} | {row['table_cell_accuracy']} | "
            f"{row['requirement_recall']} | {row['entity_recall']} | {row['date_recall']} | "
            f"{row['provenance_ok']} | {forms} | {row['scan_quality']} | {row['time_ms']} | "
            f"{row['api_cost_usd']} |"
        )
    lines.extend(
        [
            "",
            "## Still missing before the routing table can claim a full L&P pilot",
            "",
        ]
    )
    for gap in report["missing_from_pilot"]:
        lines.append(f"- {gap}")
    lines.append("")
    return "\n".join(lines)


def write_results(report: dict | None = None) -> dict:
    report = report or run_benchmark()
    RESULTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_JSON.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    RESULTS_MD.write_text(render_markdown(report), encoding="utf-8")
    return report


def main() -> None:
    report = write_results()
    print(render_markdown(report))


if __name__ == "__main__":
    main()
