# Roadmap Tracker

GitHub-backed learning and job hunt tracker. Static React app, no traditional backend. Data persists in a private GitHub repo via the Contents API.

## Architecture

```
Phone / Laptop browser
        |
        |  (HTTPS, Bearer PAT)
        v
   GitHub Contents API
        |
        v
   Private data repo
        |
        |  (git pull, optional cron)
        v
   Local backup
```

- **App repo** (this one, public): React + Vite app deployed to GitHub Pages
- **Data repo** (separate, private): holds `logs.json`, `apps.json`, `dsa.json`, `os.json`
- **Auth**: Fine-Grained PAT, stored only in browser localStorage. Sent only to api.github.com.
- **Concurrency**: SHA-based optimistic locking. Concurrent writes from two devices are detected and the second one reloads.

## Setup

### 1. Create both repos

On GitHub:
- `roadmap-tracker` (public, empty) — this app
- `roadmap-tracker-data` (private, empty) — your data

### 2. Generate Fine-Grained PAT

Go to https://github.com/settings/personal-access-tokens/new

- Token name: `roadmap-tracker-data-rw`
- Expiration: 90 days (set a calendar reminder to rotate)
- Repository access: **Only selected repositories** → pick `roadmap-tracker-data` only
- Permissions → Repository → **Contents**: Read and write
- Generate, copy the token (starts with `github_pat_...`)

Keep it somewhere safe for now. You will paste it into the app once.

### 3. Push this code

```bash
cd roadmap-tracker
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:<YOUR_USERNAME>/roadmap-tracker.git
git push -u origin main
```

### 4. Enable GitHub Pages

In the `roadmap-tracker` repo on GitHub:
- Settings → Pages
- Source: **GitHub Actions**

Wait ~2 minutes for the deploy workflow to complete. Check the **Actions** tab.

### 5. Open the live app

URL: `https://<YOUR_USERNAME>.github.io/roadmap-tracker/`

First time:
- Setup modal appears
- Confirm owner + repo, paste the PAT
- Click Connect

PAT lives in this browser's localStorage. Storage is per-browser per-device. You will paste the PAT once on each device you use.

### 6. (Optional) Clone data repo locally

```bash
git clone git@github.com:<YOUR_USERNAME>/roadmap-tracker-data.git
```

Now you have a local copy. For continuous backup, add a cron:

```cron
*/30 * * * * cd ~/roadmap-tracker-data && git pull --quiet
```

## Customizing the schedule

`src/schedule.js` holds the schedule and tracks. Edit `SCHEDULES` (workday/deepday/saturday/sunday) or `TRACKS` (targets, colors, labels). Commit, push, GH Actions redeploys.

If you change the schedule, existing logged data still refers to the old block IDs. They will not match the new schedule. Either keep block IDs stable or accept that historical completion data may not render cleanly.

## Renaming the repo

If you do not name the app repo `roadmap-tracker`, update three places:

1. `vite.config.js` → `base: '/your-new-name/'`
2. `index.html` → all `/roadmap-tracker/` paths
3. `public/manifest.json` → `start_url` and `scope`
4. `public/sw.js` → `APP_SHELL` paths

## Local development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173/roadmap-tracker/`.

The setup modal still asks for a PAT in dev. Use the same PAT you generated for prod, or create a separate one with the same scope.

## Files

| File | Purpose |
|---|---|
| `src/App.jsx` | Main app, all views, sync logic |
| `src/github.js` | GitHub API client, base64, SHA locking, config persistence |
| `src/schedule.js` | TRACKS, SCHEDULES, day-of-week routing, date helpers |
| `src/SetupModal.jsx` | First-run PAT entry and connection test |
| `src/main.jsx` | React entry, service worker registration |
| `src/index.css` | Tailwind entry + scrollbar styling |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker (caches UI, never caches API calls) |
| `public/icon.svg` | App icon |
| `.github/workflows/deploy.yml` | CI: build and deploy to GH Pages |

## PWA install

On iOS Safari: Share → Add to Home Screen.
On Android Chrome: menu → Install app.
On desktop Chrome: install icon in URL bar.

After install it runs fullscreen like a native app.

## Sync behavior

- Writes are debounced 800ms. Toggle a block, wait, see "syncing" then "saved" in the header.
- On 409/422 from GitHub (SHA conflict), the app auto-reloads from the server and shows a "conflict" status. Your last unsaved edit may be lost. Real conflicts only happen if you edit on two devices simultaneously.
- The app does not queue offline writes. If you toggle while offline, the sync will fail with an error status. The local UI state still updates, but it will be overwritten on next reload.

## Security

- PAT is in localStorage, accessible to any JS running on this origin. Since this is your own static site with no third-party scripts, the attack surface is limited.
- The PAT is scoped to a single repo with only Contents permission. Worst case, an attacker can read or modify only your tracker data.
- Rotate the PAT every 90 days. Set a calendar reminder.
- If your device is compromised, revoke the PAT at https://github.com/settings/personal-access-tokens

## Resume framing

This project hits several SDE-relevant points:
- Static frontend hosted on GitHub Pages
- GitHub Contents API as a versioned JSON datastore
- Fine-grained token auth with minimum-privilege scoping
- Optimistic concurrency control via ETag/SHA
- PWA with service-worker offline shell
- CI/CD via GitHub Actions

Example resume bullet:
> Built a GitHub-backed personal tracker (React, Vite, Tailwind) using the Contents API as a versioned datastore with SHA-based optimistic locking; deployed via GitHub Actions to Pages as an installable PWA.
