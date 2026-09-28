# PageBuilder Runtime

This folder contains the runtime code that is copied into each user's generated
repository. When the PageBuilder mobile app triggers a build, GitHub Actions:

1. Creates a new repository from the `rn-blank-template` (this repo).
2. Places `project.json` in the root of that repository.
3. The GitHub Actions workflow then:
   - Reads `project.json`
   - Uses the runtime files in this folder to render the pages
   - Compiles a debug APK
   - Publishes the APK as a Release asset

## Files in this folder

| File | Purpose |
|---|---|
| `App.tsx` | Runtime entry point. Loads `project.json` and renders the start page. |
| `src/RuntimeRenderer.tsx` | Renders pages and components based on the project data. |
| `src/RuntimeActionHandler.ts` | Handles the interactive actions (navigate, openUrl, etc.). |
| `docs/push-flow.md` | Explains exactly which files the PageBuilder app pushes when starting a build. |

## How the mobile app uses this

The mobile app in the sibling `src/` folder is the **editor** — the tool end
users see while building. The `runtime/` folder is a **separate, self-contained
renderer** that runs inside the generated app. They intentionally do not share
code because the generated repository is created from the template, not from
this editor app.

## Keeping them in sync

If the data schema (`project.json` format) changes, both the editor and the
runtime must be updated together. The schema version is stored in
`ProjectFileVersion` inside `project.json`.