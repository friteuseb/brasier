// La scène d'un niveau : ce qui appartient au lieu plutôt qu'aux combats. Braseros et point de reprise, Grand Brasier,
// nuages de poison, éclats de brasier, météo, indices des passages d'école, et le dessin du décor.
// game.js crée une scène à chaque entrée dans un niveau et lui passe le chevalier et ses services (sons, effets...).

import { createFx, painterFor, hex } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as burst from "pixelfx/fx/pickups/collect-burst";
import * as flamePillar from "pixelfx/fx/fire/flame-pillar";
import * as poisonCloud from "pixelfx/fx/nature/poison-cloud";
import * as shardFx from "pixelfx/fx/pickups/crystal-shard";
import * as fireflies from "pixelfx/fx/weather/fireflies";
import * as leaves from "pixelfx/fx/weather/falling-leaves";
import * as rain from "pixelfx/fx/weather/rain";
import { Level } from "./level.js";
import { HW, HH } from "./hero.js";
import { overlaps } from "./enemies.js";
import { drawBackdrop, drawTiles } from "./tiles.js";

export const COALS = ["#1a0806", "#2a0c0a", "#3e120e", "#561812", "#6e1e14", "#862a18", "#9a361c", "#ad4420", "#c05424"];
export const FLAME = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
// la météo d'un niveau : un effet pixelfx de la taille de l'écran, derrière le décor
const WEATHER = { fireflies, leaves, rain };
const LIT = brazier.meta.options.palette;
const PED = 18; // la hauteur du socle du Grand Brasier
const GATE_HINTS = { "%": "LE FEU BRÛLE CETTE BARRICADE", X: "LA RUÉE OU LE SÉISME DE L'ACIER BRISENT CE MUR", "~": "UN SORT DU SERMENT RÉVEILLE CETTE LUMIÈRE" };

// les braseros : éteints, ils couvent ; allumés, ils flambent
function light(f, on) {
  f.lit = on;
  f.fx.options.palette = on ? LIT : COALS;
  f.fx.options.light = on ? 1 : 0.3;
}

export class Stage {
  /** def : le niveau ; pr : sa progression { done, lit, checkpoint, shards }. */
  constructor(def, pr) {
    const level = (this.level = new Level(def));
    this.pr = pr;
    this.fires = level.braziers.map(([x, y], i) => ({ x, y, lit: false, fx: createFx(brazier, { x, y, seed: i + 1 }) }));
    // celui du départ brûle déjà : c'est le plus proche du point de départ
    const sp = level.spawn, dist = (f) => Math.hypot(f.x - sp.x, f.y - sp.y);
    this.start = this.fires.length ? this.fires.reduce((b, f, i) => (dist(f) < dist(this.fires[b]) ? i : b), 0) : -1;
    this.fires.forEach((f, i) => light(f, i === this.start || !!pr.lit[i]));
    this.checkpoint = pr.checkpoint ?? this.start;
    this.atFire = this.checkpoint; // le brasero où il se tient, -1 ailleurs
    const g = level.grand;
    this.grand = g && { x: g[0], y: g[1], lit: false, used: false, t: 0, fx: createFx(brazier, { x: g[0], y: g[1] - PED, seed: 99 }) };
    if (this.grand) light(this.grand, pr.done);
    this.poisons = level.poisons.map(([x, y], i) => ({ x, y, fx: createFx(poisonCloud, { x, y, seed: i + 2 }) }));
    // un éclat déjà ramassé ne revient pas
    this.shards = level.shards.map(([x, y], i) => ({ x, y, i, got: pr.shards.includes(i), fx: createFx(shardFx, { x, y: y + 14, seed: i + 5 }) }));
    const w = WEATHER[level.theme.weather];
    this.weather = w && createFx(w, { seed: 3 });
  }

  /** Où le chevalier reprend : le dernier brasero visité, ou le départ. */
  get respawn() {
    const f = this.fires[this.checkpoint] ?? this.level.spawn;
    return { x: f.x, y: f.y };
  }
  save() {
    return { lit: this.fires.map((f) => f.lit), checkpoint: this.checkpoint };
  }

  /** 0 loin de tout feu, 1 tout près d'un brasero allumé (pour le crépitement). */
  fireNear(hero) {
    let k = 0;
    for (const f of this.fires) if (f.lit) k = Math.max(k, 1 - Math.hypot(f.x - hero.x, f.y - hero.y) / 140);
    const g = this.grand;
    if (g?.lit) k = Math.max(k, 1 - Math.hypot(g.x - hero.x, g.y - hero.y) / 200);
    return Math.max(0, k);
  }

  // les animations du décor, une fois par image
  update(dt, near) {
    for (const f of this.fires) if (near(f.x, f.y)) f.fx.update(dt);
    for (const p of this.poisons) if (near(p.x, p.y)) p.fx.update(dt);
    for (const s of this.shards) if (!s.got && near(s.x, s.y)) s.fx.update(dt);
    if (this.grand && near(this.grand.x, this.grand.y)) this.grand.fx.update(dt);
    this.weather?.update(dt);
  }

  /**
   * Un pas de 1/120 s : le lieu agit sur le chevalier. game fournit emit, say, shake, addFx, save et les rappels
   * onShard(), onLevelDone().
   */
  tick(dt, hero, game) {
    const level = this.level, me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
    // les plateformes de lumière portent tant que dure la grâce du Serment
    level.lightOn = hero.oathT > 0 || hero.shieldT > 0;
    level.time = (level.time ?? 0) + dt;
    // le poison : une nappe au sol qui blesse qui la traverse
    for (const p of this.poisons)
      if (overlaps(me, { x0: p.x - 40, x1: p.x + 40, y0: p.y - 20, y1: p.y }) && hero.hurt(p.x)) {
        game.emit("hurt", { x: hero.x });
        game.shake(0.15, 1);
      }
    // les éclats de brasier
    for (const s of this.shards)
      if (!s.got && overlaps(me, { x0: s.x - 9, x1: s.x + 9, y0: s.y - 12, y1: s.y + 10 })) {
        s.got = true;
        this.pr.shards.push(s.i);
        game.addFx(createFx(burst, { x: s.x, y: s.y + 10, palette: FLAME, seed: 9 }));
        game.emit("learn", { x: s.x });
        game.onShard();
      }
    // il réapparaît sur le brasero après une chute : ce n'est pas une visite, il ne regagne rien
    if (hero.respawned) {
      hero.respawned = false;
      game.emit("fall");
      this.atFire = this.checkpoint;
    }
    // un brasero où l'on entre s'allume, rend les cœurs et devient le point de reprise
    const here = this.fires.findIndex((f) => Math.abs(hero.x - f.x) <= 12 && Math.abs(hero.y - f.y) <= 4);
    if (here >= 0 && here !== this.atFire) {
      const f = this.fires[here];
      if (!f.lit) {
        light(f, true);
        game.addFx(createFx(burst, { x: f.x, y: f.y - 30, palette: FLAME, seed: here + 2 }));
        game.shake(0.15, 1);
        game.say("BRASIER ALLUMÉ");
        game.emit("ignite", { x: f.x });
      }
      this.pr.lit[here] = true;
      this.checkpoint = here;
      hero.spawnAt = { x: f.x, y: f.y };
      hero.hp = hero.maxHp;
      game.save();
    }
    this.atFire = here;
    // le Grand Brasier : le rallumer termine le niveau ; le bilan suit 2,2 s plus tard
    const g = this.grand;
    if (g && !g.used && Math.abs(hero.x - g.x) < 18 && Math.abs(hero.y - g.y) < 6) {
      g.used = true;
      if (!g.lit) light(g, true);
      game.addFx(createFx(flamePillar, { x: g.x, y: g.y - PED, seed: 4 }));
      game.shake(0.6, 3);
      game.say("GRAND BRASIER RALLUMÉ");
      game.emit("ignite", { x: g.x });
      game.emit("boom", { x: g.x });
      this.pr.done = true;
      game.save();
    }
    if (g?.used && (g.t += dt) >= 2.2) game.onLevelDone();
  }
  /** Après une mort : on reprend au dernier brasero, sans que ce soit une visite. */
  died() {
    this.atFire = this.checkpoint;
  }

  /** Le passage d'école fermé le plus proche du chevalier, à moins de 3 cases, et son indice. */
  gateNear(hero) {
    const level = this.level, tx0 = Math.floor(hero.x / 16), ty0 = Math.floor((hero.y - 16) / 16);
    let best = null;
    for (let ty = ty0 - 4; ty <= ty0 + 3; ty++)
      for (let tx = tx0 - 3; tx <= tx0 + 3; tx++) {
        const ch = level.at(tx, ty);
        if (!GATE_HINTS[ch] || level.broken.has(`${tx},${ty}`) || (ch === "~" && level.lightOn)) continue;
        const d = Math.abs(tx - tx0) + Math.abs(ty - ty0);
        if (!best || d < best.d) best = { d, x: tx * 16 + 8, y: ty * 16, text: GATE_HINTS[ch] };
      }
    // on remonte au haut du passage, pour écrire au-dessus
    while (best && GATE_HINTS[level.at(Math.floor(best.x / 16), Math.floor(best.y / 16) - 1)]) best.y -= 16;
    return best;
  }

  // le décor derrière les personnages : ciel, météo, braseros, tuiles, éclats, Grand Brasier
  drawBack(frame, cam, near) {
    const level = this.level;
    drawBackdrop(frame, cam, level.theme);
    if (this.weather) {
      const [wx, wy] = this.weather.meta.origin;
      this.weather.options.x = frame.ox + wx;
      this.weather.options.y = frame.oy + wy;
      this.weather.draw(frame);
    }
    for (const f of this.fires) if (near(f.x, f.y)) f.fx.draw(frame, "back");
    drawTiles(frame, level);
    for (const f of this.fires) if (near(f.x, f.y)) f.fx.draw(frame, "front");
    for (const s of this.shards) if (!s.got && near(s.x, s.y)) s.fx.draw(frame);
    if (this.grand && near(this.grand.x, this.grand.y)) drawGrand(frame, this.grand, level.theme);
  }
  // le décor devant les personnages : le poison
  drawFront(frame, near) {
    for (const p of this.poisons) if (near(p.x, p.y)) p.fx.draw(frame);
  }
}

// le Grand Brasier : un socle de pierre de deux cases sous un brasero
function drawGrand(frame, g, theme) {
  const p = painterFor(frame), s = theme.stone, x0 = Math.round(g.x) - 15, y = g.y;
  p.rect(x0, y - PED, 30, PED, hex(s.brick));
  p.rect(x0, y - PED, 30, 2, hex(s.edge));
  p.rect(x0 + 2, y - PED + 2, 26, 1, hex(s.edgeD));
  p.rect(x0 + 3, y - 9, 24, 1, hex(s.mortar));
  p.rect(x0 + 14, y - PED + 3, 1, 6, hex(s.mortar));
  p.rect(x0, y - 2, 30, 2, hex(s.brickD));
  g.fx.draw(frame);
}
