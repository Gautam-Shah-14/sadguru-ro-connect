# Sadguru RO Connect

Desktop application for **Sadguru Enterprise**, a small RO water-purifier sales & service
shop. It keeps every customer record on the shop's own PC, auto-calculates the three
service visits (4 / 8 / 12 months after the sale), warns when a service is due, and
sends WhatsApp reminders and AI-written festival greetings.

- **Platform:** Windows desktop (Electron)
- **Data:** a single local SQLite file — fully offline, no account, no server
- **Backup:** Settings → *Backup database* copies that one file anywhere you choose

## Develop

Requires **Node.js 20+** and npm. (Electron bundles its own Node 24 with a built-in
SQLite engine, so there is **no native build step** and no Visual Studio / Python needed.)

```sh
npm install
npm run dev        # launches the Electron app with hot reload
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Bundle main + preload + renderer into `out/` |
| `npm run icon` | Regenerate `build/icon.ico` / `build/icon.png` |
| `npm run guide` | Regenerate `Sadguru-RO-Connect-Setup-Guide.pdf` (non-technical setup guide) |
| `npm run sample` | Regenerate `Sample-Customers.xlsx` (import template) |
| `npm run package` | Build + produce Windows artifacts in `release/` |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run lint` / `npm run format` | ESLint / Prettier |

`npm run package` produces, in `release/`:

- **`Sadguru RO Connect-Setup-1.0.0.exe`** — NSIS installer (per-user, choose folder,
  desktop + start-menu shortcuts)
- **`Sadguru RO Connect-Portable-1.0.0.exe`** — single-file portable build

Backend self-checks (run headless, no window):

```sh
npx electron-vite build
npx electron . --self-test     # exercises the SQLite services, exits 0/1
npx electron . --smoke-ui      # loads the renderer, checks every route + the IPC bridge
```

## Layout

```
electron/        Node backend — SQLite DB, migrations, service layer, IPC handlers
  db/            connection + versioned migrations (node:sqlite)
  services/      customers, reminders, festivals, settings, messages,
                 festivalMessages, secrets (encrypted keys), ai/ (provider REST)
  ipc.ts         every ipcMain.handle channel
  preload.ts     contextBridge → window.api
shared/          types + pure domain logic used by BOTH backend and UI
src/             React renderer (Vite SPA, TanStack Router, Tailwind v4, shadcn/ui)
  lib/store.ts   React Query hooks over window.api (replaces the old localStorage store)
```

## Festivals & AI messages

**Festival dates** — the 18-festival list is only a starter. Add a free holiday API key
(Settings → *Festival calendar sync* — Calendarific supports future years and is the
default; API Ninjas free tier is current-year only) and the app **auto-updates this year and
next year's dates once a day** and adds new festivals it finds. Manual controls: Festival
Messages → *Manage* (add / rename / delete / toggle / set a year's date) and *Sync dates*
(review-before-apply, with an "also add N new festivals" option). Per-year dates live in the
`festival_dates` table.

**AI messages** — Settings → *AI assistant*: pick a provider (Claude / OpenAI / Gemini /
Groq), paste its API key (encrypted on-device), pick a model (or type a custom id) and a
tone. *Generate* writes a short greeting per festival in English and/or Gujarati; each is
editable and cached, so it works offline afterwards. Festivals with no AI message fall back
to the plain template.

## Importing an Excel sheet

Customers → *Sample sheet* saves a template (`Sample-Customers.xlsx`) with the expected
columns (including a **Customer ID** column) and example rows. *Import Excel* then opens a
mapping dialog: it shows your columns with a sample value and you choose what each one is
(or *Ignore*). Map a **Customer ID** column to keep your own numbering; otherwise the app
assigns IDs. Column order and extra columns don't matter; tick *skip duplicates* to match
on ID / phone / serial when re-importing. Multi-sheet workbooks get a sheet picker. The
**New entry** form has a Customer ID field too (blank = auto), and reusing an existing ID
is rejected.

## Window

Uses a custom draggable title bar with the app name; the native minimise / maximise / close
buttons are overlaid at the top-right (integrated, not a separate OS strip) and recolour
with the light/dark theme.

## WhatsApp sending

Settings → **WhatsApp Cloud API**: enter the phone number ID and access token (token
encrypted on-device), keep **Dry-run** on until *Send test message* to a real number works.
With dry-run on, every "send" is only written to the **Activity** screen. Business-initiated
messages require a Meta-approved template (set its name + language code in Settings);
free-text bodies only reach numbers that messaged the business in the last 24 hours.

A background scheduler checks hourly: on a festival's date, from 9:00 AM, if auto-send is on
and that festival hasn't gone out this year, it sends the greeting to every customer. If the
app was closed on the day, the Festival Messaging screen shows a **"missed greetings"**
banner with a one-click send.

The database lives at `%APPDATA%/Sadguru RO Connect/sadguru.db`. On first launch the app
imports any data left behind by the previous browser-based version from `localStorage`.
Settings → **Data** has *Backup* (copy the file anywhere) and *Restore* (pick a backup —
the app validates it and restarts).

> Converted from a Lovable web app to a desktop application; the Lovable editor sync no
> longer applies.
