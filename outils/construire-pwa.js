// Construit l'application installable et utilisable hors ligne dans pwa/, à partir de
// noeud-de-chaise.html. La page source charge three.js et les polices depuis Internet ;
// l'application, elle, embarque tout (pwa/vendor, pwa/fonts) et met ses fichiers en cache.
// Usage : node outils/construire-pwa.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, ".."), out = path.join(root, "pwa");

const FONTS = [
  '@font-face{font-family:"Albert Sans";font-style:normal;font-weight:400 600;font-display:swap;src:url(fonts/albert-sans.woff2) format("woff2")}',
  '@font-face{font-family:"Libre Caslon Text";font-style:normal;font-weight:400;font-display:swap;src:url(fonts/libre-caslon-text.woff2) format("woff2")}',
  '@font-face{font-family:"Libre Caslon Text";font-style:italic;font-weight:400;font-display:swap;src:url(fonts/libre-caslon-text-italic.woff2) format("woff2")}'
].join("\n");

// Everything the app needs once installed. "./" is the page itself.
const FILES = [
  "./", "index.html", "manifest.webmanifest", "vendor/three.min.js",
  "fonts/albert-sans.woff2", "fonts/libre-caslon-text.woff2", "fonts/libre-caslon-text-italic.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

// The complete page, built from the source file.
function page() {
  let src = fs.readFileSync(path.join(root, "noeud-de-chaise.html"), "utf8");
  src = src.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\r?\n?/, "<style>\n" + FONTS + "\n</style>\n");
  src = src.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/, '<script src="vendor/three.min.js"></script>');
  if (/(src|href)="https?:\/\//.test(src)) throw new Error("une dépendance externe subsiste dans la page");
  const at = src.indexOf('<main class="home"');
  if (at < 0) throw new Error("début du contenu introuvable");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#12283a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Nœuds marins">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
:root { color-scheme: light; padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
${src.slice(0, at)}</head>
<body>
${src.slice(at)}
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
</script>
</body>
</html>
`;
}

function build() {
  for (const f of FILES.slice(3)) {
    if (!fs.existsSync(path.join(out, f))) throw new Error("fichier manquant : pwa/" + f + (f.startsWith("icons/") ? " (lancez d'abord : node outils/creer-icones.js)" : ""));
  }
  const html = page();
  const manifest = JSON.stringify({
    name: "Nœuds marins",
    short_name: "Nœuds",
    description: "Les nœuds marins en 3D, étape par étape.",
    lang: "fr",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#070f17",
    theme_color: "#12283a",
    icons: [
      { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  }, null, 2) + "\n";
  // The cache name changes whenever any file changes, so an installed app picks up the new version.
  const hash = crypto.createHash("sha1").update(html).update(manifest);
  for (const f of FILES.slice(3)) hash.update(fs.readFileSync(path.join(out, f)));
  const version = hash.digest("hex").slice(0, 10);
  const sw = `// Généré par outils/construire-pwa.js : ne pas modifier à la main.
const CACHE = "noeuds-marins-${version}";
const FILES = ${JSON.stringify(FILES)};

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  // La page : le réseau d'abord, pour recevoir les mises à jour ; le cache quand il n'y a pas de réseau.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put("index.html", copy)); return response; })
        .catch(() => caches.match("index.html")));
    return;
  }
  // Le reste (three.js, polices, icônes) : le cache d'abord.
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
`;
  fs.writeFileSync(path.join(out, "index.html"), html);
  fs.writeFileSync(path.join(out, "manifest.webmanifest"), manifest);
  fs.writeFileSync(path.join(out, "sw.js"), sw);
  return { version, bytes: Buffer.byteLength(html) };
}

module.exports = { page, build, out };

if (require.main === module) {
  const done = build();
  console.log("pwa/ construit, version " + done.version + " (page : " + Math.round(done.bytes / 1024) + " Ko)");
}
