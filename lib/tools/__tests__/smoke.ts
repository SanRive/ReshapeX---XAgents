import path from "path";
import { cargarCorpus } from "../corpus-index";
import { buscar_catalogo } from "../search-catalog";

const corpusRoot = path.join(process.cwd(), "corpus_txt");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FALLO: ${msg}`);
  console.log(`OK: ${msg}`);
}

const chunks = cargarCorpus(corpusRoot);
assert(chunks.length > 1000, `cargarCorpus() devuelve > 1000 chunks (obtuvo ${chunks.length})`);

const conMatch = buscar_catalogo("DTS 3145 capacidad btu voltaje", { corpusRoot });
assert(conMatch.length >= 1, `buscar_catalogo() con query real devuelve >= 1 resultado (obtuvo ${conMatch.length})`);
assert(
  conMatch.every((r) => r.documento !== undefined && r.pagina !== undefined),
  "todos los resultados tienen documento y pagina definidos"
);

const sinMatch = buscar_catalogo("xyz123 no existe esto", { corpusRoot });
assert(
  Array.isArray(sinMatch) && sinMatch.length === 0,
  `buscar_catalogo() con query sin match devuelve array vacio (obtuvo ${sinMatch.length})`
);

console.log("\nTodos los smoke tests pasaron.");
