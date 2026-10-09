// Only removes disposable tenants created by verify-demo.mjs; never Petén or user-created sedes.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { list, del } from "@vercel/blob";
const code = process.argv[2];
if (!/^qa-[a-z0-9]+$/.test(code ?? ""))
  throw new Error("An exact validation tenant code is required.");
const env = parseEnv(
  readFileSync(new URL("../.env.demo.local", import.meta.url), "utf8"),
);
const sql = postgres(env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  const [tenant] =
    await sql`SELECT id,name FROM demo_tenants WHERE code=${code}`;
  if (!tenant) throw new Error("Validation tenant not found.");
  if (tenant.name !== `Validación técnica ${code.slice(3)}`)
    throw new Error("This is not a disposable validation tenant.");
  let cursor;
  do {
    const page = await list({
      prefix: `demo/${tenant.id}/`,
      token: env.BLOB_READ_WRITE_TOKEN,
      cursor,
    });
    if (page.blobs.length)
      await del(
        page.blobs.map((b) => b.url),
        { token: env.BLOB_READ_WRITE_TOKEN },
      );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM demo_sessions WHERE tenant_id=${tenant.id}`;
    await tx`DELETE FROM demo_tenants WHERE id=${tenant.id} AND code=${code}`;
  });
  console.log(
    JSON.stringify({
      removedDisposableTenant: code,
      productionDataChanged: false,
    }),
  );
} finally {
  await sql.end();
}
