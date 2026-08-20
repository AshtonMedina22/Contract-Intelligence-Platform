"use client";

type Cell = {
  sheet: string;
  coordinate: string;
  display_value?: string | null;
  cached_value?: string | null;
  formula?: string | null;
};

type Sheet = {
  name: string;
  cells: Cell[];
};

type Props = {
  sheets: Sheet[];
  activeSection: string | null;
};

function cellKey(sheet: string, coordinate: string) {
  return `${sheet}!${coordinate}`;
}

export function XlsxSourcePane({ sheets, activeSection }: Props) {
  if (sheets.length === 0) {
    return <p className="text-sm text-muted-foreground">No workbook structure on this extraction run.</p>;
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-auto">
      {sheets.map((sheet) => {
        const rows = new Map<number, Map<string, Cell>>();
        for (const cell of sheet.cells) {
          const row = Number(cell.coordinate.replace(/^[A-Z]+/i, ""));
          const col = cell.coordinate.replace(/[0-9]+/g, "");
          if (!rows.has(row)) rows.set(row, new Map());
          rows.get(row)?.set(col, cell);
        }
        const rowNums = [...rows.keys()].sort((a, b) => a - b).slice(0, 80);
        const cols = new Set<string>();
        for (const map of rows.values()) {
          for (const col of map.keys()) cols.add(col);
        }
        const colList = [...cols].sort();

        return (
          <div key={sheet.name}>
            <p className="mb-1 text-xs font-medium">{sheet.name}</p>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {rowNums.map((row) => (
                  <tr key={row}>
                    {colList.map((col) => {
                      const cell = rows.get(row)?.get(col);
                      const key = cell ? cellKey(sheet.name, cell.coordinate) : "";
                      const active = Boolean(activeSection && key === activeSection);
                      const value = cell?.display_value ?? cell?.cached_value ?? cell?.formula ?? "";
                      return (
                        <td
                          key={`${row}-${col}`}
                          className={`border px-1 py-0.5 ${active ? "bg-yellow-200 ring-2 ring-yellow-500 dark:bg-yellow-900" : ""}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
