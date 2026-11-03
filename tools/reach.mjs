// Vérifie qu'un niveau se traverse : depuis chaque case où le chevalier tient debout, on simule avec sa vraie
// physique des sauts (élan ou non, appui court ou long, vers la gauche ou la droite) et des chutes depuis les bords.
// On cherche ensuite si le bout du niveau est atteignable depuis le départ.
// node tools/reach.mjs [niveau]   (tous les niveaux construits sans argument ; sort en erreur si un Grand Brasier
// est hors d'atteinte)

import { Level, TILE } from "../src/level.js";
import { Hero } from "../src/hero.js";
import { WORLD } from "../src/levels/index.js";

let failed = false;
for (const node of WORLD.filter((n) => n.def && (!process.argv[2] || n.id === process.argv[2]))) {
console.log(`\n== ${node.name}`);
const level = new Level(node.def);
const standable = (tx, ty) => !level.solid(tx, ty) && !level.solid(tx, ty - 1) && (level.solid(tx, ty + 1) || level.oneWay(tx, ty + 1));
const key = (tx, ty) => `${tx},${ty}`;

// une tentative : partir de (x, y) avec la vitesse vx, tenir la direction dir, garder le saut appuyé hold secondes
function attempt(x, y, vx, dir, hold, jump) {
  const h = new Hero(x, y);
  h.vx = vx;
  h.face = dir || 1;
  const dt = 1 / 120;
  let t = 0, left = false;
  while (t < 3) {
    const keys = { left: dir < 0, right: dir > 0, jump: jump && t < hold };
    h.step(dt, keys, level);
    t += dt;
    if (h.x === h.spawnAt.x && h.y === h.spawnAt.y && t > dt) return null; // tombé dans un trou : remis au départ
    if (!h.ground) left = true;
    if (left && h.ground) {
      // la case qui le porte : sous son centre, ou sous le bord de sa boîte quand il atterrit au ras du vide
      const ty = Math.round(h.y / TILE) - 1;
      for (const x of [h.x, h.x - 5, h.x + 4.99]) if (standable(Math.floor(x / TILE), ty)) return [Math.floor(x / TILE), ty];
      return null;
    }
  }
  return null;
}

const edges = new Map();
for (let ty = 0; ty < level.h; ty++)
  for (let tx = 0; tx < level.w; tx++) {
    if (!standable(tx, ty)) continue;
    const out = new Set(), foot = (ty + 1) * TILE;
    // on marche aussi sur le sol d'à côté sans sauter
    for (const d of [-1, 1]) if (standable(tx + d, ty)) out.add(key(tx + d, ty));
    for (const off of [5, 8, 11])
      for (const dir of [-1, 1])
        for (const vx of [0, dir * 108]) {
          for (const hold of [0.05, 0.12, 0.2, 0.3, 0.45]) {
            const r = attempt(tx * TILE + off, foot, vx, dir, hold, true);
            if (r) out.add(key(...r));
          }
          const r = attempt(tx * TILE + off, foot, vx, dir, 0, false);
          if (r) out.add(key(...r));
        }
    edges.set(key(tx, ty), out);
  }

const spawn = key(Math.floor(level.spawn.x / TILE), level.spawn.y / TILE - 1);
const seen = new Set([spawn]), queue = [spawn];
while (queue.length) for (const n of edges.get(queue.shift()) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }

// la carte : o atteint, x jamais atteint
const rows = level.cells.map((r, ty) => [...r].map((c, tx) => (standable(tx, ty) ? (seen.has(key(tx, ty)) ? "o" : "x") : c)).join(""));
console.log(rows.join("\n"));
const unreached = [...edges.keys()].filter((k) => !seen.has(k));
const [gx, gy] = level.grand ?? [0, 0], goal = level.grand && seen.has(key(Math.floor(gx / TILE), gy / TILE - 1));
console.log(`Grand Brasier ${goal ? "atteint" : "HORS D'ATTEINTE"}   cases jamais atteintes : ${unreached.length}`);
if (!goal) failed = true;
}
if (failed) process.exit(1);
