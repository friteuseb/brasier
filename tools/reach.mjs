// Vérifie qu'un niveau se traverse : depuis chaque case où le chevalier tient debout, on simule avec sa vraie
// physique des sauts (élan ou non, appui court ou long, vers la gauche ou la droite) et des chutes depuis les bords.
// On cherche ensuite si le bout du niveau est atteignable depuis le départ.
// node tools/reach.mjs [niveau]   (tous les niveaux construits sans argument ; sort en erreur si un Grand Brasier
// est hors d'atteinte)

import { Level, TILE } from "../src/level.js";
import { Hero } from "../src/hero.js";
import { WORLD } from "../src/levels/index.js";

let failed = false;
const key = (tx, ty) => `${tx},${ty}`;

// les cases atteintes depuis le départ, pour une carte dans un état donné (passages ouverts ou non)
function reach(level) {
  const standable = (tx, ty) => !level.solid(tx, ty) && !level.solid(tx, ty - 1) && (level.solid(tx, ty + 1) || level.oneWay(tx, ty + 1));
  // une tentative : partir de (x, y) avec la vitesse vx, tenir la direction dir, garder le saut appuyé hold secondes
  function attempt(x, y, vx, dir, hold, jump) {
    const h = new Hero(x, y);
    h.vx = vx;
    h.face = dir || 1;
    const dt = 1 / 120;
    let t = 0, left = false;
    while (t < 3) {
      h.step(dt, { left: dir < 0, right: dir > 0, jump: jump && t < hold }, level);
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
  return { seen, standable, edges };
}
// un éclat est pris si l'on atteint sa case ou celle juste en dessous
const gotShard = (seen, [x, y]) => [0, 1].some((d) => seen.has(key(Math.floor(x / TILE), Math.floor(y / TILE) + d)));
const openAll = (level, ch) => level.cells.forEach((row, ty) => [...row].forEach((c, tx) => c === ch && level.broken.add(key(tx, ty))));
const SCHOOLS = { Flamme: (l) => openAll(l, "%"), Acier: (l) => openAll(l, "X"), Serment: (l) => (l.lightOn = true) };

for (const node of WORLD.filter((n) => n.def && (!process.argv[2] || n.id === process.argv[2]))) {
  console.log(`\n== ${node.name}`);
  const level = new Level(node.def), { seen, standable, edges } = reach(level);
  // la carte : o atteint, x jamais atteint
  console.log(level.cells.map((r, ty) => [...r].map((c, tx) => (standable(tx, ty) ? (seen.has(key(tx, ty)) ? "o" : "x") : c)).join("")).join("\n"));
  const unreached = [...edges.keys()].filter((k) => !seen.has(k));
  const [gx, gy] = level.grand ?? [0, 0], goal = level.grand && seen.has(key(Math.floor(gx / TILE), gy / TILE - 1));
  console.log(`Grand Brasier ${goal ? "atteint" : "HORS D'ATTEINTE"}   cases jamais atteintes sans école : ${unreached.length}`);
  if (!goal) failed = true;
  // chaque éclat : il doit rester fermé sans école, et s'ouvrir avec au moins une
  for (const s of level.shards) {
    if (gotShard(seen, s)) { console.log(`éclat (${Math.floor(s[0] / TILE)}, ${Math.floor(s[1] / TILE)}) : atteint SANS école, ce n'est pas un secret`); continue; }
    const by = Object.entries(SCHOOLS).filter(([, open]) => { const l = new Level(node.def); open(l); return gotShard(reach(l).seen, s); }).map(([n]) => n);
    console.log(`éclat (${Math.floor(s[0] / TILE)}, ${Math.floor(s[1] / TILE)}) : ${by.length ? "ouvert par " + by.join(", ") : "JAMAIS ATTEINT"}`);
    if (!by.length) failed = true;
  }
}
if (failed) process.exit(1);
