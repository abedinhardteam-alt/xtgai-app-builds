# XTG AI — App Builder (free cloud APK builds)

Protection By ISHAQ Officials.

The XTG AI Android app ("অ্যাপ বানান") writes a single-file HTML/JS/CSS app from your description and queues it.
This public repo's GitHub Actions workflow (free on public repos) picks the job up, checks the code, wraps it in a
native Android WebView shell (your app name, color, icon, splash), signs it and publishes the APK as a release.
XTG AI then downloads it and opens the Android installer.

* **No secrets** in the phone app or here. The queue is Firestore with strict security rules (`firestore/xtg-block.rules`).
* **Trigger:** an always-on worker (`worker.yml` + `builder/worker.js`) checks the queue every ~20 s, claims each job
  atomically and starts a separate `build.yml` run for it (pickup < 1 min, apps build in parallel). It runs ~5h45m and
  then re-dispatches itself. Backups: the `*/5` cron in `build.yml` restarts the worker (and builds itself if the worker
  is down), a 6-hourly worker schedule and the weekly keepalive also restart it.
* **Limits:** per device 1 build / 2 minutes and 15 / day; whole server 60 / 24 h. Each build ~2–4 min after pickup.
* Apps run fully offline (no INTERNET permission), localStorage works.
* Signing key is public on purpose — see `keystore/README.md`.

Layout: `template/` (Android shell, Java), `builder/` (Node: poll queue, lint/repair, build, sign, publish),
`.github/workflows/` (builder + weekly keepalive so the schedule is not auto-disabled after 60 days).
