// Les écrans hors du jeu : la carte du royaume (choisir un niveau) et le bilan de fin de niveau.
// Ils se dessinent dans la même image que le jeu, en coordonnées d'écran.

import { hex, mix, rand, painterFor } from "pixelfx";
import { WORLD, place } from "./levels/index.js";

const C = Object.fromEntries(
  Object.entries({
    night: "#0b0a14", low: "#1c1630", hill: "#15111f", hillL: "#231c33", ink: "#0d0a14", text: "#f4e6c8", dim: "#7a6e8a",
    gold: "#ffc23d", path: "#6a5a7a", pathLit: "#e89a3a", lock: "#3a3248", coal: "#5a1c10", flame: "#ff8a2a", hot: "#ffe26b",
  }).map(([k, v]) => [k, hex(v)]),
);

/** L'état d'un niveau sur la carte : "done", "open", "soon" (pas encore construit) ou "locked". */
export function stateOf(node, progress) {
  if (progress[node.id]?.done) return "done";
  if (!node.requires.every((r) => progress[r]?.done)) return "locked";
  return node.def ? "open" : "soon";
}

export class WorldMap {
  constructor(at) {
    this.at = at;
    this.t = 0;
  }
  /** Flèches : aller au niveau voisin dans cette direction ; X ou Entrée : y entrer. Renvoie l'id choisi. */
  input(pressed, progress, emit) {
    const here = place(this.at);
    const dir = pressed.left ? [-1, 0] : pressed.right ? [1, 0] : pressed.up ? [0, -1] : pressed.down ? [0, 1] : null;
    if (dir) {
      // le niveau le plus proche dans cette direction, parmi ceux qu'on peut voir (pas les verrouillés)
      let best = null, bd = 1e9;
      for (const n of WORLD) {
        if (n === here || stateOf(n, progress) === "locked") continue;
        const dx = n.x - here.x, dy = n.y - here.y, along = dx * dir[0] + dy * dir[1];
        if (along <= 0) continue;
        const d = along + Math.abs(dx * dir[1] + dy * dir[0]) * 2;
        if (d < bd) { bd = d; best = n; }
      }
      if (best) { this.at = best.id; emit("tick"); }
    }
    if (pressed.attack || pressed.confirm || pressed.jump) {
      const st = stateOf(here, progress);
      if (st === "open" || st === "done") return here.id;
      emit("deny");
    }
    return null;
  }
  update(dt) {
    this.t += dt;
  }
  draw(frame, progress) {
    const { w: W, h: H, color, light } = frame;
    light.fill(0);
    // une nuit au-dessus de collines sombres
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c = mix(C.night, C.low, Math.min(1, y / H + ((x * 7 + y * 13) % 4) / 40));
        const r = rand(x, y, 51);
        if (r > 0.996 && y < 90) c = mix(c, C.text, 0.4);
        const hill = 150 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.013 + 1) * 14;
        if (y > hill) c = y < hill + 1.5 ? C.hillL : C.hill;
        color[y * W + x] = c;
      }
    const p = painterFor(frame);
    p.place(frame.ox, frame.oy);
    p.text("LE ROYAUME", W / 2, 6, C.text, { font: "fr", align: "center", outline: C.ink });
    // les chemins : pointillés, allumés quand le niveau de départ est terminé
    for (const n of WORLD)
      for (const r of n.requires) {
        const a = place(r), lit = progress[r]?.done, steps = Math.ceil(Math.hypot(n.x - a.x, n.y - a.y) / 4);
        for (let i = 1; i < steps; i += 1) {
          if (i % 2) continue;
          const u = i / steps;
          p.rect(Math.round(a.x + (n.x - a.x) * u), Math.round(a.y + (n.y - a.y) * u), 2, 2, lit ? C.pathLit : C.path);
        }
      }
    // les niveaux : un brasero, éteint, allumé ou absent
    for (const n of WORLD) {
      const st = stateOf(n, progress), sel = n.id === this.at;
      const base = st === "locked" ? C.lock : C.path;
      p.rect(n.x - 6, n.y + 2, 12, 3, base);
      p.rect(n.x - 4, n.y + 5, 2, 4, base);
      p.rect(n.x + 2, n.y + 5, 2, 4, base);
      if (st === "done") {
        // la flamme danse
        const f = Math.floor(this.t * 8 + n.x) % 2;
        p.rect(n.x - 3, n.y - 3, 6, 5, C.flame);
        p.rect(n.x - 1 - f, n.y - 6, 3, 4, C.hot);
        p.glow(n.x, n.y - 2, 14, C.flame, 0.5);
      } else if (st === "open") p.rect(n.x - 3, n.y, 6, 2, C.coal);
      if (sel) {
        const k = Math.floor(this.t * 3) % 2;
        p.rect(n.x - 9 - k, n.y - 10 - k, 2, 2, C.text);
        p.rect(n.x + 7 + k, n.y - 10 - k, 2, 2, C.text);
        p.rect(n.x - 9 - k, n.y + 9 + k, 2, 2, C.text);
        p.rect(n.x + 7 + k, n.y + 9 + k, 2, 2, C.text);
      }
    }
    const n = place(this.at), st = stateOf(n, progress);
    const status = { done: "GRAND BRASIER RALLUMÉ", open: "X : ENTRER", soon: "BIENTÔT", locked: "" }[st];
    p.text(n.name, W / 2, H - 26, C.text, { font: "fr", align: "center", outline: C.ink });
    p.text(status, W / 2, H - 12, st === "done" ? C.gold : st === "open" ? C.gold : C.dim, { font: "frmini", align: "center", outline: C.ink });
  }
}

const time = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;

/** Le bilan d'un niveau terminé. stats : { name, embers, kills, foes, time } */
export function drawSummary(frame, stats, t) {
  const { w: W, h: H, color, light } = frame;
  color.fill(C.night);
  light.fill(0);
  const p = painterFor(frame);
  p.place(frame.ox, frame.oy);
  p.glow(W / 2, 40, 60, C.flame, 0.35);
  p.text(stats.name.toUpperCase(), W / 2, 22, C.text, { font: "fr", align: "center", outline: C.ink });
  p.text("GRAND BRASIER RALLUMÉ", W / 2, 38, C.gold, { font: "frmini", align: "center", outline: C.ink });
  const lines = [
    ["Braises ramassées", String(stats.embers)],
    ["Ennemis vaincus", `${Math.min(stats.kills, stats.foes)} / ${stats.foes}`],
    ...(stats.shardsMax ? [["Éclats de brasier", `${stats.shards} / ${stats.shardsMax}`]] : []),
    ["Temps", time(stats.time)],
  ];
  // les lignes arrivent une à une
  lines.forEach(([k, v], i) => {
    if (t < 0.4 + i * 0.3) return;
    p.text(k.toUpperCase(), 90, 70 + i * 16, C.dim, { font: "frmini" });
    p.text(v.toUpperCase(), W - 90, 70 + i * 16, C.text, { font: "frmini", align: "right" });
  });
  if (t > 1.5 && Math.floor(t * 2) % 2 === 0) p.text("X : CONTINUER", W / 2, H - 20, C.gold, { font: "frmini", align: "center" });
}
