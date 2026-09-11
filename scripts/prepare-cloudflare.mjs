import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const requiredFields = ["accountId", "workerName", "databaseId", "databaseName", "bucketName", "siteOrigin"];

export function deploymentConfig(build, settings) {
  for (const key of requiredFields) {
    if (typeof settings[key] !== "string" || !settings[key].trim()) {
      throw new Error(`Missing deployment setting: ${key}`);
    }
  }
  if (!/^[a-f0-9]{32}$/.test(settings.accountId)) throw new Error("Invalid Cloudflare account ID.");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(settings.databaseId)
      || settings.databaseId === "00000000-0000-4000-8000-000000000000") {
    throw new Error("Use the real D1 database ID, not a local development placeholder.");
  }
  for (const key of ["workerName", "databaseName", "bucketName"]) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(settings[key])) {
      throw new Error(`Invalid resource name: ${key}`);
    }
  }
  const origin = new URL(settings.siteOrigin);
  if (origin.protocol !== "https:" || origin.origin !== settings.siteOrigin
      || origin.hostname === "localhost" || origin.hostname.endsWith(".chatgpt.site")) {
    throw new Error("siteOrigin must be the exact new HTTPS origin, without a path or trailing slash.");
  }
  if (build.main !== "index.js" || build.assets?.directory !== "../client" || build.no_bundle !== true) {
    throw new Error("Unexpected build layout. Rebuild using the existing vinext configuration.");
  }
  if (!build.compatibility_flags?.includes("nodejs_compat")) throw new Error("Build lacks Node.js compatibility.");
  if (Object.keys(build.vars ?? {}).length) throw new Error("Do not copy build-time variables or secrets into the deployment.");
  if (build.d1_databases?.length !== 1 || build.d1_databases[0].binding !== "DB"
      || build.r2_buckets?.length !== 1 || build.r2_buckets[0].binding !== "BUCKET") {
    throw new Error("Expected exactly one DB binding and one private BUCKET binding.");
  }

  // Explicitly select build fields so unrelated routes or services are never deployed.
  return {
    name: settings.workerName,
    account_id: settings.accountId,
    main: build.main,
    compatibility_date: build.compatibility_date,
    compatibility_flags: build.compatibility_flags,
    no_bundle: true,
    rules: build.rules,
    assets: build.assets,
    workers_dev: true,
    preview_urls: false,
    observability: build.observability ?? { enabled: true },
    vars: { SITE_ORIGIN: settings.siteOrigin },
    d1_databases: [{
      binding: "DB",
      database_name: settings.databaseName,
      database_id: settings.databaseId,
      migrations_dir: "../../drizzle",
    }],
    r2_buckets: [{ binding: "BUCKET", bucket_name: settings.bucketName }],
  };
}

async function main() {
  const settingsPath = path.join(projectRoot, ".private", "cloudflare-deployment.json");
  const buildPath = path.join(projectRoot, "dist", "server", "wrangler.json");
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  const build = JSON.parse(await readFile(buildPath, "utf8"));
  const config = deploymentConfig(build, settings);
  await access(path.join(projectRoot, "dist", "server", "index.js"));
  await access(path.join(projectRoot, "dist", "client"));
  await access(path.join(projectRoot, "drizzle"));
  const destination = path.join(projectRoot, "dist", "server", "wrangler.cloudflare.json");
  await writeFile(destination, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  console.log("Prepared dist/server/wrangler.cloudflare.json. No resources were created or deployed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
