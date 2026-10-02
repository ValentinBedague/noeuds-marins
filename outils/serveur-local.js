// Sert l'application sur le réseau local, pour l'ouvrir sur cet ordinateur ou depuis un téléphone.
// La page est reconstruite à chaque chargement : une modification de noeud-de-chaise.html est
// visible dès qu'on recharge. Les autres fichiers viennent de pwa/.
// Usage : node outils/serveur-local.js   (Ctrl+C pour arrêter ; PORT=4174 pour changer de port)
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path");
const { page, out } = require("./construire-pwa.js");
const port = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".woff2": "font/woff2", ".css": "text/css; charset=utf-8"
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  try {
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      res.end(page());
      return;
    }
    const file = path.join(out, url);
    if (!file.startsWith(out + path.sep) || !fs.statSync(file).isFile()) throw new Error("introuvable");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(fs.readFileSync(file));
  } catch (e) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Introuvable");
  }
}).listen(port, "0.0.0.0", () => {
  console.log("Sur cet ordinateur : http://localhost:" + port);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list) if (a.family === "IPv4" && !a.internal) console.log("Sur le téléphone   : http://" + a.address + ":" + port);
  }
});
