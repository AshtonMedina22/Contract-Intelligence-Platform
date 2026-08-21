import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shell";
import { formatMoney } from "@/lib/opportunity/pricing-math";
import { OPPORTUNITY_STAGES, GO_NO_GO_OPTIONS } from "@/lib/opportunity/types";
import { PROCUREMENT_RAILS, SOLICITATION_KINDS } from "@/lib/opportunity/proposal-packet";
import { REQUIREMENT_STATUS_LABELS, REQUIREMENT_MATRIX_STATUSES } from "@/lib/opportunity/overview-model";
import type { OverviewBundle } from "@/lib/opportunity/load-overview-bundle";

const UNKNOWN = "Not recorded";

function Section({
  id,
  title,
  hint,
  action,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {action ? <div className="text-xs">{action}</div> : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm" title={typeof children === "string" ? children : undefined}>
        {children}
      </dd>
    </div>
  );
}

function Value({ children }: { children: string | null | undefined }) {
  const text = children?.toString().trim();
  if (!text) return <span className="text-muted-foreground">{UNKNOWN}</span>;
  return <>{text}</>;
}

function tabHref(opportunityId: string, suffix = "") {
  return `/procurement/opportunities/${opportunityId}${suffix}`;
}

/** Packet gaps with no tab of their own are fixed on the operational metadata form. */
function gapHref(opportunityId: string, hrefSuffix: string) {
  return hrefSuffix
    ? tabHref(opportunityId, hrefSuffix)
    : `${tabHref(opportunityId)}#operational-metadata`;
}

export function OverviewSections({ bundle }: { bundle: OverviewBundle }) {
  return (
    <div className="space-y-3">
      <SolicitationSummarySection bundle={bundle} />
      <div className="grid gap-3 lg:grid-cols-2">
        <ScopeSection bundle={bundle} />
        <EvaluationSection bundle={bundle} />
      </div>
      <BidDecisionSection bundle={bundle} />
      <div className="grid gap-3 lg:grid-cols-2">
        <BuyerIntelligenceSection bundle={bundle} />
        <CompetitiveIntelligenceSection bundle={bundle} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <PriorExperienceSection bundle={bundle} />
        <ComplianceReadinessSection bundle={bundle} />
      </div>
      <RisksSection bundle={bundle} />
      <BidStrategySection bundle={bundle} />
      <NextActionsSection bundle={bundle} />
    </div>
  );
}

function SolicitationSummarySection({ bundle }: { bundle: OverviewBundle }) {
  const { opportunity, solicitations, provenance, summary } = bundle;
  const rail = PROCUREMENT_RAILS.find((r) => r.value === opportunity.procurement_rail)?.label ?? null;
  const kind = SOLICITATION_KINDS.find((k) => k.value === opportunity.solicitation_kind)?.label ?? null;
  const stage = OPPORTUNITY_STAGES.find((s) => s.value === opportunity.stage)?.label ?? opportunity.stage;

  return (
    <Section
      id="solicitation-summary"
      title="Solicitation summary"
      hint="Read-first view of the recorded pursuit record. Every blank field below means the value is not in the corpus, not that it is zero or absent from the solicitation."
      action={
        <Link className="underline" href={`/ingestion/intake?opportunity=${opportunity.id}`}>
          Intake / documents →
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Buyer / agency">
          <Value>{opportunity.client_name}</Value>
        </Field>
        <Field label="Solicitation no.">
          {solicitations.length === 0 ? (
            <span className="text-muted-foreground">No solicitation linked</span>
          ) : (
            solicitations.map((s) => s.solicitation_number ?? s.title).join(", ")
          )}
        </Field>
        <Field label="Solicitation kind">
          <Value>{kind}</Value>
        </Field>
        <Field label="Procurement rail">
          <Value>{rail}</Value>
        </Field>
        <Field label="Response due">
          <Value>{opportunity.response_due_on}</Value>
        </Field>
        <Field label="Coverage / POP start">
          <Value>{opportunity.coverage_start_on}</Value>
        </Field>
        <Field label="Service type">
          <Value>{opportunity.service_type}</Value>
        </Field>
        <Field label="Site / city">
          <Value>{opportunity.site_location}</Value>
        </Field>
        <Field label="Submission method">
          <Value>{opportunity.submission_method}</Value>
        </Field>
        <Field label="Vehicle / schedule">
          <Value>{opportunity.vehicle_ref}</Value>
        </Field>
        <Field label="Stage">{stage}</Field>
        <Field label="Documents ingested">{summary.documentCount}</Field>
      </dl>

      {opportunity.notes ? (
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-xs text-muted-foreground">Recorded special requirements / notes</p>
          <p className="whitespace-pre-wrap text-sm">{opportunity.notes}</p>
        </div>
      ) : null}

      <div className="space-y-1 text-xs">
        {solicitations.map((s) => (
          <p key={s.id}>
            <span className="text-muted-foreground">Solicitation record: </span>
            {s.title}
            {s.source_document_id ? (
              <>
                {" · "}
                <Link className="underline" href={`/ingestion/verification/${s.source_document_id}`}>
                  source document
                </Link>
              </>
            ) : (
              <span className="text-muted-foreground"> · no source document linked</span>
            )}
          </p>
        ))}
        {provenance ? (
          <p>
            <Badge variant="outline" className="mr-1.5">
              Public listing
            </Badge>
            <span className="text-muted-foreground">Provenance: </span>
            {provenance.provider ?? "unknown provider"}
            {provenance.externalId ? ` · ${provenance.externalId}` : ""}
            {provenance.sourceUrl ? (
              <>
                {" · "}
                <a className="underline" href={provenance.sourceUrl} target="_blank" rel="noreferrer">
                  original notice
                </a>
              </>
            ) : null}
            {provenance.publicSource ? (
              <span className="text-muted-foreground">
                {" · listed buyer "}
                {provenance.publicSource.buyer_name ?? UNKNOWN}
                {" · listed due "}
                {provenance.publicSource.due_on ?? UNKNOWN}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">
            No public-listing provenance on this pursuit — it was created by an operator, not from a public notice.
          </p>
        )}
        {provenance ? (
          <p className="text-muted-foreground">
            Public listing fields are the provider&apos;s words. They are not L&amp;P truth until the solicitation is
            ingested and verified.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function ScopeSection({ bundle }: { bundle: OverviewBundle }) {
  const { requirements, staffing, responseProgress, opportunityId } = bundle;
  const hoursRows = staffing.filter((s) => s.weekly_hours != null && Number(s.weekly_hours) > 0);
  const weeklyHours = hoursRows.reduce((sum, s) => sum + Number(s.weekly_hours), 0);

  return (
    <Section
      id="scope"
      title="Scope and requirements"
      hint="Counts from promoted requirement rows and entered staffing posts only."
      action={
        <Link className="underline" href={tabHref(opportunityId, "/requirements")}>
          Requirements →
        </Link>
      }
    >
      {requirements.total === 0 && staffing.length === 0 ? (
        <EmptyState
          className="py-4"
          title="No scope captured"
          description="No requirement rows and no staffing posts on this pursuit. Ingest and verify the solicitation, then promote requirements."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Field label="Requirements">{requirements.total}</Field>
            <Field label="Mandatory">{requirements.mandatory}</Field>
            <Field label="Scored">{requirements.scored}</Field>
            <Field label="Carrying a source fact">
              {requirements.sourced}
              {requirements.unsourced > 0 ? (
                <span className="text-muted-foreground"> · {requirements.unsourced} unsourced</span>
              ) : null}
            </Field>
            <Field label="Attachment required">{requirements.attachmentRequired}</Field>
            <Field label="Staffing posts">
              {staffing.length}
              {hoursRows.length > 0 ? (
                <span className="text-muted-foreground"> · {weeklyHours} weekly hrs entered</span>
              ) : (
                <span className="text-muted-foreground"> · no hours entered</span>
              )}
            </Field>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            {REQUIREMENT_MATRIX_STATUSES.filter((status) => requirements.byStatus[status] > 0).map((status) => (
              <Badge
                key={status}
                variant={status === "L_AND_P_INPUT_REQUIRED" ? "destructive" : "outline"}
                className="font-normal"
              >
                {REQUIREMENT_STATUS_LABELS[status]}: {requirements.byStatus[status]}
              </Badge>
            ))}
          </div>

          {requirements.formNames.length > 0 ? (
            <p className="text-xs">
              <span className="text-muted-foreground">Named forms on requirements: </span>
              {requirements.formNames.join(", ")}
            </p>
          ) : null}

          {responseProgress ? (
            <p className="text-xs text-muted-foreground">
              Response state: {responseProgress.approved} approved · {responseProgress.drafted} drafted ·{" "}
              {responseProgress.mandatoryOutstanding} mandatory without a draft ·{" "}
              {responseProgress.lpInputRequired} needing an L&amp;P fact.
            </p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function EvaluationSection({ bundle }: { bundle: OverviewBundle }) {
  const { evaluationCriteria, evaluationAudit, evaluationReading, opportunityId } = bundle;

  return (
    <Section
      id="evaluation"
      title="How this is scored"
      hint={evaluationAudit.message}
      action={
        <Link className="underline" href={tabHref(opportunityId, "/requirements")}>
          Edit criteria →
        </Link>
      }
    >
      {evaluationCriteria.length === 0 ? (
        <EmptyState
          className="py-4"
          title="No evaluation criteria recorded"
          description="Extract Section M / bid factors from the solicitation. An empty criteria list is not the same as price-only award."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1 font-normal">Criterion</th>
              <th className="py-1 text-right font-normal">Weight</th>
              <th className="py-1 font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {evaluationCriteria.slice(0, 8).map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-1 pr-2">
                  {c.criterion}
                  {c.notes ? <span className="block text-xs text-muted-foreground">{c.notes}</span> : null}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {c.weight_pct == null ? (
                    <span className="text-muted-foreground">unweighted</span>
                  ) : (
                    `${c.weight_pct}%`
                  )}
                </td>
                <td className="py-1 text-xs text-muted-foreground">
                  {c.source_fact_id ? "verified fact" : "ops-entered"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-medium">Recorded respondent scores</h3>
        {evaluationReading.scores.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No respondent scores recorded. Nothing here states who scored what.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Respondent</th>
                  <th className="py-1 text-right font-normal">Points</th>
                  <th className="py-1 text-right font-normal">Max</th>
                  <th className="py-1 text-right font-normal">Rank</th>
                </tr>
              </thead>
              <tbody>
                {evaluationReading.scores.slice(0, 10).map((s, i) => (
                  <tr key={`${s.respondent_name}-${i}`} className="border-b last:border-0">
                    <td className="py-1 pr-2">
                      {s.respondent_name}
                      {s.isLpMatch ? (
                        <Badge variant="secondary" className="ml-1.5 font-normal">
                          name matches L&amp;P
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-1 text-right tabular-nums">{s.points ?? "—"}</td>
                    <td className="py-1 text-right tabular-nums">
                      {s.max_points ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {s.rank ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground">{evaluationReading.caveat}</p>
          </>
        )}
      </div>
    </Section>
  );
}

function BidDecisionSection({ bundle }: { bundle: OverviewBundle }) {
  const { opportunity, gaps, opportunityId } = bundle;
  const goLabel = GO_NO_GO_OPTIONS.find((g) => g.value === opportunity.go_no_go)?.label ?? opportunity.go_no_go;
  const blocking = gaps.filter((g) => g.severity === "block").length;

  return (
    <Section
      id="bid-decision"
      title="Bid / no-bid"
      hint="A human decision. This platform records it and shows what is missing; it never sets it."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            opportunity.go_no_go === "GO" ? "default" : opportunity.go_no_go === "NO_GO" ? "destructive" : "secondary"
          }
        >
          {goLabel}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {opportunity.go_no_go === "PENDING"
            ? "No decision recorded yet."
            : "Recorded by an operator on the operational metadata form."}
        </span>
        <Link className="text-xs underline" href={`${tabHref(opportunityId)}#operational-metadata`}>
          Change on the metadata form →
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {blocking === 0
          ? "No blocking packet gaps tracked by this workspace remain. Verify source documents before committing."
          : `${blocking} blocking packet gap(s) remain — see Risks and missing information below.`}
      </p>
    </Section>
  );
}

function BuyerIntelligenceSection({ bundle }: { bundle: OverviewBundle }) {
  const { buyer, research, opportunity } = bundle;
  const nothing =
    buyer.otherPursuits.length === 0 &&
    buyer.contracts.length === 0 &&
    buyer.awardCount === 0 &&
    buyer.winLossCount === 0 &&
    research.count === 0;

  return (
    <Section
      id="buyer"
      title="Buyer intelligence"
      hint="Records held about this buyer in our own corpus. Counts of records, never a win rate, market share, or causal claim."
      action={
        <Link className="underline" href="/intelligence/clients">
          Buyer portfolio →
        </Link>
      }
    >
      {!opportunity.client_name ? (
        <EmptyState
          className="py-4"
          title="No buyer linked"
          description="Link a buyer on the operational metadata form before buyer history can be assembled."
        />
      ) : nothing ? (
        <EmptyState
          className="py-4"
          title={`Nothing on file for ${opportunity.client_name}`}
          description="This is the first record we hold for this buyer. Absence of history is not evidence about the buyer."
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Field label="Other pursuits">{buyer.otherPursuits.length}</Field>
            <Field label="Award records">{buyer.awardCount}</Field>
            <Field label="Contracts">{buyer.contracts.length}</Field>
            <Field label="Win/loss reviews">{buyer.winLossCount}</Field>
          </dl>

          {buyer.otherPursuits.length > 0 ? (
            <ul className="space-y-0.5 text-sm">
              {buyer.otherPursuits.slice(0, 5).map((p) => (
                <li key={p.id} className="truncate">
                  <Link className="underline" href={tabHref(p.id)}>
                    {p.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {" · "}
                    {p.stage}
                    {p.response_due_on ? ` · due ${p.response_due_on}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1">
            <h3 className="text-xs font-medium">Public research on this buyer</h3>
            {research.count === 0 ? (
              <p className="text-xs text-muted-foreground">No research facts recorded for this buyer.</p>
            ) : (
              <>
                <ul className="space-y-0.5 text-sm">
                  {research.recent.map((r) => (
                    <li key={r.id} className="truncate">
                      <a className="underline" href={r.source_url} target="_blank" rel="noreferrer">
                        {r.title?.trim() || r.source_url}
                      </a>
                      <Badge
                        variant={r.verification_status === "HUMAN_VERIFIED" ? "default" : "outline"}
                        className="ml-1.5 font-normal"
                      >
                        {r.verification_status}
                      </Badge>
                      {r.published_on ? (
                        <span className="text-xs text-muted-foreground"> · {r.published_on}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {research.count} research fact(s) on file. Status shown is the status stored — public research stays
                  AI_EXTRACTED until a human verifies it.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function CompetitiveIntelligenceSection({ bundle }: { bundle: OverviewBundle }) {
  const { competitorBids, evaluationReading, intel, award, opportunityId } = bundle;
  const nothing =
    competitorBids.length === 0 && evaluationReading.scores.length === 0 && !intel.winLoss && !award;

  return (
    <Section
      id="competitive"
      title="Competitive intelligence"
      hint="Observed on this pursuit only. Sourced quotes and recorded scores — no corporate win rates, no inferred incumbent."
      action={
        <Link className="underline" href="/intelligence/competitors">
          Competitors →
        </Link>
      }
    >
      {nothing ? (
        <EmptyState
          className="py-4"
          title="No competitive evidence on this pursuit"
          description="No sourced competitor bids, no recorded scores, no win/loss review. The incumbent is unknown — it is not inferred."
        />
      ) : (
        <>
          {competitorBids.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Competitor</th>
                  <th className="py-1 text-right font-normal">Quoted</th>
                  <th className="py-1 text-right font-normal">Rank</th>
                  <th className="py-1 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {competitorBids.slice(0, 8).map((b, i) => (
                  <tr key={`${b.name}-${i}`} className="border-b last:border-0">
                    <td className="py-1 pr-2">{b.name}</td>
                    <td className="py-1 text-right tabular-nums">{formatMoney(b.quoted_amount)}</td>
                    <td className="py-1 text-right tabular-nums">
                      {b.rank ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-1 text-xs">
                      {b.source_url ? (
                        <a className="underline" href={b.source_url} target="_blank" rel="noreferrer">
                          link
                        </a>
                      ) : b.source_document_id ? (
                        <Link className="underline" href={`/ingestion/verification/${b.source_document_id}`}>
                          document
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">fact-sourced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">
              No sourced competitor bid amounts on this pursuit. Ingest and verify the bid tab if one was published.
            </p>
          )}

          {evaluationReading.scores.length > 0 ? (
            <p className="text-xs">
              {evaluationReading.scores.length} respondent score(s) recorded — read them in{" "}
              <Link className="underline" href={`${tabHref(opportunityId)}#evaluation`}>
                How this is scored
              </Link>
              . A higher recorded point total is not an award.
            </p>
          ) : null}

          {award ? (
            <div className="space-y-0.5 text-sm">
              <h3 className="text-xs font-medium">Award record on file</h3>
              <p className="text-xs">
                <span className="text-muted-foreground">Notice: </span>
                {award.notice?.trim() || UNKNOWN}
                {" · "}
                <span className="text-muted-foreground">Awarded on: </span>
                {award.awarded_on ?? UNKNOWN}
                {" · "}
                <span className="text-muted-foreground">Winner: </span>
                {award.winner_name?.trim() || UNKNOWN}
                {award.source_document_id ? (
                  <>
                    {" · "}
                    <Link className="underline" href={`/ingestion/verification/${award.source_document_id}`}>
                      source document
                    </Link>
                  </>
                ) : null}
              </p>
              {!award.winner_name ? (
                <p className="text-xs text-muted-foreground">
                  The award record names no winner. The awardee and the incumbent stay unknown — neither is inferred
                  from scores or amounts.
                </p>
              ) : null}
            </div>
          ) : null}

          {intel.winLoss ? (
            <div className="space-y-0.5 text-sm">
              <h3 className="text-xs font-medium">Win / loss record</h3>
              <p>Outcome: {intel.winLoss.outcome}</p>
              {intel.winLoss.winner_name ? <p>Winner: {intel.winLoss.winner_name}</p> : null}
              {intel.winLoss.documented_reason ? (
                <p className="text-xs">Documented reason: {intel.winLoss.documented_reason}</p>
              ) : null}
              {intel.winLoss.internal_analysis ? (
                <p className="text-xs text-muted-foreground">
                  Internal analysis (not the buyer&apos;s words): {intel.winLoss.internal_analysis}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No win/loss review promoted for this pursuit — the awardee is not recorded here.{" "}
              <Link className="underline" href={tabHref(opportunityId, "/result")}>
                Capture the result
              </Link>
              .
            </p>
          )}

          {intel.awardNte != null ? (
            <p className="text-xs">
              <span className="text-muted-foreground">Award NTE on file: </span>
              {formatMoney(intel.awardNte)}
            </p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function PriorExperienceSection({ bundle }: { bundle: OverviewBundle }) {
  const { priorExperience, buyer } = bundle;
  const nothing =
    priorExperience.sameBuyerContracts.length === 0 && priorExperience.sameServicePursuits.length === 0;

  return (
    <Section
      id="prior-experience"
      title="Prior L&P experience"
      hint="Contracts held with this buyer and other pursuits with the same recorded service type. Not a capability claim."
      action={
        <Link className="underline" href="/contracts">
          Contracts →
        </Link>
      }
    >
      {nothing ? (
        <EmptyState
          className="py-4"
          title="No comparable L&P record found"
          description={
            priorExperience.serviceType
              ? `No contracts with this buyer and no other pursuit recorded as “${priorExperience.serviceType}”.`
              : "No contracts with this buyer. Service type is not recorded on this pursuit, so similar pursuits cannot be matched."
          }
        />
      ) : (
        <>
          {priorExperience.sameBuyerContracts.length > 0 ? (
            <div className="space-y-1">
              <h3 className="text-xs font-medium">Contracts with {buyer.name ?? "this buyer"}</h3>
              <ul className="space-y-0.5 text-sm">
                {priorExperience.sameBuyerContracts.slice(0, 5).map((c) => (
                  <li key={c.id} className="truncate">
                    <Link className="underline" href={`/contracts/${c.id}`}>
                      {c.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {c.contract_number ? ` · ${c.contract_number}` : ""}
                      {c.verified_end_on ? ` · ends ${c.verified_end_on}` : " · end date not verified"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {priorExperience.sameServicePursuits.length > 0 ? (
            <div className="space-y-1">
              <h3 className="text-xs font-medium">
                Other pursuits recorded as “{priorExperience.serviceType}”
              </h3>
              <ul className="space-y-0.5 text-sm">
                {priorExperience.sameServicePursuits.map((p) => (
                  <li key={p.id} className="truncate">
                    <Link className="underline" href={tabHref(p.id)}>
                      {p.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.client_name ? ` · ${p.client_name}` : ""} · {p.stage}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

function ComplianceReadinessSection({ bundle }: { bundle: OverviewBundle }) {
  const { compliance, requirements, opportunityId, linkedContractId } = bundle;

  return (
    <Section
      id="compliance"
      title="Compliance readiness"
      hint={compliance.message}
      action={
        linkedContractId ? (
          <Link className="underline" href={`/contracts/${linkedContractId}`}>
            Contract →
          </Link>
        ) : (
          <Link className="underline" href={tabHref(opportunityId, "/submission")}>
            Submission packet →
          </Link>
        )
      }
    >
      {compliance.mode === "NO_CONTRACT_LINKED" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-normal">
              Verified: unknown
            </Badge>
            <Badge variant="secondary" className="font-normal">
              Expiring: unknown
            </Badge>
            <Badge variant="secondary" className="font-normal">
              Missing: unknown
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Unknown is the honest answer here — this workspace holds no insurance, license, or certification records
            for a pre-award pursuit. What it can show is the paperwork the solicitation asks for:{" "}
            {requirements.attachmentRequired} requirement(s) need an attachment
            {requirements.formNames.length > 0 ? ` and ${requirements.formNames.length} named form(s) appear` : ""}.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" className="font-normal">
              Verified: {compliance.buckets.verified}
            </Badge>
            <Badge variant="outline" className="font-normal">
              Expiring: {compliance.buckets.expiring}
            </Badge>
            <Badge variant="destructive" className="font-normal">
              Missing: {compliance.buckets.missing}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              Unknown: {compliance.buckets.unknown}
            </Badge>
          </div>
          {compliance.items.length > 0 ? (
            <ul className="space-y-0.5 text-sm">
              {compliance.items.slice(0, 6).map((item) => (
                <li key={item.id} className="truncate">
                  <span className="text-xs uppercase text-muted-foreground">{item.kind}</span> {item.statement}
                  <span className="text-xs text-muted-foreground">
                    {item.expires_on ? ` · expires ${item.expires_on}` : " · no expiry recorded"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Section>
  );
}

function RisksSection({ bundle }: { bundle: OverviewBundle }) {
  const { gaps, requirements, responseProgress, unverifiedFactCount, conflictFactCount, opportunityId } = bundle;
  const blocking = gaps.filter((g) => g.severity === "block");
  const warnings = gaps.filter((g) => g.severity === "warn");
  const lpInput = Math.max(
    requirements.byStatus.L_AND_P_INPUT_REQUIRED,
    responseProgress?.lpInputRequired ?? 0,
  );
  const clean =
    blocking.length === 0 &&
    warnings.length === 0 &&
    lpInput === 0 &&
    conflictFactCount === 0 &&
    unverifiedFactCount === 0;

  return (
    <Section
      id="risks"
      title="Risks and missing information"
      hint="Generated from blank fields, unresolved statuses, and unverified facts. It never invents a date, rate, or competitor number."
    >
      {clean ? (
        <EmptyState
          className="py-4"
          title="Nothing outstanding in what this workspace tracks"
          description="Packet fields are filled, no requirement needs an L&P fact, and no staged or conflicting facts remain. Still read the source documents before submitting."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1">
            <h3 className="text-xs font-medium">Blocking ({blocking.length})</h3>
            {blocking.length === 0 ? (
              <p className="text-xs text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {blocking.map((g) => (
                  <li key={g.id}>
                    <Link className="underline" href={gapHref(opportunityId, g.hrefSuffix)}>
                      {g.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-medium">Check ({warnings.length})</h3>
            {warnings.length === 0 ? (
              <p className="text-xs text-muted-foreground">None.</p>
            ) : (
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {warnings.map((g) => (
                  <li key={g.id}>
                    <Link className="underline" href={gapHref(opportunityId, g.hrefSuffix)}>
                      {g.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1 lg:col-span-2">
            <h3 className="text-xs font-medium">Evidence state</h3>
            <ul className="space-y-0.5 text-sm">
              {lpInput > 0 ? (
                <li>
                  <Link className="underline" href={tabHref(opportunityId, "/requirements")}>
                    {lpInput} requirement(s) marked L&amp;P INPUT REQUIRED
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    — the answer does not exist in the corpus and must not be drafted from nothing.
                  </span>
                </li>
              ) : null}
              {conflictFactCount > 0 ? (
                <li>
                  <Link className="underline" href="/ingestion/exceptions">
                    {conflictFactCount} conflicting extracted fact(s)
                  </Link>
                  <span className="text-xs text-muted-foreground"> — resolve before relying on either value.</span>
                </li>
              ) : null}
              {unverifiedFactCount > 0 ? (
                <li>
                  <Link className="underline" href="/ingestion/verification">
                    {unverifiedFactCount} extracted fact(s) still awaiting human verification
                  </Link>
                  <span className="text-xs text-muted-foreground"> — staged, not canonical.</span>
                </li>
              ) : null}
              {requirements.unsourced > 0 ? (
                <li className="text-muted-foreground">
                  {requirements.unsourced} requirement(s) carry no source fact.
                </li>
              ) : null}
              {lpInput === 0 && conflictFactCount === 0 && unverifiedFactCount === 0 && requirements.unsourced === 0 ? (
                <li className="text-muted-foreground">No unresolved evidence issues.</li>
              ) : null}
            </ul>
          </div>
        </div>
      )}
    </Section>
  );
}

function BidStrategySection({ bundle }: { bundle: OverviewBundle }) {
  const { bidStrategy, narrativeError } = bundle;

  return (
    <Section
      id="bid-strategy"
      title="Bid strategy (evidence-backed)"
      hint="Assembled from this pursuit's own records. Every bullet carries a citation you can open. No win themes, probabilities, market share, or causal claims are generated."
    >
      {bidStrategy.status === "INSUFFICIENT" ? (
        <EmptyState
          className="py-4"
          title="Insufficient verified evidence for a bid strategy"
          description={bidStrategy.reason ?? undefined}
        />
      ) : (
        <ul className="space-y-1.5 text-sm">
          {bidStrategy.bullets.map((bullet) => (
            <li key={bullet.id} className="border-l-2 pl-2">
              <p>{bullet.text}</p>
              <p className="text-xs text-muted-foreground">
                {bullet.citations.map((c, i) => (
                  <span key={`${bullet.id}-cite-${i}`}>
                    {i > 0 ? " · " : ""}
                    {c.href ? (
                      c.href.startsWith("http") ? (
                        <a className="underline" href={c.href} target="_blank" rel="noreferrer">
                          {c.label}
                        </a>
                      ) : (
                        <Link className="underline" href={c.href}>
                          {c.label}
                        </Link>
                      )
                    ) : (
                      c.label
                    )}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}

      {bidStrategy.withheld.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium">Withheld for lack of evidence</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {bidStrategy.withheld.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {narrativeError ? (
        <p className="text-xs text-destructive">
          Verified-passage retrieval failed ({narrativeError}). Narrative citations are missing, not empty.
        </p>
      ) : null}
    </Section>
  );
}

function NextActionsSection({ bundle }: { bundle: OverviewBundle }) {
  const { nextActions, opportunityId } = bundle;

  return (
    <Section
      id="next-actions"
      title="Next actions"
      hint="Derived from what is actually missing. A satisfied step produces no action."
    >
      {nextActions.length === 0 ? (
        <EmptyState
          className="py-4"
          title="No outstanding step in the tracked workflow"
          description="Documents, requirements, evaluation criteria, pricing, response, submission, and result all have records."
        />
      ) : (
        <ol className="space-y-1 text-sm">
          {nextActions.map((action, index) => (
            <li key={action.id}>
              <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
              <Link className="underline" href={action.href}>
                {action.label}
              </Link>
              <span className="text-xs text-muted-foreground"> — {action.reason}</span>
            </li>
          ))}
        </ol>
      )}
      <nav className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-xs" aria-label="Pursuit workflow">
        <Link className="underline" href={tabHref(opportunityId, "/requirements")}>
          Requirements
        </Link>
        <Link className="underline" href={tabHref(opportunityId, "/pricing")}>
          Pricing
        </Link>
        <Link className="underline" href={tabHref(opportunityId, "/response")}>
          Response
        </Link>
        <Link className="underline" href={tabHref(opportunityId, "/submission")}>
          Submission
        </Link>
        <Link className="underline" href="/ingestion/verification">
          Verification
        </Link>
        <Link className="underline" href={tabHref(opportunityId, "/result")}>
          Result
        </Link>
      </nav>
    </Section>
  );
}
