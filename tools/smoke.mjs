// Test de fumée : chaque niveau construit tourne 20 s, touches au hasard, rendu compris. Sort en erreur au premier
// plantage. La publication (.github/workflows/pages.yml) le lance avant de construire le jeu.
// node tools/smoke.mjs

import { createGame } from "../src/game.js";
import { WORLD } from "../src/levels/index.js";

const KEYS = ["left", "right", "jump", "attack", "special", "cycle", "up", "down"];
const ALL = { owned: ["lame-ardente", "boule-de-feu", "brulure", "meteores", "coeur-vaillant", "chatiment", "soin", "bouclier", "elan", "ruee", "critique", "seisme"], equipped: "boule-de-feu" };
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const w of WORLD.filter((n) => n.def)) {
  const g = createGame();
  g.load({ v: 2, purse: 99, skills: ALL, progress: {}, current: w.id, where: "level" });
  let keys = {};
  for (let i = 0; i < 60 * 20; i++) {
    if (i % 15 === 0) keys = Object.fromEntries(KEYS.map((k) => [k, rnd() < (k === "right" ? 0.6 : 0.2)]));
    g.hero.ardor = 100;
    g.step(1 / 60, keys);
    g.draw();
  }
  console.log(`ok  ${w.name}`);
}
