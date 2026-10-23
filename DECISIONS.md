# Decisions

Short log of choices made while building the app, so nobody has to guess later.

## Plan (as executed)
1. Read the reference: the live artifact was readable and is byte-identical to `reference/artifact-app.html` (except the wrapper line), so the snapshot is the source of truth.
2. Port parsing (`lib/sheet/parse.ts`) and all calculations / WhatsApp texts (`lib/core/model.ts`) as pure TypeScript shared by server, client and tests.
3. Server: Google Sheets/Drive through a `SheetSource` interface (real Google client, or an in-memory mock with the same A1 semantics).
4. UI: React components with the artifact's CSS copied verbatim (`app/globals.css`) and the same markup/class names and Hebrew strings.
5. Tests: vitest (unit + snapshots), Playwright (parity against the artifact, UI at 375 px, PWA checks).
6. Setup scripts + `SETUP.md` for the one guided session; then deploy.

## Behaviour
- **Faithful port, including quirks.** Example: a blank `צוות` cell inherits only from the last *name-less heading row* (that is what the artifact's `extract()` does), not from the previous soldier. The parity test proves the counts match.
- **No commander-confirmation layer.** A soldier's status is the sheet's plan; `marks` are always empty, so `confirmed(list) = active(list).length` (the "אושרו …" lines never show). The parity test applies exactly this one override to the artifact.
- **Status sheet** highlights the current status (from the sheet) and offers "נקה סטטוס" when one exists — in the artifact this came from the confirmation layer, which no longer exists.
- **"העתק מאתמול"** copies yesterday's plan for soldiers whose status differs (as in the PWA port).
- **Toast texts** follow the PWA port: `נשמר: <name> · <status>`, `לא נמצא בשיט: …`, `השמירה בשיט נכשלה…`.
- The home "ניהול רשימת חיילים" button is replaced by **"חיבור והתקנה"** (sheet link, last update, install steps, sign-out). No import / switch-sheet screen, no demo roster.

## Reading the sheet
- `GET /api/data`: Drive `modifiedTime` is read **before** the values, so a change made during the read is seen by the next poll.
- One `values.batchGet` (FORMATTED_VALUE) for the five tabs, plus one tiny parallel read of the main header row with UNFORMATTED_VALUE: header cells that are real dates come back as serials and are rewritten as `dd/mm/yyyy`, independent of the sheet's display locale (the artifact's XLSX reader did the same).
- **DATA tab privacy:** the server first reads only rows 1–8 to find the `מ.א` and `תפקיד ראשי` columns, then downloads *only those two columns*. ID numbers, addresses etc. are never downloaded, cached, logged or sent. Column positions are cached and re-detected if they move.
- Tab names (cached 5 min) are matched after normalising, like the artifact's `pickTab`.

## Writing
- Exact port of `writer_()`: re-read header + name and personal-number columns (and `שבצ"ק` / `_app` when needed) right before writing; row by name, column by date, vehicle cell by personal number; `_app` row by key, appended if missing. One `values.batchUpdate` with `USER_ENTERED` (vehicle numbers stay numbers). Duplicate targets in one request: last wins.
- If `_app` is missing it is created hidden (same as `appTab_()`); otherwise no tabs, rows or columns are ever added.
- No server-side lock (Vercel instances are stateless); last write wins, as agreed.
- One log line per write: `{ev:"write", by:<email>, kind, date|key}`.

## Access
- Auth.js v5, Google provider, scopes `openid email profile` only, JWT session for 90 days (commanders should not have to log in again often).
- Authorised = the Google account is in the sheet's Drive permissions (type `user` or `group`, any role), compared lower-case, cached 5 min; plus `EXTRA_ALLOWED_EMAILS`. "Anyone with the link" / domain permissions grant nothing. If Google can't be reached, a stale list is used; access is never granted on error.
- Group shares match the *group* address only (members of a Google Group are not expanded).
- Every API route checks session + authorisation itself. `/api/health` is the only open route and returns only `{ok}`.
- Signed-out / unauthorised screens and sign-out clear the device cache and the service-worker cache.

## Client
- Polls `/api/version` every 20 s while visible; refetches `/api/data` only when it changed. Polls and reads are ignored while writes are in flight (a write sequence number discards stale reads).
- Optimistic updates; when all writes finish → refetch. A failed write → Hebrew toast and revert to the last server state.
- Last `/api/data` response cached in `localStorage` → instant/offline open with "אין חיבור · מוצגים הנתונים האחרונים".
- On focus/visibility on a new calendar day the selected date jumps to today.

## Stack details
- `@googleapis/sheets` + `@googleapis/drive` (the per-API packages of `googleapis`) instead of the 100 MB umbrella package — faster cold starts on Vercel.
- PWA icons and manifest reused from `reference/pwa-port` (paths made absolute). Service worker: network-first app shell, never caches `/api/*`.
- Lighthouse removed its PWA category; the same checks (manifest, icons, theme colour, standalone, iOS meta tags, SW, Chrome's own installability errors via CDP) run in `e2e/pwa.spec.ts`.
- `MOCK_SHEET=1` serves the synthetic fixture with a fake signed-in user (`dev@example.test`). It throws if enabled on Vercel.
- Node is a portable install at `C:\dev\node` on this machine (no admin rights needed).

## 23/10/2026 — arrivals & departures, team grid
- Removed the "סטטוס מסופחים" card and view (the sheet tab is still parsed; nothing shows it).
- New "מגיעים ויוצאים" view: today, +1, +2 from the selected date. Departure = `out` that day. Arrival = `base` that day when the day before was anything other than `base` (including no status). Grouped by team, WhatsApp text for the three days.
- Team view: an 11-day grid under the roster (status letter per day, ▼ on arrival days, base count per day), sticky name column.
