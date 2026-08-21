/**
 * Parse F23A Exact Public Source URL Registry into seed records.
 * Never invents URLs — only extracts https? links from the seed file.
 */

import { createHash } from "node:crypto";
import { classifyCorpusRole } from "./classify-role";
import type { RegistrySeedRecord, SourceAuthority } from "./types";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

export function urlHash(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash("sha256").update(normalized).digest("hex");
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/[.,;:!?)\]>]+$/g, "");
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

type SectionState = {
  section: string;
  seedCounter: number;
};

function inferTitleNearUrl(lines: string[], urlLineIndex: number, url: string): string {
  for (let i = urlLineIndex; i >= Math.max(0, urlLineIndex - 3); i -= 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line || line === url || /^https?:/i.test(line)) continue;
    if (/^={3,}/.test(line) || /^[A-Z]\.\s/.test(line)) continue;
    const cleaned = line
      .replace(/^\d+\.\s*/, "")
      .replace(/^[-*]\s*/, "")
      .trim();
    if (cleaned.length > 8) return cleaned.slice(0, 240);
  }
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
  } catch {
    return url;
  }
}

function inferBuyer(title: string, url: string, section: string): string | null {
  const hay = `${title} ${url} ${section}`;
  const known: Array<[RegExp, string]> = [
    [/TxDMV|txdmv/i, "Texas Department of Motor Vehicles"],
    [/Allen\s*ISD/i, "Allen ISD"],
    [/Williamson/i, "Williamson County"],
    [/Jefferson/i, "Jefferson County"],
    [/Mesquite\s*ISD/i, "Mesquite ISD"],
    [/Lancaster\s*ISD/i, "Lancaster ISD"],
    [/TxDOT|texas\.gov.*[Bb]id/i, "Texas Department of Transportation"],
    [/DPS|tops\.portal|dps\.texas/i, "Texas Department of Public Safety"],
    [/SAM\.gov|sam\.gov/i, "Federal (SAM.gov)"],
    [/USAspending|usaspending/i, "Federal (USAspending)"],
    [/GSA|gsaelibrary/i, "GSA"],
    [/ESBD|txsmartbuy/i, "State of Texas (ESBD/SmartBuy)"],
  ];
  for (const [re, name] of known) {
    if (re.test(hay)) return name;
  }
  return null;
}

/**
 * Parse the F23A registry text. Section C seeds are preferred for download;
 * all https URLs across sections are returned with section labels.
 */
export function parseRegistryText(text: string): RegistrySeedRecord[] {
  const lines = text.split(/\r?\n/);
  const state: SectionState = { section: "PREAMBLE", seedCounter: 0 };
  const seen = new Set<string>();
  const out: RegistrySeedRecord[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const sectionMatch = line.match(/^([A-H])\.\s+(.+)$/);
    if (sectionMatch) {
      state.section = `${sectionMatch[1]}. ${sectionMatch[2].trim()}`;
      continue;
    }
    if (/^={3,}/.test(line.trim())) continue;

    const matches = line.match(URL_RE);
    if (!matches) continue;

    for (const raw of matches) {
      const url = normalizeUrl(raw);
      const hash = urlHash(url);
      if (seen.has(hash)) continue;
      seen.add(hash);

      state.seedCounter += 1;
      const title = inferTitleNearUrl(lines, i, url);
      const buyerName = inferBuyer(title, url, state.section);
      const classified = classifyCorpusRole({ url, title, buyerName });
      const downloadableHint =
        /\.(pdf|docx?|xlsx?|xls)(\?|$)/i.test(url) ||
        /ftp\.txdmv\.gov|granicus\.com\/uploads|destinyhosted\.com|thrillshare\.com|dps\.texas\.gov\/sites\/default\/files/i.test(
          url,
        );

      // Section A/B portal roots are usually LINK_ONLY discovery surfaces.
      let authorityHint: SourceAuthority | null = classified.sourceAuthority;
      let roleHint = classified.corpusRole;
      if (/^[AB]\./.test(state.section) && !downloadableHint) {
        authorityHint = 2;
        if (roleHint === "L_AND_P_DIRECT") roleHint = "REFERENCE_DATA";
      }

      out.push({
        seedId: `F23A-${state.section.slice(0, 1)}-${String(state.seedCounter).padStart(3, "0")}`,
        section: state.section,
        url,
        title,
        buyerName,
        solicitationHints: {},
        roleHint,
        authorityHint,
        downloadableHint,
      });
    }
  }

  return out;
}

/** Section C downloadable-focused subset (plus any seed with downloadableHint). */
export function sectionCDownloadableSeeds(seeds: RegistrySeedRecord[]): RegistrySeedRecord[] {
  return seeds.filter(
    (s) =>
      s.section.startsWith("C.") ||
      (s.downloadableHint && (s.section.startsWith("B.") || s.section.startsWith("C."))),
  );
}

export function parseRegistryFileContents(contents: string): RegistrySeedRecord[] {
  return parseRegistryText(contents);
}
