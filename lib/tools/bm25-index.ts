/**
 * corpus-index.ts (C1)
 *
 * Carga solo los archivos en SCOPED_FILES (scope-config.ts) y los
 * trocea en chunks con {documento, pagina, categoria}. No indexa los
 * ~104 archivos totales del corpus: mete señalización y chillers de
 * proceso en el retrieval y arruina la precisión.
 *
 * Formato de entrada: .txt generados con `pdftotext -layout`, donde
 * el salto de página es un form feed (\f, 0x0C). Confirmado contra
 * el MANIFEST.md del corpus real (ej. Flyer_X_Series_PSA.txt: 2
 * páginas → split('\f') da 3 elementos, el último vacío).
 */

import fs from "fs";
import path from "path";
import { SCOPED_FILES, type ScopedFile } from "./scope-config";

export interface Chunk {
  id: string;
  texto: string;
  documento: string;   // path relativo, ej. "Pfanember/COOLING UNITS/DTS_2017.txt"
  pagina: number;       // 1-indexed
  categoria: ScopedFile["categoria"];
}

const FORM_FEED = "\f";

/** Normaliza espacios y saltos de línea de pdftotext -layout sin destruir la estructura de tablas de golpe. */
function limpiarTexto(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")   // espacios colgantes al final de línea
    .replace(/\n{3,}/g, "\n\n")   // colapsa más de 2 saltos seguidos
    .trim();
}

/** Corta el texto de una página en chunks manejables, por párrafo, con fallback a corte por palabras si un párrafo es enorme (típico en tablas largas de specs). */
function chunkearPagina(pageText: string, maxChars = 1400): string[] {
  const limpio = limpiarTexto(pageText);
  if (!limpio) return [];

  const parrafos = limpio.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of parrafos) {
    if (p.length > maxChars) {
      // párrafo/tabla gigante: si hay buffer pendiente, lo cerramos primero
      if (buffer) {
        chunks.push(buffer.trim());
        buffer = "";
      }
      // corte duro por palabras, respetando maxChars
      const palabras = p.split(/\s+/);
      let sub = "";
      for (const w of palabras) {
        if ((sub + " " + w).length > maxChars) {
          chunks.push(sub.trim());
          sub = w;
        } else {
          sub += " " + w;
        }
      }
      if (sub.trim()) chunks.push(sub.trim());
      continue;
    }

    if ((buffer + "\n\n" + p).length > maxChars) {
      if (buffer) chunks.push(buffer.trim());
      buffer = p;
    } else {
      buffer = buffer ? buffer + "\n\n" + p : p;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks.filter((c) => c.length > 30); // descarta ruido (headers sueltos, etc.)
}

/**
 * Resuelve la ruta real de un archivo en disco, tolerando que el nombre
 * esperado y el nombre real difieran solo en forma de normalización Unicode
 * (NFC vs NFD) — típico de una extracción de zip hecha en otro SO. Si el
 * path exacto no existe, busca en el directorio contenedor una entrada cuyo
 * nombre normalizado en NFC coincida con el nombre esperado normalizado en
 * NFC.
 */
function resolverRutaReal(corpusRoot: string, relPath: string): string | null {
  const fullPath = path.join(corpusRoot, relPath);
  if (fs.existsSync(fullPath)) return fullPath;

  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) return null;

  const nombreEsperado = path.basename(relPath).normalize("NFC");
  const entradas = fs.readdirSync(dir);
  const match = entradas.find((entrada) => entrada.normalize("NFC") === nombreEsperado);

  return match ? path.join(dir, match) : null;
}

/** Carga y trocea un único archivo en alcance. */
function indexarArchivo(corpusRoot: string, file: ScopedFile): Chunk[] {
  const fullPath = resolverRutaReal(corpusRoot, file.path);
  if (!fullPath) {
    console.warn(`[corpus-index] archivo en alcance pero no encontrado en disco: ${file.path}`);
    return [];
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const paginas = raw.split(FORM_FEED);

  const chunks: Chunk[] = [];
  paginas.forEach((pageText, idx) => {
    const numPagina = idx + 1; // 1-indexed
    const trozos = chunkearPagina(pageText);
    trozos.forEach((texto, i) => {
      chunks.push({
        id: `${file.path}::p${numPagina}::c${i}`,
        texto,
        documento: file.path,
        pagina: numPagina,
        categoria: file.categoria,
      });
    });
  });

  return chunks;
}

let _cache: Chunk[] | null = null;

/**
 * Punto de entrada de C1. Devuelve todos los chunks del corpus en
 * alcance, con su procedencia. Cachea en memoria — no hay razón para
 * re-leer disco en cada query durante el sprint.
 */
export function cargarCorpus(corpusRoot: string, forzarRecarga = false): Chunk[] {
  if (_cache && !forzarRecarga) return _cache;

  const chunks: Chunk[] = [];
  for (const file of SCOPED_FILES) {
    chunks.push(...indexarArchivo(corpusRoot, file));
  }

  if (chunks.length === 0) {
    throw new Error(
      `[corpus-index] no se cargó ningún chunk. Verifica que corpusRoot ("${corpusRoot}") apunte a la carpeta que contiene los .txt del corpus.`
    );
  }

  _cache = chunks;
  return chunks;
}