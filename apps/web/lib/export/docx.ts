/**
 * Native OOXML (.docx) export via the `docx` package.
 * Never renames HTML to .docx.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { AssembledProposal } from "@/lib/opportunity/proposal-assembly";
import { escapeDocxText } from "@/lib/opportunity/proposal-assembly";

/**
 * Detect simple markdown-ish pipe tables in plain text and emit an OOXML table.
 * Non-table lines stay paragraphs.
 */
function blocksFromPlain(text: string): (Paragraph | Table)[] {
  const lines = escapeDocxText(text).split(/\n/);
  const out: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.includes("|") && lines[i + 1]?.match(/^\s*\|?[\s-:|]+$/)) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").includes("|")) {
        const raw = lines[i]!;
        if (/^\s*\|?[\s-:|]+$/.test(raw)) {
          i += 1;
          continue;
        }
        const cells = raw
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
        // Fix filter: keep empty middle cells; only drop leading/trailing empties from split.
        const parts = raw.split("|").map((c) => c.trim());
        if (parts[0] === "") parts.shift();
        if (parts.length && parts[parts.length - 1] === "") parts.pop();
        rows.push(parts.length ? parts : cells);
        i += 1;
      }
      if (rows.length > 0) {
        const colCount = Math.max(...rows.map((r) => r.length), 1);
        out.push(
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            rows: rows.map(
              (row) =>
                new TableRow({
                  children: Array.from({ length: colCount }, (_, ci) => {
                    const cellText = row[ci] ?? "";
                    return new TableCell({
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
                      },
                      width: { size: Math.floor(9360 / colCount), type: WidthType.DXA },
                      children: [new Paragraph({ children: [new TextRun(cellText)] })],
                    });
                  }),
                }),
            ),
          }),
        );
      }
      continue;
    }
    out.push(
      new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 80 },
      }),
    );
    i += 1;
  }
  return out;
}

/** Build a real .docx (PK zip / OOXML) buffer from an assembled proposal. */
export async function buildProposalDocx(assembled: AssembledProposal): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: escapeDocxText(assembled.title), bold: true })],
      spacing: { after: 240 },
    }),
  ];

  for (const section of assembled.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(escapeDocxText(section.title))],
        spacing: { before: 240, after: 120 },
      }),
    );
    children.push(...blocksFromPlain(section.plainText));
  }

  const doc = new Document({
    creator: "Contract Intelligence Platform",
    title: assembled.title,
    description: `Working proposal hash ${assembled.contentHash.slice(0, 12)}`,
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

/** OOXML packages are ZIP files; signature is PK\\x03\\x04. */
export function isOoxmlZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}
