import test from "node:test";
import assert from "node:assert/strict";
import { deploymentConfig } from "./prepare-cloudflare.mjs";

const build = {
  main: "index.js", assets: { directory: "../client" }, no_bundle: true,
  compatibility_date: "2026-05-15", compatibility_flags: ["nodejs_compat"],
  vars: {}, rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  d1_databases: [{ binding: "DB", database_id: "00000000-0000-4000-8000-000000000000" }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: "site-creator-r2" }],
  routes: ["old.example.com/*"], services: [{ service: "unrelated-worker" }],
};
const settings = {
  accountId: "11111111111111111111111111111111",
  workerName: "capone-private-studio",
  databaseId: "11111111-1111-4111-8111-111111111111",
  databaseName: "capone-private-studio-db",
  bucketName: "capone-private-studio-media",
  siteOrigin: "https://capone-private-studio.example.workers.dev",
};

test("uses independent bindings without modifying the Sites build", () => {
  const original = structuredClone(build);
  const result = deploymentConfig(build, settings);
  assert.equal(result.account_id, settings.accountId);
  assert.equal(result.d1_databases[0].database_id, settings.databaseId);
  assert.equal(result.d1_databases[0].migrations_dir, "../../drizzle");
  assert.equal(result.r2_buckets[0].bucket_name, settings.bucketName);
  assert.deepEqual(result.vars, { SITE_ORIGIN: settings.siteOrigin });
  assert.equal(result.routes, undefined);
  assert.equal(result.services, undefined);
  assert.equal(result.preview_urls, false);
  assert.deepEqual(build, original);
});

test("rejects missing account, test database, and unsafe origins", () => {
  for (const patch of [
    { accountId: "" }, { databaseId: "00000000-0000-4000-8000-000000000000" },
    { siteOrigin: "http://example.com" }, { siteOrigin: settings.siteOrigin + "/" },
    { siteOrigin: "https://old.example.chatgpt.site" }, { siteOrigin: "https://example.com/admin" },
    { bucketName: "../unrelated" },
  ]) assert.throws(() => deploymentConfig(build, { ...settings, ...patch }));
});

test("rejects unexpected artifacts and refuses copying secrets", () => {
  for (const patch of [
    { vars: { BETTER_AUTH_SECRET: "not-a-real-secret" } },
    { no_bundle: false }, { main: "other.js" }, { compatibility_flags: [] },
    { d1_databases: [] }, { r2_buckets: [{ binding: "PUBLIC" }] },
  ]) assert.throws(() => deploymentConfig({ ...build, ...patch }, settings));
});
