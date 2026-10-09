// Isolated Vercel project configuration. Secrets never enter source control or stdout.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomBytes, scryptSync } from "node:crypto";
import { parseEnv } from "node:util";
const env = parseEnv(
  readFileSync(new URL("../.env.demo.local", import.meta.url), "utf8"),
);
const project = JSON.parse(
  readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8"),
);
if (project.projectName !== "bufete-umg-demo")
  throw new Error("Refusing to modify a non-demo project.");
const auth = JSON.parse(
  readFileSync(
    `${homedir()}/AppData/Roaming/com.vercel.cli/Data/auth.json`,
    "utf8",
  ),
);
const password = process.env.DEMO_INITIAL_PASSWORD;
if (!password || password.length < 8)
  throw new Error("Set DEMO_INITIAL_PASSWORD before configuration.");
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
const variables = {
  DEMO_MODE: "true",
  NEXT_PUBLIC_DEMO_MODE: "true",
  DEMO_ADMIN_EMAIL: "licenciado@demo.umg.gt",
  DEMO_ADMIN_PASSWORD_HASH: passwordHash,
  DEMO_DATABASE_URL: env.DATABASE_URL,
};
if (!variables.DEMO_DATABASE_URL || !env.BLOB_READ_WRITE_TOKEN)
  throw new Error("Missing demo resources.");
const url = `https://api.vercel.com/v10/projects/${project.projectId}/env?teamId=${project.orgId}&upsert=true`;
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(
    Object.entries(variables).map(([key, value]) => ({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview", "development"],
    })),
  ),
});
if (!response.ok)
  throw new Error(`Environment configuration failed (${response.status}).`);
const settings = await fetch(
  `https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      framework: "nextjs",
      rootDirectory: null,
      buildCommand: "npm run build",
      ssoProtection: null,
    }),
  },
);
if (!settings.ok)
  throw new Error(`Project settings failed (${settings.status}).`);
console.log("Isolated demo environment configured. No secret values printed.");
