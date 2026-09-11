import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "better-auth/crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "test-results", "topics-qa");
for (const file of ["credentials.json", "state"]) {
  let exists = false;
  try { await access(path.join(directory, file)); exists = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) throw new Error("Local QA fixtures already exist. Reuse them; preparation will not overwrite credentials or data.");
}
await mkdir(directory, { recursive: true });
const build = JSON.parse(await readFile(path.join(root, "dist/server/wrangler.json"), "utf8"));
const password = randomBytes(24).toString("base64url");
const hash = await hashPassword(password);
const origin = "http://127.0.0.1:5174";
const config = {
  name: "capone-topics-local-qa",
  main: "../../dist/server/index.js",
  compatibility_date: build.compatibility_date,
  compatibility_flags: build.compatibility_flags,
  no_bundle: true,
  rules: build.rules,
  assets: { ...build.assets, directory: "../../dist/client" },
  d1_databases: [{ binding: "DB", database_name: "capone-topics-local-qa", database_id: "00000000-0000-4000-8000-000000000017" }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: "capone-topics-local-qa" }],
};
await writeFile(path.join(directory, "wrangler.json"), JSON.stringify(config, null, 2));
await writeFile(path.join(directory, ".dev.vars"), `SITE_ORIGIN=${JSON.stringify(origin)}\nBETTER_AUTH_SECRET=${JSON.stringify(randomBytes(48).toString("base64url"))}\n`, { mode: 0o600 });
await writeFile(path.join(directory, "credentials.json"), JSON.stringify({ origin, username: "capone", password }), { mode: 0o600 });
const migrations = await Promise.all(["0000_cute_morbius.sql", "0001_premium_gorgon.sql", "0002_flimsy_wasp.sql"].map((file) => readFile(path.join(root, "drizzle", file), "utf8")));
const now = Date.now();
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const sql = migrations.join("\n") + `
INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt,username,displayUsername,mustChangePassword) VALUES ('capone-owner','Local QA','qa@capone.invalid',0,${now},${now},'capone','capone',0);
INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (${literal(randomUUID())},'capone-owner','credential','capone-owner',${literal(hash)},${now},${now});
INSERT INTO media (id,storageKey,mime,kind,width,height,size,createdAt) VALUES ('qa-topic-media','@hero','video/mp4','video',720,1280,3368662,${now});
INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES ('qa-topic-post','Local QA published post','Synthetic test data','qa-topic-media','published',${now},${now});
INSERT INTO posts (id,title,body,mediaId,status,createdAt,updatedAt) VALUES ('qa-topic-draft','Local QA private draft','Synthetic test data','qa-topic-media','draft',${now},${now});
`;
await writeFile(path.join(directory, "seed.sql"), sql, { mode: 0o600 });
console.log("Prepared isolated LOCAL fixtures in test-results/topics-qa. No production data or credentials were read.");
