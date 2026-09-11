# Independent Cloudflare deployment

Published on 2026-09-11:

- Website: https://capone-private-studio.capone-studio-136.workers.dev
- Administration: https://capone-private-studio.capone-studio-136.workers.dev/admin
- A separate Worker, D1 database, and private R2 bucket are in use.
- The original Sites deployment, accounts, conversations, and media are unchanged.
  Existing private records have not been migrated. This is a separately initialized
  site, not a synchronized copy of the old database.

Deployment verification passed for administrator login/password rules, anonymous
access restrictions, isolated conversations, message deduplication, automatic and
administrator replies, image/video publishing, withdrawal, ranged media delivery,
homepage replacement with audio, cancellation, and logout. Temporary test content
was removed. The mobile homepage was visually checked. Full browser interaction
automation and physical iPhone/Android checks remain unverified in this deployment.

## Prerequisites

- The account owner must approve the official Wrangler authorization flow.
- Confirm Workers/D1 quotas and R2 subscription eligibility before provisioning.
  Do not enable billing, purchase a domain, or upgrade a plan without approval.
- Use a new Worker, D1 database, and private R2 bucket for this website only.
- Keep `.openai/hosting.json` unchanged. It identifies the original live site.
- Do not export existing customer conversations, account records, or private
  media until the owner has approved their transfer to the new account.

## Prepare

1. Install the pinned project dependencies and build with the existing workflow.
2. Create `.private/cloudflare-deployment.json` from `cloudflare.example.json`
   using verified resource IDs and the exact new HTTPS website origin.
   Resource names must not collide with existing projects in the account.
3. Run `node scripts/prepare-cloudflare.mjs`.
4. Inspect `dist/server/wrangler.cloudflare.json` and perform a Wrangler dry run.

The helper only generates a deployment configuration. It does not authenticate,
create resources, upload files, apply migrations, or publish anything.
The generated configuration and private settings are excluded from Git.

## Before publication

- Apply the existing SQL migrations only to the new, verified D1 database.
- Configure a fresh `BETTER_AUTH_SECRET` and temporary `BOOTSTRAP_TOKEN` using
  Wrangler's secret storage. Never put secrets in source or ordinary variables.
  `node scripts/cloudflare-runtime-secrets.mjs --bootstrap` prepares an ignored
  private JSON file for the initial `wrangler secret bulk` operation. After setup,
  remove the remote `BOOTSTRAP_TOKEN`; omit `--bootstrap` on later runs so it is
  not accidentally restored.
- Decide with the owner whether to migrate existing records or initialize the
  new site separately. Do not mistake the local test database for production.
- Public images and the supplied homepage video are already in `public/`.
  Admin-uploaded media requires the new private R2 bucket and database records.
- Never expose the R2 bucket publicly: the app checks media publication status.
- Deploy only after authorization, billing prerequisites, and data scope are
  resolved. Initialize the administrator securely, then remove the bootstrap
  secret once initialization succeeds.

## Verify before handing over the new link

- Homepage, video playback, sound toggle, and private consultation overlay.
- Two isolated anonymous conversations, one automatic reply each, and admin
  replies surviving reloads.
- Admin sign-in, first password change, logout, image/video uploads, publication,
  and private access restrictions.
- New hostname, correct HTTPS origin, and no reliance on the old site for APIs.
- Old site and its production data remain unchanged.

Cloudflare's default hostname is not a guarantee of access from every country
or mobile network. Test the actual target networks before replacing public links.
The deployment was tested using the system's working proxy connection. Direct
connections from this workstation timed out or reset; mainland access without a
VPN has not been established.

## Operations

- The owner enabled R2. No additional paid Workers upgrade or domain purchase was
  made during deployment. Watch Cloudflare usage and billing; an enabled R2
  subscription is not an unlimited free storage commitment.
- Use `deploy/ADMIN-GUIDE.md` for everyday administration.
- Credentials are delivered locally in `.private/Cloudflare管理员登录.txt`, never
  in this public repository. First login requires a password change.
- Keep the private bucket private; do not enable an R2 public endpoint to fix
  video access. Media visibility must continue to be decided by the application.
