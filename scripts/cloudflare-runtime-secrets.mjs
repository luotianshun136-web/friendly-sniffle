import { readFile, writeFile } from "node:fs/promises";
const { BETTER_AUTH_SECRET, BOOTSTRAP_TOKEN } = JSON.parse(await readFile(".private/secrets.json", "utf8"));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--bootstrap")) throw new Error("Only --bootstrap is supported.");
const bootstrap = args.includes("--bootstrap");
if (!BETTER_AUTH_SECRET || (bootstrap && !BOOTSTRAP_TOKEN)) throw new Error("Generate private credentials first.");
const values = bootstrap ? { BETTER_AUTH_SECRET, BOOTSTRAP_TOKEN } : { BETTER_AUTH_SECRET };
await writeFile(".private/cloudflare-runtime-secrets.json", JSON.stringify(values), { mode: 0o600 });
console.log("Prepared private runtime secrets; values were not printed.");
