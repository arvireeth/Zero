# Zero — local development notes

## Project and local database

- Project checkout: `~/Documents/ZeroMail`
- PostgreSQL 16 data directory: `~/Library/Application Support/ZeroMail/postgres-data`
- Local database: `zerodotemail`
- PostgreSQL listens on loopback only at `127.0.0.1:5432`.
- The local database is for development only; do not store production mail or credentials in it.

Start PostgreSQL after a Mac restart:

```sh
~/Applications/Postgres.app/Contents/Versions/16/bin/pg_ctl \
  -D "$HOME/Library/Application Support/ZeroMail/postgres-data" \
  -l "$HOME/Library/Logs/ZeroMail-postgres.log" \
  -o "-h 127.0.0.1 -p 5432" start
```

Stop it cleanly:

```sh
~/Applications/Postgres.app/Contents/Versions/16/bin/pg_ctl \
  -D "$HOME/Library/Application Support/ZeroMail/postgres-data" stop
```

The schema has been pushed to the local database with `pnpm db:push`.

## Current sign-in and mail status

- Local sign-in now uses an in-memory Better Auth session store. This avoids the unavailable Redis emulator during local development; sessions are cleared when the Worker restarts. Production continues to use Redis.
- The default `REDIS_URL` in `.env.example` points to `http://localhost:8079`, which is a local REST emulator endpoint. No emulator is running on this Mac. Local rate-limit middleware now bypasses that loopback Redis dependency only for non-production environments; production and remote Redis configurations retain rate limiting. Other Redis-backed features may still need a reachable Redis service.
- Google OAuth sign-in completes and the Gmail API has been enabled in the matching ZeroMail Google Cloud project. Gmail mailbox endpoints now return successful responses, but the local inbox screen still shows loading placeholders, so end-to-end rendering is not yet confirmed.
- Microsoft account sign-in and Outlook OAuth are disabled in this local build. Gmail, iCloud, and generic IMAP/SMTP remain available. Existing Outlook records are preserved in the local database, but Microsoft OAuth refresh is no longer available.
- Cloudflare `workers.dev` subdomain setup is complete.

## AI cost safety

- The app's default OpenRouter model is `openrouter/free`.
- `ALLOW_PAID_AI=false` is the default.
- Paid model IDs are replaced with the free router unless `ALLOW_PAID_AI=true` is explicitly set.
- The local `.env` and copied `.dev.vars` files are ignored by Git and restricted to owner read/write permissions.
- An OpenRouter API key is not configured yet, so AI requests will remain unavailable until a key is added. Free-model routing can still be rate-limited or temporarily unavailable.
- An optional Gemini 3.8 Flash free-tier fallback is implemented, but disabled by default. It only activates when `ALLOW_GEMINI_FALLBACK=true` and a separate `GOOGLE_GENERATIVE_AI_API_KEY` is set. The model ID is restricted to a free-tier allowlist. Use a Google AI Studio project with billing disabled if you want quota exhaustion to fail rather than risk paid usage; free-tier prompts may be used to improve Google's products.
- AI features send the selected email context to the configured provider. OpenRouter may route requests to third-party model providers with different retention policies; review current terms and avoid enabling AI on sensitive mail until comfortable with the data handling.
- Keiki account-assistant credentials are intentionally left blank; the optional integration is not configured.

## Current blockers / required account setup

The following services still need setup or verification:

- Inbox UI rendering after the Gmail API activation; the mail API calls succeed, but the local interface remains on loading placeholders
- A reachable Redis REST or TCP service for Redis-backed features that are not covered by the local auth and rate-limit fallbacks; the local example endpoint is not running
- OpenRouter API key for free-first AI; no AI key is configured, paid fallback remains disabled
- An iCloud app-specific password when connecting iCloud Mail

When the provider keys are ready, run `./scripts/configure-local-secrets.sh` from the project folder. It prompts for keys without echoing them, preserves existing values when you press Enter, saves them into the owner-only `.env`, and syncs the local Worker env files. Do not paste secrets into this chat.

Never commit `.env`, `.dev.vars`, OAuth secrets, API keys, or app-specific passwords.

## PWA

The repository already contains `apps/mail/public/manifest.json` and PWA icons. The manifest responds locally. Installing on iPhone for reliable everyday use requires an HTTPS deployment; localhost/LAN development alone is not the final mobile setup.

## Previous validation notes

The server and mail unit tests passed in the latest complete run (422 tests). The frontend production build succeeded, and backend TypeScript checking passes. The Keiki approval extension remains annotated with a targeted `@ts-expect-error` because the installed SDK types lag the policy fields used by the runtime; keep those fields so write actions retain their approval safeguards. The full repository check still stops at pre-existing Prettier warnings across many untouched files. The full frontend TypeScript check was stopped after a 4 GB retry took several minutes; the production build and unit tests passed.
