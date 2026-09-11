# Consultation topics

The six topics live in `lib/consultation-topics.ts`. Keep their IDs stable; the
server resolves the submitted ID to the canonical title. Copy is rendered in
the homepage HTML, including initially collapsed panels. No database migration
or additional media, fonts, tracking, or paid services are required.

`POST /api/chat` accepts either `topicId` or the existing post `sourceId`, not
both. Invalid topics return 400. Clients cannot supply a stored source title.
The conversation retains its first source; each visitor message records its
current source. The existing unique request ID also deduplicates retries.

## Local regression tests

1. Build with `node --import ./scripts/sites-env.mjs ./node_modules/vinext/dist/cli.js build`.
2. Run `node --test scripts/consultation-topics.test.mjs scripts/prepare-cloudflare.test.mjs`.
3. For a new local fixture only, run `node scripts/prepare-topics-qa.mjs`.
4. Seed only the isolated local database:

   ```sh
   node node_modules/wrangler/bin/wrangler.js d1 execute capone-topics-local-qa --local --config test-results/topics-qa/wrangler.json --persist-to test-results/topics-qa/state --file test-results/topics-qa/seed.sql
   ```

5. Start the built app with the same isolated bindings:

   ```sh
   node node_modules/wrangler/bin/wrangler.js dev --local --config test-results/topics-qa/wrangler.json --persist-to test-results/topics-qa/state --ip 127.0.0.1 --port 5174 --inspector-port 0
   ```

6. Run `node scripts/qa-topics.mjs` with Playwright available in the local runtime.
   This uses HTTP API testing only. Synthetic credentials and results stay in
   ignored `test-results/topics-qa/`. Reuse existing fixtures on subsequent runs.

Never substitute production bindings in these commands. Do not run setup,
bootstrap, password reset, or database initialization against the live site.
Authorization rejection probes have empty bodies to avoid the local Wrangler
proxy's connection reuse issue after an early rejection; malformed topic
bodies are separately covered by the source-validation tests.

## Browser checklist

- Mobile, tablet and desktop: six accordions, one initially expanded, no
  horizontal overflow, Enter/Space toggling and arrow-key navigation.
- Topic CTA displays the selected title and contextual placeholder, preserves
  unsent text when switching topic, and never sends automatically.
- Consult while playing, paused, or unmuted: homepage video is absent through
  dialog loading/open/closing and restores its previous paused/playing state.
- Stop the local server, send a synthetic draft, verify its text/topic survive
  the error, restart the same local server and retry; only one message and one
  automatic reply should appear.
- Post CTA, generic consultation, administrator inbox and replies still work.
- Physical iOS/Android vendor browsers need device testing; viewport checks are
  not equivalent to real-device coverage.

## Release

Use the existing independent Cloudflare deployment configuration, not the old
Sites deployment. Record the active Worker version before deploying for
rollback. Deploy application code only: no migrations, secret updates or data
resets. Verify public HTML and protected endpoints, then sync the reviewed
source to GitHub. Keep all `.private`, `.env`, `.dev.vars`, `test-results` and
generated build output out of Git.
