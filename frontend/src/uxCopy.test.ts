/// <reference types="node" />

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function collectVisibleSources(directory: string): Record<string, string> {
  const sources: Record<string, string> = {};

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(sources, collectVisibleSources(path));
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      sources[path] = readFileSync(path, "utf8");
    }
  }

  return sources;
}

const visibleSources = collectVisibleSources(
  dirname(fileURLToPath(import.meta.url)),
);

const forbiddenPhrases = [
  "Permisos controlados por el backend",
  "No podrá crear, modificar ni eliminar",
  "El backend valida",
  "conectados a API",
  "Usuario interno identificado",
  "Agente local no detectado",
  "El sistema no inventará",
  "proviene del backend",
  "flujo controlado",
  "sesión profesional de escaneo",
  "usuario autenticado",
  "se generan de forma automática y auditable",
];

describe("microcopy visible", () => {
  it.each(forbiddenPhrases)(
    "no contiene la frase técnica o narrativa: %s",
    (phrase) => {
      const matches = Object.entries(visibleSources)
        .filter(([, source]) =>
          source
            .toLocaleLowerCase("es")
            .includes(phrase.toLocaleLowerCase("es")),
        )
        .map(([path]) => path);

      expect(matches).toEqual([]);
    },
  );
});
