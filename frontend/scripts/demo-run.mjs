import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { scryptSync } from "node:crypto";
const env = parseEnv(
  readFileSync(new URL("../.env.demo.local", import.meta.url), "utf8"),
);
if (!env.DEMO_DATABASE_URL) env.DEMO_DATABASE_URL = env.DATABASE_URL;
env.DEMO_MODE = "true";
env.NEXT_PUBLIC_DEMO_MODE = "true";
env.DEMO_ADMIN_EMAIL = "licenciado@demo.umg.gt";
if (process.env.DEMO_INITIAL_PASSWORD) {
  const salt = "local-demo-validation";
  env.DEMO_ADMIN_PASSWORD_HASH = `${salt}:${scryptSync(process.env.DEMO_INITIAL_PASSWORD, salt, 32).toString("hex")}`;
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, ...env } },
);
child.on("exit", (code) => process.exit(code ?? 1));
