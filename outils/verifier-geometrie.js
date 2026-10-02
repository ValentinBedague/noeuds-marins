// Clearance check for every knot: no two strands (same rope or different ropes) closer than
// one rope diameter, no strand inside a fitting or below the deck, no bend tighter than the
// rope allows. Knots laid along their path are checked from loose (0) to taut (1); knots
// moved from shape to shape are checked at every shape and between shapes.
// Usage: node outils/verifier-geometrie.js noeud-de-chaise.html [knotId]
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const only = process.argv[3];
const core = html.split("/*KNOT-CORE-START*/")[1].split("/*KNOT-CORE-END*/")[0];
const K = new Function(core + "; return {R, DS, KNOTS, ropeAt, ropeFrame};")();
const MIN = 2 * K.R * 0.93, SKIP = Math.round(1.3 / K.DS);
// While a rope is being moved between two shapes it may brush itself a little.
const MIN_MOVING = 2 * K.R * 0.78;
let bad = 0;

function ctrlOf(c, i) {
  const s = i * K.DS;
  let k = 0;
  while (k < c.ctrlS.length - 1 && c.ctrlS[k + 1] < s) k++;
  return (k + (s - c.ctrlS[k]) / ((c.ctrlS[k + 1] - c.ctrlS[k]) || 1)).toFixed(1);
}
function segDist(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

for (const knot of K.KNOTS) {
  if (only && knot.id !== only) continue;
  const framed = !!knot.ropes[0].frames;
  console.log("== " + knot.name + (framed ? " (shapes " + knot.ropes.map(r => r.frames.length).join(" | ") + ", stops " + knot.ropes.map(r => r.frameStops.join("/")).join(" | ") : " (stops " + knot.ropes.map(r => r.stops.join("/")).join(" | ") + ", points " + knot.ropes.map(r => r.loose.length + "=" + r.tight.length).join(" | ")) + ", steps " + knot.steps.length + ", dur " + knot.dur.length + ")");
  for (const r of knot.ropes) {
    const wrong = r.frames
      ? r.frameStops.length !== knot.steps.length + 1 || r.frameStops[r.frameStops.length - 1] !== r.frames.length - 1 || r.frames.some(f => f.length !== r.frames[0].length)
      // a rope tied folded in two is laid from both ends at once: its last stop is the middle of the path
      : r.stops.length !== knot.steps.length || r.loose.length !== r.tight.length || r.stops[r.stops.length - 1] !== (r.fold ? (r.loose.length - 1) / 2 : r.loose.length - 1);
    if (wrong || knot.dur.length !== knot.steps.length) { console.log("   !! stops/points mismatch"); bad++; }
  }
  const states = [];
  if (framed) for (let s = 0; s <= knot.ropes[0].frames.length - 1 + 1e-9; s += 0.25) states.push(s);
  else states.push(0, 0.25, 0.5, 0.75, 1);
  for (const t of states) {
    const moving = framed && Math.abs(t - Math.round(t)) > 1e-9, limit = moving ? MIN_MOVING : MIN;
    const curves = knot.ropes.map(r => r.frames ? K.ropeFrame(r, t) : K.ropeAt(r, t));
    const hits = new Map();
    const note = (key, d, txt) => { const h = hits.get(key); if (!h || d < h.d) hits.set(key, { d, txt }); };
    let gmin = 1e9, rmin = 1e9, rat = "", smin = 1e9;
    for (let a = 0; a < curves.length; a++) {
      const A = curves[a];
      for (let b = a; b < curves.length; b++) {
        const B = curves[b];
        for (let i = 0; i < A.n; i++) {
          for (let j = a === b ? i + SKIP : 0; j < B.n; j++) {
            const dx = A.pts[i * 3] - B.pts[j * 3], dy = A.pts[i * 3 + 1] - B.pts[j * 3 + 1], dz = A.pts[i * 3 + 2] - B.pts[j * 3 + 2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < gmin) gmin = d;
            if (d < limit) {
              const ka = ctrlOf(A, i), kb = ctrlOf(B, j);
              note(a + ":" + Math.floor(ka) + "-" + b + ":" + Math.floor(kb), d, `rope${a} ctrl ${ka} x rope${b} ctrl ${kb} at (${[A.pts[i * 3], A.pts[i * 3 + 1], A.pts[i * 3 + 2]].map(v => v.toFixed(2)).join(",")})`);
            }
          }
        }
      }
      for (let i = 0; i < A.n; i++) {
        const p = [A.pts[i * 3], A.pts[i * 3 + 1], A.pts[i * 3 + 2]];
        (knot.supports || []).forEach((s, si) => {
          const d = segDist(p, s.a, s.b) - s.r;
          if (d < smin) smin = d;
          if (d < K.R * 0.93) note("s" + si + ":" + a + ":" + Math.floor(ctrlOf(A, i)), d, `rope${a} ctrl ${ctrlOf(A, i)} inside support ${si} (gap ${d.toFixed(3)}) at (${p.map(v => v.toFixed(2)).join(",")})`);
        });
        if (knot.floor !== undefined && p[2] - knot.floor < K.R * 0.93) note("f:" + a + ":" + Math.floor(ctrlOf(A, i)), p[2], `rope${a} ctrl ${ctrlOf(A, i)} below deck z=${p[2].toFixed(2)}`);
      }
      const P = A.pts, n = A.n, g = 4;
      for (let i = g; i < n - g; i++) {
        const q = k => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], u = q(i - g), v = q(i), w = q(i + g);
        const ab = Math.hypot(v[0] - u[0], v[1] - u[1], v[2] - u[2]), bd = Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]), ad = Math.hypot(w[0] - u[0], w[1] - u[1], w[2] - u[2]);
        const sp = (ab + bd + ad) / 2, area = Math.sqrt(Math.max(0, sp * (sp - ab) * (sp - bd) * (sp - ad)));
        const r = area > 1e-9 ? ab * bd * ad / (4 * area) : 1e9;
        if (r < rmin) { rmin = r; rat = "rope" + a + " ctrl " + ctrlOf(A, i); }
      }
    }
    console.log(`${framed ? "shape" : "t"}=${t} len=${curves.map(c => c.len.toFixed(1)).join("/")} minDist=${gmin.toFixed(3)}${knot.supports ? " supportGap=" + smin.toFixed(3) : ""} minBend=${rmin.toFixed(2)} @ ${rat}`);
    for (const [, h] of [...hits].sort((x, y) => x[1].d - y[1].d)) { bad++; console.log(`   ${h.d.toFixed(3)}  ${h.txt}`); }
    if (rmin < (moving ? 0.2 : 0.27)) { bad++; console.log("   !! bend too tight"); }
  }
}
console.log(bad ? `\n${bad} problem(s)` : "\nall clear");
