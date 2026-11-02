// Joue un scénario de touches sans navigateur et écrit des captures dans shots/ : de quoi regarder le jeu.
// node tools/shot.mjs [scénario]   (run par défaut)

import { mkdirSync, writeFileSync } from "node:fs";
import { composite } from "pixelfx";
import { encodePNG } from "../node_modules/pixelfx/tools/lib/png.mjs";
import { upscale } from "../node_modules/pixelfx/tools/lib/fxlib.mjs";
import { createGame, W, H } from "../src/game.js";

// chaque étape : [durée en s, touches tenues]
const SCENARIOS = {
  // du départ : saute le trou, monte sur les marches, s'arrête, repart
  run: [[0.5, ""], [0.8, "right"], [0.35, "right jump"], [0.8, "right"], [0.6, ""], [0.25, "jump"], [0.7, ""], [1.0, "right"], [0.4, "right jump"], [0.6, "right"]],
  // jusqu'au premier slime, un combo complet (trois appuis), puis la suite
  fight: [["at", 27, 9], [0.25, "right"], [0.05, "attack"], [0.1, ""], [0.05, "attack"], [0.12, ""], [0.05, "attack"], [1.2, ""], [0.05, "attack"], [0.1, ""], [0.05, "attack"], [0.12, ""], [0.05, "attack"], [1.0, ""]],
  // tue le slime, ramasse ses braises, allume le brasero voisin
  loot: [["at", 27, 9], [0.25, "right"], [0.05, "attack"], [0.1, ""], [0.05, "attack"], [0.9, ""], [0.5, "right"], [1.2, ""], ["at", 42, 9], [0.4, "right"], [0.3, "right jump"], [0.5, "right"], [1.0, ""]],
  // allume un brasero éteint
  fire: [["at", 43, 7], [0.2, ""], [0.25, "right"], [1.4, ""]],
  // l'autel : ouvrir, apprendre Flamme 1 et 2, aller voir l'Acier, fermer
  altar: [["load", { purse: 40 }], [0.3, ""], [0.05, "special"], [0.3, ""], [0.05, "attack"], [0.3, ""], [0.05, "down"], [0.1, ""], [0.05, "attack"], [0.4, ""], [0.05, "down"], [0.3, ""], [0.05, "right"], [0.1, ""], [0.05, "right"], [0.3, ""], [0.05, "attack"], [0.3, ""], [0.05, "special"], [0.4, ""]],
  // la première échoppe : on arrive, le mage salue, on ouvre la boutique
  shop: [["load", { purse: 30 }], ["at", 10, 9], [0.6, ""], [0.05, "special"], [0.6, ""]],
  // chaque monstre : on se pose près de lui et on attend qu'il attaque
  bat: [["at", 22, 9], [0.3, "right"], [2.6, ""]],
  skull: [["at", 41, 8], [3.6, ""]],
  snake: [["at", 28, 9], [0.1, "right"], [2.4, ""]],
  ghost: [["at", 45, 7], [3.0, ""]],
  old: [[0.6, ""], [1.6, "right"], [0.5, "right jump"], [0.6, "right"], [0.4, "jump"], [0.8, ""], [1.2, "right"], [0.3, "right jump"], [0.9, "right"]],
};
// « special:<id> » : le chevalier connaît ce coup, a sa jauge pleine, et le lance face au slime de la colonne 31
const name = process.argv[2] ?? "run", spec = name.startsWith("special:") ? name.slice(8) : null;
const plan = spec
  ? [["load", { skills: { owned: ["boule-de-feu", "meteores", "chatiment", "soin", "bouclier", "ruee", "seisme"], equipped: spec } }], ["set", { ardor: 100, hp: 3 }], ["at", 27, 9], [0.1, "right"], [0.3, ""], [0.05, "special"], [2.2, ""]]
  : SCENARIOS[name];
const every = Number(process.argv[3] ?? 0.2), crop = process.argv.includes("--hero");
const CW = crop ? 80 : W, CH = crop ? 60 : H, cols = crop ? 6 : 4, k = crop ? 4 : 2;
const game = createGame(), shots = [];
let t = 0, next = 0;
for (const [d, held, ...at] of plan) {
  // ["at", x, y] : poser le chevalier à la colonne x, sur la ligne y (cases de 16 px)
  // ["set", {...}] : changer l'état du chevalier
  if (d === "set") {
    Object.assign(game.hero, held);
    continue;
  }
  // ["load", {...}] : charger une sauvegarde de test (braises, arbre)
  if (d === "load") {
    game.load({ v: 1, lit: [], ...held });
    continue;
  }
  if (d === "at") {
    Object.assign(game.hero, { x: held * 16 + 8, y: (at[0] + 1) * 16, vx: 0, vy: 0 });
    continue;
  }
  const keys = Object.fromEntries(["left", "right", "up", "down", "jump", "attack", "special", "confirm", "back"].map((k) => [k, held.split(" ").includes(k)]));
  for (let u = 0; u < d; u += 1 / 60, t += 1 / 60) {
    game.step(1 / 60, keys);
    if (t >= next) {
      next += every;
      const full = composite(game.draw(), new Uint8ClampedArray(W * H * 4), null);
      if (!crop) shots.push(full);
      else {
        // un cadre de 80 x 60 autour du chevalier
        const cx = Math.max(0, Math.min(W - CW, Math.round(game.hero.x - game.frame.ox - CW / 2)));
        const cy = Math.max(0, Math.min(H - CH, Math.round(game.hero.y - game.frame.oy - CH + 10)));
        const out = new Uint8ClampedArray(CW * CH * 4);
        for (let y = 0; y < CH; y++) out.set(full.subarray(((cy + y) * W + cx) * 4, ((cy + y) * W + cx + CW) * 4), y * CW * 4);
        shots.push(out);
      }
    }
  }
}
const rows = Math.ceil(shots.length / cols), gw = CW * k + 4, gh = CH * k + 4;
const sheet = new Uint8ClampedArray(gw * cols * gh * rows * 4);
shots.forEach((s, i) => {
  const big = upscale(s, CW, CH, k), ox = (i % cols) * gw, oy = Math.floor(i / cols) * gh;
  for (let y = 0; y < CH * k; y++) sheet.set(big.subarray(y * CW * k * 4, (y + 1) * CW * k * 4), ((oy + y) * gw * cols + ox) * 4);
});
mkdirSync("shots", { recursive: true });
writeFileSync(`shots/${name.replace(":", "-")}${crop ? "-hero" : ""}.png`, encodePNG(gw * cols, gh * rows, sheet));
console.log(`shots/${name.replace(":", "-")}${crop ? "-hero" : ""}.png  ${shots.length} images, ${t.toFixed(1)} s`);
