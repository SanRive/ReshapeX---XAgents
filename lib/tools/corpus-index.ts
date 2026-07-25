import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

export type CorpusChunk = {
  id: string;
  documento: string;
  ruta: string;
  pagina: number;
  texto: string;
  textoNormalizado: string;
  tokens: string[];
};

const CORPUS_ROOT = resolve(process.cwd(), "corpus_txt");
const TARGET_CHARS = 1_100;
const MAX_CHARS = 1_500;
const OVERLAP_PARAGRAPHS = 1;

/** Explicit allow-list: callers can never supply a path. */
export const ALLOWED_CORPUS_PATHS = [
  "DownloadCentre/CompactCatalogue/Pfannenberg_Compact_catalogue_30_en.txt",
  "DownloadCentre/ThermalManagement/DTT_2015eng.txt",
  "DownloadCentre/ThermalManagement/Flyer_EN_DTFS.txt",
  "DownloadCentre/ThermalManagement/Flyer_Green_Series_ENG.txt",
  "DownloadCentre/ThermalManagement/Pfannenberg_Brochure_Filterfans_en.txt",
  "DownloadCentre/ThermalManagement/Pfannenberg_Brochure_Outdoor_Cooling_Units_DTS3000_EN.txt",
  "DownloadCentre/ThermalManagement/Pfannenberg_Cut-out_compatibility_list_thermal_management_side_mounted_units.txt",
  "DownloadCentre/ThermalManagement/Pfannenberg_Filtermattenflyer_en.txt",
  "DownloadCentre/ThermalManagement/ecool_folder_eng.txt",
  "Pfanember/CATALOGS/Catalog_InsidePages_Master__Final_2025.txt",
  "Pfanember/CATALOGS/Thermal_Management_Catalog_12_Page-Final_2024.txt",
  "Pfanember/COOLING UNITS/ActivCool_DTS_5000_Flyer.txt",
  "Pfanember/COOLING UNITS/DTS_2017.txt",
  "Pfanember/COOLING UNITS/DTT_Flyer_USA_072016.txt",
  "Pfanember/COOLING UNITS/Flyer_Green_Series_PSA_FINAL.txt",
  "Pfanember/COOLING UNITS/Flyer_X_Series_PSA.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/180417_Broschu╠_re_Filterlu╠_fter_ENG_RZ.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/2017_Rainhoods_Product_Launch_Flyer.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/Datawind_Filterfan_Rev1_lowres.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/Flyer_PTF_1200_and_3R.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/Outdoor_Filterfan_Sales_flyer.txt",
  "Pfanember/FILTERFANS + ACCESSORIES/PFH_Flyer_Final.txt",
  "Pfanember/HEAT EXCHANGERS/PKS_Brochure_Update_2026_Final.txt",
  "Pfanember/HEAT EXCHANGERS/WaterCooledGuide_Updated_0819.txt",
  "PSS Tutorial/PSS-Tutorial.txt",
  "PSS Tutorial/Pfannenberg-Support-Center.txt",
] as const;

let cachedIndex: CorpusChunk[] | null = null;

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(?:nema|type)\s*(4x|4|3r|12)\b/g, "$1")
    .replace(/\bwash[\s-]+down\b/g, "washdown")
    .replace(/\bair\s*[/\\-]\s*(water|air)\b/g, "air $1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function singularize(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(value: string): string[] {
  return normalizeText(value).split(" ").filter(Boolean).map(singularize);
}

function safeAbsolutePath(relativePath: string): string {
  const absolute = resolve(CORPUS_ROOT, ...relativePath.split("/"));
  if (!absolute.startsWith(`${CORPUS_ROOT}${sep}`)) {
    throw new Error(`Corpus path escapes root: ${relativePath}`);
  }
  return absolute;
}

function paragraphUnits(page: string): string[] {
  const normalizedLines = page.replace(/\r/g, "").split("\n").map((line) => line.trimEnd());
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of normalizedLines) {
    if (line.trim() === "") {
      if (current.length) paragraphs.push(current.join("\n").trim());
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) paragraphs.push(current.join("\n").trim());
  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= MAX_CHARS) return [paragraph];
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    if (sentences.length === 1) {
      return paragraph.match(new RegExp(`.{1,${MAX_CHARS}}(?:\\s|$)`, "gs"))?.map((part) => part.trim()) ?? [];
    }
    return sentences;
  }).filter(Boolean);
}

function chunkPage(page: string): string[] {
  const units = paragraphUnits(page);
  const chunks: string[] = [];
  let group: string[] = [];
  for (const unit of units) {
    const candidate = [...group, unit].join("\n\n");
    if (group.length && candidate.length > TARGET_CHARS) {
      chunks.push(group.join("\n\n"));
      group = group.slice(-OVERLAP_PARAGRAPHS);
    }
    group.push(unit);
  }
  if (group.length) chunks.push(group.join("\n\n"));
  return chunks;
}

function sourceDocument(relativePath: string): string {
  return `${relativePath.slice(0, -4)}.pdf`;
}

function chunkId(relativePath: string, page: number, text: string): string {
  return createHash("sha256")
    .update(`${relativePath}\0${page}\0${normalizeText(text)}`)
    .digest("hex")
    .slice(0, 24);
}

export function buildCorpusIndex(): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  const seen = new Set<string>();
  for (const relativePath of ALLOWED_CORPUS_PATHS) {
    const absolutePath = safeAbsolutePath(relativePath);
    const raw = readFileSync(absolutePath, "utf8");
    const pages = raw.includes("\f") ? raw.split("\f") : [raw];
    pages.forEach((page, pageIndex) => {
      for (const text of chunkPage(page)) {
        const texto = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (!texto) continue;
        const id = chunkId(relativePath, pageIndex + 1, texto);
        if (seen.has(id)) continue;
        seen.add(id);
        chunks.push({
          id,
          documento: sourceDocument(relativePath),
          ruta: relative(CORPUS_ROOT, absolutePath).split(sep).join("/"),
          pagina: pageIndex + 1,
          texto,
          textoNormalizado: normalizeText(texto),
          tokens: tokenize(texto),
        });
      }
    });
  }
  return chunks;
}

export function getCorpusIndex(): CorpusChunk[] {
  cachedIndex ??= buildCorpusIndex();
  return cachedIndex;
}

export function getIndexedDocuments(): string[] {
  return [...new Set(getCorpusIndex().map((chunk) => chunk.documento))].sort();
}

export function clearCorpusIndexCache(): void {
  cachedIndex = null;
}

export function corpusDocumentName(path: string): string {
  return basename(path, ".pdf");
}

export function corpusDocumentDirectory(path: string): string {
  return dirname(path);
}
