// Mechanical projection of the existing approved .NET catalogs; no new legal rules.
import { readFileSync, writeFileSync } from "node:fs";
const source = readFileSync(
  new URL(
    "../../src/BufeteJuridico.Infrastructure/Persistence/DatabaseInitializer.cs",
    import.meta.url,
  ),
  "utf8",
);
const definition = (code, label, kind, order, extra = "") => ({
  id: code,
  scope: "LegalProcess",
  processTypeId: null,
  code,
  label,
  kind,
  isRequired: true,
  isConditional: /conditional: true/.test(extra),
  conditionDescription: /condition: "([^"]+)"/.exec(extra)?.[1] ?? null,
  documentNature:
    /DocumentNature\.(\w+)/.exec(extra)?.[1] ??
    (kind === "Document" ? "Original" : "NotApplicable"),
  maximumAgeDays: /age: (\d+)/.test(extra)
    ? Number(/age: (\d+)/.exec(extra)[1])
    : null,
  subject: /subject: "([^"]+)"/.exec(extra)?.[1] ?? null,
  instructions: null,
  sortOrder: Number(order),
  isActive: true,
});
const processes = [
  ...source.matchAll(
    /new\("([A-Z_]+)", "([^"]+)", "([^"]+)",\s*\[([\s\S]*?)\]\)/g,
  ),
].map(([, code, name, description, block]) => ({
  id: code,
  code,
  name,
  description,
  isActive: true,
  requirements: [
    ...block.matchAll(
      /(Document|Data|Condition)\("([A-Z_]+)", "([^"]+)", (\d+)([^\n]*)\)/g,
    ),
  ].map(([, kind, c, l, o, x]) => ({
    ...definition(c, l, kind, o, x),
    id: `${code}-${c}`,
    processTypeId: code,
  })),
}));
const studentBlock = source.split(
  "private static IReadOnlyList<RequirementSeed> StudentRequirementSeeds()",
)[1];
const student = [
  ...studentBlock.matchAll(
    /new\("([A-Z_]+)", "([^"]+)", RequirementKind\.(\w+), (true|false), (true|false), (null|"[^"]*"), DocumentNature\.(\w+), null, "Alumno", null, (\d+)\)/g,
  ),
].map(([, c, l, k, r, conditional, condition, n, o]) => ({
  ...definition(c, l, k, o),
  scope: "StudentEnrollment",
  isRequired: r === "true",
  isConditional: conditional === "true",
  conditionDescription: condition === "null" ? null : JSON.parse(condition),
  documentNature: n,
}));
if (processes.length !== 7 || student.length !== 9)
  throw new Error("Catalog source changed: review before generating.");
writeFileSync(
  new URL("../src/demo/catalogs.json", import.meta.url),
  JSON.stringify({ processes, student }, null, 2) + "\n",
);
