import { loadContractChanges } from "@/lib/contracts/load-workspace";

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default async function ContractChangesPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const { amendments, options } = await loadContractChanges(contractId);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Amendments / modifications / change orders</h2>
          <p className="text-sm text-muted-foreground">
            Verified change history only. Historical rows are never overwritten by later promotions.
          </p>
        </div>
        {amendments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Effective</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {amendments.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{dash(row.amendment_number)}</td>
                    <td className="py-2 pr-3">{dash(row.title)}</td>
                    <td className="py-2 pr-3">{dash(row.effective_on)}</td>
                    <td className="py-2">{dash(row.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Option exercises (on file)</h2>
          <p className="text-sm text-muted-foreground">
            Listed from verified option rows only — exercised vs remaining is not assumed.
          </p>
        </div>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {options.map((row) => (
              <li key={row.id}>
                {row.label}
                {row.exercise_by ? ` · exercise by ${row.exercise_by}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
