import { tool } from "ai";
import { z } from "zod";
import { explicarVeredicto, guiaDeCampo } from "./explain";
import { lookupModelo } from "./model-specs";
import { buscarCatalogo } from "./search-catalog";

export const buscarCatalogoTool = tool({
  description: "Busca fragmentos técnicos dentro del corpus autorizado de Pfannenberg.",
  inputSchema: z.object({
    query: z.string().min(2).max(300),
    limit: z.number().int().min(1).max(10).optional(),
  }),
  execute: async ({ query, limit }) => buscarCatalogo(query, limit === undefined ? {} : { limit }),
});

export const specsModeloTool = tool({
  description: "Consulta especificaciones técnicas documentadas de una serie de Cooling Unit.",
  inputSchema: z.object({ modelo: z.string().min(2).max(100) }),
  execute: async ({ modelo }) => lookupModelo(modelo),
});

export const explicarVeredictoTool = tool({
  description: "Explica con reglas y citas una familia de tecnología; sin datos de proyecto devuelve una descripción general.",
  inputSchema: z.object({ familia: z.string().min(2).max(100) }),
  execute: async ({ familia }) => explicarVeredicto(familia),
});

export const guiaDeCampoTool = tool({
  description: "Devuelve la guía determinista y citada para conseguir un campo bloqueante.",
  inputSchema: z.object({ campo: z.string().min(2).max(100) }),
  execute: async ({ campo }) => guiaDeCampo(campo),
});

export const engineeringCopilotTools = {
  buscar_catalogo: buscarCatalogoTool,
  specs_modelo: specsModeloTool,
  explicar_veredicto: explicarVeredictoTool,
  guia_de_campo: guiaDeCampoTool,
} as const;
