# Dazzjun V7.0 data layer

V6 stores every personal record behind an authenticated account boundary. The browser talks only to `/api/*`; it never chooses or sends a `user_id`. The API resolves the user from the HttpOnly session cookie and applies that identity to every read and write.

## Local development

`npm run dev` starts Vite and the local API together. The API creates `.data/dazzjun.sqlite` automatically from `database/schema.sql`. Override local paths only when needed:

```bash
DAZZJUN_API_PORT=8788 DAZZJUN_DATA_DIR=.data npm run dev
```

The local database is ignored by Git. Delete or archive it only when intentionally resetting local accounts.

## V6.1 migration

Fresh environments use `database/schema.sql`. Existing V6 databases must apply `database/migrations/0061_inspiration_library.sql` before the new Worker is deployed. The migration adds account profiles and account-scoped inspiration categories, seeds the six default categories for every existing user, and converts the former JSON inspiration table to the explicit V6.1 columns.

The authoritative application workspace remains `user_workspaces.payload_json`. When an account first loads after release, the client normalizes older inspiration entries into `content`, full `url`, optional `image`, and `categoryId`, then writes the migrated payload back through the authenticated API.

## Production preparation

The packaged Worker exposes the same API contract and expects a Cloudflare D1 binding named `DB`. Before production release:

1. Create a D1 database in the target Sites/Cloudflare project.
2. Apply `database/schema.sql` to a new database. Existing deployments must apply migrations in order: `0070_ai_core_and_categories.sql`, `0071_ai_memory.sql`, `0072_ai_core_persistence.sql`, then `0073_inspiration_capture.sql` before deploying the Phase 7.1 Worker. Migration `0073` adds capture metadata and is required before the workspace mirror writes `title`, `cover`, `author`, `source_text`, `category_name`, or `ai_tags`.
3. Bind it to the Worker as `DB` and configure edge rate limiting for `/api/auth/login` and `/api/auth/register`.
4. Build with `npm run build`, run both test suites, then deploy the saved version.

`.openai/hosting.json` intentionally leaves `d1` unset until a real production database is provisioned. Do not substitute local SQLite data for production data.

## Security boundary

- Passwords use PBKDF2-SHA256 with per-user salts and 100,000 iterations, matching the Cloudflare Workers Web Crypto limit.
- Raw session tokens are stored only in HttpOnly, SameSite cookies; databases store token hashes.
- Mutating API calls reject cross-origin browser requests.
- All workspace and theme queries derive `user_id` from the active session.
- AI Memory reads, inserts, deletes, and AI context queries derive `user_id` from the active session; clients cannot select an account id.
- `ai_memory` contains only explicitly created long-term memories. Chat messages are never copied into the table automatically.
- Password changes revoke all existing sessions before issuing a replacement session.
- Inspiration capture resolves metadata only in the authenticated backend/Worker. The browser sends share text or a URL to `/api/inspiration/capture`; it never requests third-party metadata directly.
