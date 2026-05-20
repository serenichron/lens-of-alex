/* =============================================================================
 * PassGallery — extract image URLs from the gallery manifest
 * -----------------------------------------------------------------------------
 * Run in the browser DevTools Console (F12 → Console) ON the gallery page,
 * while logged in and the photos are visible.
 *
 * Why not Resource Timing: PassGallery fetches photos inside a Web/Service
 * Worker, so the photo requests never appear in the main page's performance
 * entries. Instead, PassGallery loads a "gallery.json.txt" manifest that lists
 * every photo — that file is the real source of truth.
 *
 * This script locates the manifest, fetches + parses it, makes a best guess at
 * the photo array, and ALWAYS downloads the raw manifest as gallery-manifest.json
 * so the exact schema can be reviewed and a precise URL-builder written.
 *
 * ⚠ Final image URLs may still be signed with expiring tokens — see README.
 * ============================================================================= */
(async () => {
  // 1. locate the manifest URL (the page already requested it on load)
  const res = performance.getEntriesByType('resource').map(e => e.name);
  const manifestUrl = res.find(u => /\/gallery\.json\.txt/i.test(u));
  if (!manifestUrl) {
    console.error('❌ gallery.json.txt not seen. Reload the gallery, let it render, then rerun.');
    return;
  }
  console.log('📋 manifest :', manifestUrl);
  const basePath = manifestUrl.replace(/gallery\.json\.txt.*$/i, '');
  console.log('📁 base path:', basePath);

  // 2. fetch + parse the manifest
  let data;
  try {
    data = await fetch(manifestUrl).then(r => r.json());
  } catch (e) {
    console.error('❌ could not fetch/parse the manifest — likely CORS.', e);
    console.error('   Try opening it directly in a new tab:', manifestUrl);
    return;
  }
  window.__galleryManifest = data;
  console.log('✅ manifest parsed. Top-level keys:', Object.keys(data));

  // 3. best-effort: the largest array of objects is almost certainly the photo list
  let photos = null, photoKey = '';
  (function walk(node, key) {
    if (Array.isArray(node) && node.length && typeof node[0] === 'object') {
      if (!photos || node.length > photos.length) { photos = node; photoKey = key; }
    } else if (node && typeof node === 'object') {
      for (const k in node) walk(node[k], k);
    }
  })(data, '(root)');

  if (photos) {
    console.log(`🖼  largest object-array: "${photoKey}" — ${photos.length} entries`);
    console.log('    sample entry:', photos[0]);
  } else {
    console.warn('⚠ no obvious photo array found — inspect the manifest manually.');
  }

  // 4. always dump the raw manifest for review
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'gallery-manifest.json';
  document.body.appendChild(a); a.click(); a.remove();
  console.log('📄 saved → gallery-manifest.json');
  console.log('   Send this file (or the "sample entry" above) to build the exact image-URL pattern.');
})();
