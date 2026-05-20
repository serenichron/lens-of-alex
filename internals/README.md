# Internals — utility scripts

Internal tooling for the Lens of Alex site. **Not part of the published website** —
nothing here is linked from any page.

## PassGallery scrapers

PassGallery (`*.passgallery.com`) renders galleries entirely in JavaScript and
shows photos through `blob:` URLs — in-memory references that only exist inside
the open page session. They can't be fetched from outside the browser, so these
run as **DevTools Console snippets**, inside the gallery page itself.

### How to run either script

1. Open the gallery in a browser and log in (email gate, etc.) so the photos are visible.
2. Press **F12** → **Console** tab.
3. Paste the whole script, press **Enter**.
4. Leave the tab focused — it auto-scrolls the whole gallery. Watch the Console log.
5. Allow the download when the browser prompts.

### `passgallery-download.js`

Reads the gallery's `gallery.json.txt` manifest (title, dates, photo count),
scrolls the gallery, and saves:

```
<Gallery Title> (<event date>).zip
  └─ <Gallery Title>/
       ├─ img-001.jpg, img-002.jpg, …   (in gallery order)
       └─ info.txt          ← title, event date, photo counts, gallery URL
```

- The zip is **named per gallery** (manifest title + event date) — scraping
  several galleries never overwrites earlier ones.
- Each photo is captured **once**, keyed by its fixed layout slot, and only the
  **high-res layer** is grabbed — so progressive low-res previews can't sneak in
  as duplicates and the count can't exceed the gallery total.
- It **waits for each viewport's photos to actually load** (adaptive, up to
  `SETTLE_MAX` ms) instead of a fixed delay, and **re-sweeps** the whole gallery
  up to `MAX_SWEEPS` times until every manifest photo is captured.
- The Console ends with a clear verdict — `✅ COMPLET — 428/428` or
  `⚠ INCOMPLET — 410/428`. If incomplete (very slow load), just run it again on
  the same tab; already-captured slots are skipped.
- Output resolution = PassGallery's gallery-view size (≈ web-res, ~2000px).
  **Not** the full-resolution masters — use PassGallery's own download feature
  for those.

**Parallel scraping:** open each gallery in its **own browser window**, keep the
windows un-minimised (tiled is fine — a covered-but-open window still renders).
A hidden/minimised window stops rendering; the script detects that and pauses
that window until it's visible again — it cannot load images a hidden tab
won't draw.

### `passgallery-list-urls.js`

Locates PassGallery's `gallery.json.txt` **manifest** (the JSON file that lists
every photo), fetches + parses it, and downloads it as `gallery-manifest.json`.

- Resource Timing does **not** work here — PassGallery fetches photos inside a
  Web/Service Worker, so the photo requests never reach the main page's
  performance entries. The manifest is the real source of truth.
- The script makes a best guess at the photo array and logs a sample entry.
  The exact image-URL pattern depends on the manifest schema — review
  `gallery-manifest.json` to finalise a URL builder.
- ⚠ Even once built, final image URLs may be signed with expiring tokens.
  For a guaranteed result, `passgallery-download.js` remains the reliable route.
