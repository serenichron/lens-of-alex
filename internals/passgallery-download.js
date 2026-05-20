/* =============================================================================
 * PassGallery — download every photo as a ZIP (named per gallery)
 * -----------------------------------------------------------------------------
 * Run in the browser DevTools Console (F12 → Console) ON the gallery page,
 * while logged in and the photos are visible.
 *
 * - Reads the gallery's "gallery.json.txt" manifest for the title + dates + count.
 * - Scrolls the gallery; after each step it waits for PassGallery's virtual
 *   scroll to finish rendering the new region (the visible block set must stop
 *   changing) AND for every photo in view to have its image — then grabs the
 *   high-res blob once per photo (keyed by its fixed layout slot).
 * - Tiny placeholder blobs are rejected; that photo is retried on a later sweep.
 * - Re-sweeps until every photo in the manifest is captured.
 * - Outputs  "<Gallery Title> (<event date>).zip"  containing:
 *     <Gallery Title>/img-001.jpg, …   (photos, in gallery order)
 *     <Gallery Title>/info.txt          (event details)
 *
 * Parallel scraping: one gallery per browser WINDOW, windows un-minimised
 * (tiled is fine). A hidden/minimised window stops rendering — the script
 * pauses it until it's visible again.
 *
 * Output = gallery display resolution (~2000px web-res), NOT full-res masters.
 * ============================================================================= */
(async () => {
  const SCROLL_FRACTION = 0.6;   // viewport fraction advanced per step (overlap = safety)
  const SETTLE_MAX = 18000;      // ms: max wait for a viewport to render + load
  const MAX_SWEEPS = 6;          // re-sweep up to this many times for stragglers
  const MIN_BYTES = 12000;       // blobs smaller than this are placeholders — reject

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // -- load JSZip --
  if (!window.JSZip) {
    await new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = ok; s.onerror = () => no(new Error('JSZip failed to load'));
      document.head.appendChild(s);
    });
  }

  // -- gallery metadata from the manifest (best-effort) --
  const meta = { title: null, subTitle: '', projectDate: '', datePublished: '', manifestCount: null };
  try {
    const manifestUrl = performance.getEntriesByType('resource')
      .map(e => e.name).find(u => /\/gallery\.json\.txt/i.test(u));
    if (manifestUrl) {
      const m = await fetch(manifestUrl).then(r => r.json());
      meta.title = m.title || null;
      meta.subTitle = m.subTitle || '';
      meta.projectDate = m.projectDate || '';
      meta.datePublished = (m.datePublished || '').slice(0, 10);
      let c = 0;
      for (const sc of (m.scenes || [])) {
        if (Array.isArray(sc.photos)) c += Math.round(sc.photos.length / 5);
      }
      meta.manifestCount = c || null;
    }
  } catch (e) {
    console.warn('⚠ couldn\'t read the gallery manifest — using a fallback name.', e);
  }
  const title = meta.title || document.title || 'passgallery';
  const TGT = meta.manifestCount;
  console.log('🏷  Galerie:', title);
  if (TGT) console.log(`🎯 De descărcat: ${TGT} fotografii (conform manifestului).`);
  else console.warn('⚠ Numărul total nu a putut fi citit — se descarcă câte se găsesc.');

  // -- pause whenever the tab/window is hidden (background = no rendering = no loads) --
  async function waitVisible() {
    if (!document.hidden) return;
    console.log('⏸  fereastră ascunsă — pauză. Adu fereastra în față ca să continue…');
    while (document.hidden) await sleep(400);
    console.log('▶  reiau în 1.5s…');
    await sleep(1500);
  }

  // -- helpers --
  const blobUrlOf = (el) => {
    const m = (el && el.style.backgroundImage || '').match(/url\(["']?(blob:[^"')]+)["']?\)/);
    return m ? m[1] : null;
  };
  const visibleBlocks = () => [...document.querySelectorAll('.block.Image')].filter(b => {
    const r = b.getBoundingClientRect();
    return r.bottom > -50 && r.top < window.innerHeight + 50;
  });

  const slots = new Map();   // "top|left" -> { buf, ext, top, left }

  async function grab() {
    for (const block of document.querySelectorAll('.block.Image')) {
      const key = block.style.top + '|' + block.style.left;
      if (slots.has(key)) continue;                       // photo already captured
      const url = blobUrlOf(block.querySelector('.img.highres'));
      if (!url) continue;                                 // high-res layer not ready
      try {
        const buf = await fetch(url).then(r => r.arrayBuffer());
        if (buf.byteLength < MIN_BYTES) continue;         // placeholder — leave slot open
        const sig = new Uint8Array(buf.slice(0, 4));
        let ext = 'jpg';
        if (sig[0] === 0x89 && sig[1] === 0x50) ext = 'png';
        else if (sig[0] === 0x52 && sig[1] === 0x49) ext = 'webp';
        slots.set(key, { buf, ext, top: parseFloat(block.style.top) || 0, left: parseFloat(block.style.left) || 0 });
      } catch (e) { /* blob revoked mid-grab — next sweep */ }
    }
  }

  // wait until PassGallery has rendered the new region (visible block set stops
  // changing) AND every photo in view has its image blob
  async function settle() {
    const t0 = Date.now();
    await sleep(450);                       // give the virtual scroll a beat to react
    let prevSig = null, stable = 0;
    while (Date.now() - t0 < SETTLE_MAX) {
      await waitVisible();
      const vis = visibleBlocks();
      const sig = vis.map(b => b.style.top + '|' + b.style.left).sort().join(',');
      const allHaveBlob = vis.length > 0 && vis.every(b => blobUrlOf(b.querySelector('.img.highres')));
      if (sig === prevSig) stable++; else { prevSig = sig; stable = 0; }
      if (stable >= 2 && allHaveBlob) return;          // region rendered + loaded
      if (stable >= 3 && vis.length === 0) return;     // genuinely empty stretch
      await sleep(350);
    }
  }

  // -- pick the scroll container --
  let scroller = document.scrollingElement || document.documentElement;
  if (scroller.scrollHeight <= window.innerHeight + 100) {
    let el = document.querySelector('#photoStream');
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 100) { scroller = el; break; }
      el = el.parentElement;
    }
  }
  const isWin = scroller === document.scrollingElement || scroller === document.documentElement;
  const setY  = (y) => isWin ? window.scrollTo(0, y) : (scroller.scrollTop = y);
  const maxY  = () => scroller.scrollHeight;

  // -- one full top-to-bottom pass --
  async function sweep(n) {
    const step = Math.max(220, window.innerHeight * SCROLL_FRACTION);
    setY(0); await settle(); await grab();
    for (let y = 0; y < maxY(); y += step) {
      setY(y);
      await settle();
      await grab();
      console.log(`📜 sweep ${n} · ${Math.round(y)}/${maxY()}px — ${slots.size}${TGT ? '/' + TGT : ''} imagini`);
      if (TGT && slots.size >= TGT) {
        console.log('✓ toate fotografiile au fost capturate — opresc derularea.');
        return;
      }
    }
    setY(maxY()); await settle(); await grab();
  }

  let prevSize = -1;
  for (let n = 1; n <= MAX_SWEEPS; n++) {
    await sweep(n);
    if (!TGT || slots.size >= TGT) break;
    if (slots.size === prevSize) {
      console.log(`↻ sweep ${n}: 0 fotografii noi — mă opresc (restul nu pot fi capturate automat).`);
      break;
    }
    prevSize = slots.size;
    console.log(`↻ ${slots.size}/${TGT} — încă o trecere pentru ce lipsește…`);
  }

  // -- order photos as they appear in the gallery (top→bottom, left→right) --
  const images = [...slots.values()].sort((a, b) => a.top - b.top || a.left - b.left);

  // -- info.txt --
  const dash = (s) => (s == null || s === '') ? '—' : String(s);
  const info = [
    'LENS OF ALEX — descărcare galerie PassGallery',
    '='.repeat(48), '',
    'Galerie:                 ' + dash(title),
    'Subtitlu:                ' + dash(meta.subTitle),
    'Data evenimentului:      ' + dash(meta.projectDate),
    'Publicat:                ' + dash(meta.datePublished),
    'Fotografii (în galerie): ' + dash(TGT),
    'Fotografii descărcate:   ' + images.length,
    'URL galerie:             ' + location.href,
    'Descărcat la:            ' + new Date().toISOString(),
  ].join('\n');

  // -- zip (everything inside a folder named after the gallery) --
  const safe = (s) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'passgallery';
  const folder = safe(title);
  console.log(`📦 zipping ${images.length} images…`);
  const zip = new JSZip();
  zip.file(`${folder}/info.txt`, info);
  images.forEach((im, i) => zip.file(`${folder}/img-${String(i + 1).padStart(3, '0')}.${im.ext}`, im.buf));
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

  const fname = meta.projectDate ? `${folder} (${meta.projectDate}).zip` : `${folder}.zip`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();

  // -- accurate verdict --
  if (!TGT) {
    console.log(`✅ ${images.length} imagini → ${fname}`);
  } else if (images.length >= TGT) {
    console.log(`✅ COMPLET — ${images.length}/${TGT} imagini → ${fname}`);
  } else {
    const miss = TGT - images.length;
    console.warn(`⚠ ${images.length}/${TGT} — ${miss} ${miss === 1 ? 'lipsește' : 'lipsesc'} → ${fname}`);
    console.warn(`   Dacă ultima trecere n-a adăugat nimic, cele ${miss} probabil nu pot fi luate ` +
                 `automat (fișiere foarte mici, sau numărul din manifest e ușor diferit de realitate). ` +
                 `Restul de ${images.length} sunt în zip — caută manual ce lipsește în galerie, ` +
                 `sau ignoră dacă numărul e acceptabil.`);
  }
})();
