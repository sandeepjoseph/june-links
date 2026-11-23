# June Links

June Links is a golf-travel planning website. It has a recorded hero film, a featured course collection, a searchable worldwide course directory, a trip inquiry form and a downloadable PDF trip brief.

## Requirements

- Node.js 24 or newer, and npm. The local preview uses the built-in `node:sqlite` module.
- Python 3, only for the optional scripts that regenerate policy pages or media (see [Media](#media)).

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173/. `npm run dev` compiles the site before starting, so restart it after changing files in `public/`, `lib/` or `worker/handler.js`. Only one preview can use port 4173 at a time.

Local inquiries are stored in `.local/inquiries.sqlite`. It's created automatically, the migrations in `drizzle/` are applied on start, and it's excluded from Git.

## Verify a change

```sh
npm test          # compiles the site, then runs the test suite
npm run build     # writes the deployable worker to dist/server/index.js
npm run validate  # checks that the built worker exports a fetch handler
```

The tests cover inquiry validation and storage, notification retries, PDF generation, destination search and media configuration. They use isolated test data and mocked mail delivery.

## Project structure

| Path | Purpose |
| --- | --- |
| `public/` | Website pages, styles, scripts, fonts and media |
| `worker/handler.js` | Request routing, inquiry API, venue photo route and notification processing |
| `lib/` | Shared inquiry, email and PDF trip-brief logic |
| `db/schema.ts`, `drizzle/` | Database schema and migrations |
| `scripts/` | Build, preview, validation and asset-preparation scripts |
| `tests/` | Node.js test suite |
| `source-media/` | Original media behind the files in `public/` |
| `docs/seo/` | SEO and lead-generation plan |

Generated files, not stored in Git:

- `worker/index.js` and `public/trip-pdf.js`, written by `scripts/compile-assets.mjs`
- `dist/`, written by `npm run build`
- `source-media/recorded-journeys/parkland-uk.mp4`, joined from its parts by `npm ci` (see [Media](#media))
- `.local/` and `node_modules/`

## Editing

- **Pages:** `public/index.html`, with styles in `public/*.css` and behaviour in `public/*.js`.
- **Privacy, terms and accessibility pages:** edit `scripts/create-policy-pages.py`, then run `python3 scripts/create-policy-pages.py`.
- **Server:** edit `worker/handler.js`. Never edit the generated `worker/index.js`.
- **Database:** change `db/schema.ts`, then run `npm run db:generate`. Never edit a migration that has already been applied.
- **PDF trip briefs:** `lib/trip-brief.mjs` renders them in both the browser and the server. `node scripts/create-trip-template.mjs [dir]` writes a blank template PDF. `node scripts/create-trip-brief.mjs <brief.txt|brief.json>` renders one brief.

## Deployment

`npm run build` writes a self-contained Cloudflare Worker module to `dist/server/index.js`. All site assets are embedded in it, and it has no runtime npm dependencies. In production it needs:

- a D1 database bound as `DB`, with the migrations in `drizzle/` applied in order
- for email delivery (currently on hold), the `RESEND_API_KEY` and `JUNE_LINKS_MAIL_FROM` secrets, plus a one-minute Cron Trigger for the worker's `scheduled` handler

Inquiries are stored in the D1 `inquiries` table. There is no public API that reads or lists them.

## Email delivery (on hold)

Every inquiry is saved and queued in `inquiry_notifications`, but nothing is sent until a mail provider is configured. Do not connect a live sender until the owner resumes this work.

When it resumes, use a [Resend](https://resend.com/) account with a verified sending domain. To test locally:

1. Copy `.env.local.example` to `.env.local`.
2. Fill in `RESEND_API_KEY` and `JUNE_LINKS_MAIL_FROM`. Never commit this file.
3. Run `npm run dev`. The preview loads `.env.local` and sends pending notifications every minute.

The recipient address is fixed server-side in `lib/inquiry-mail.mjs`, and each email attaches the inquiry's PDF brief. Retries reuse the same PDF and the provider's idempotency key to avoid duplicate emails.

## Media

`public/` holds the optimized media the site serves. `source-media/` holds the originals:

- `recorded-journeys/`: the three source films behind the hero film. Rebuild with `python3 scripts/build-recorded-hero.py` (needs ffmpeg and Pillow). `parkland-uk.mp4` (200 MB) is over GitHub's 100 MB file limit, so Git stores it as five parts, `parkland-uk.mp4.part-aa` to `part-ae`. `npm ci` joins them back into the original file and verifies its checksum. To join them by hand, run `node scripts/join-source-media.mjs`.

- `timezones/`: IANA time-zone snapshots. Rebuild `public/assets/timezones.json` with `node scripts/build-timezone-index.mjs`.
- `permission-pending/`: official course photos and an Andermatt clip. Their publication rights have **not** been granted. Keep them off the site until they are.

`scripts/source-venue-media.py` rebuilds `public/assets/courses.json` and `venue-media.json` from Wikidata and Wikimedia Commons.

Sources and licenses for all media are in `ASSET-REGISTER.txt` and on the public credits page (`public/credits.html`).

## Before public launch

- Complete the business and legal details and real contact channels.
- Confirm supplier relationships and written booking and fee terms.
- Review legal applicability.
- Adopt a data retention and deletion policy.
- Connect email notifications.
- Run production checks.
- Connect the `junelinks.com` domain.
- Only then remove the `noindex` tags, the robots disallow rule and the preview copy.

Do not add fabricated reviews, guaranteed-access claims, corporate registrations or memberships. This version takes no payments. Keep traveler information out of commits and issue reports.
