// La scène d'un niveau : ce qui appartient au lieu plutôt qu'aux combats. Braseros et point de reprise, Grand Brasier,
// nuages de poison, éclats de brasier, météo, indices des passages d'école, et le dessin du décor.
// game.js crée une scène à chaque entrée dans un niveau et lui passe le chevalier et ses services (sons, effets...).

import { createFx, painterFor, hex, rgb } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as burst from "pixelfx/fx/pickups/collect-burst";
import * as flamePillar from "pixelfx/fx/fire/flame-pillar";
import * as poisonCloud from "pixelfx/fx/nature/poison-cloud";
import * as shardFx from "pixelfx/fx/pickups/crystal-shard";
import * as fireflies from "pixelfx/fx/weather/fireflies";
import * as leaves from "pixelfx/fx/weather/falling-leaves";
import * as rain from "pixelfx/fx/weather/rain";
import * as iceCrystal from "pixelfx/fx/ice/ice-crystal";
import * as drip from "pixelfx/fx/water/drip";
import * as poof from "pixelfx/fx/spawn/poof";
import * as geyser from "pixelfx/fx/water/geyser";
import * as storm from "pixelfx/fx/weather/storm";
import * as eclipse from "pixelfx/fx/shadow/eclipse";
import * as graspingHands from "pixelfx/fx/shadow/grasping-hands";
import * as blackHole from "pixelfx/fx/shadow/black-hole";
import { Level } from "./level.js";
import { HW, HH } from "./hero.js";
import { overlaps } from "./enemies.js";
import { drawBackdrop, drawTiles } from "./tiles.js";

export const COALS = ["#1a0806", "#2a0c0a", "#3e120e", "#561812", "#6e1e14", "#862a18", "#9a361c", "#ad4420", "#c05424"];
export const FLAME = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
// la météo d'un niveau : un effet pixelfx de la taille de l'écran, derrière le décor
const WEATHER = { fireflies, leaves, rain, storm };
const LIT = brazier.meta.options.palette;
// les cristaux des Mines : un violet froid, pour trancher sur le feu des braseros
const CRYSTAL = ["#140a2e", "#2a1462", "#4a2aa0", "#7a52d8", "#a888f0", "#d8c8ff", "#f4eeff", "#ffffff"];
const CRUMBLE = 0.5, BACK = 3.5; // une dalle tombe 0,5 s après qu'on s'y pose, et revient 3 s plus tard
// les cloches : elles sonnent toutes les 4,5 s ; l'onde s'élargit de 18 à 90 px en 0,45 s et blesse au passage
const BELL_PERIOD = 4.5, RING = 0.45, BELL = { body: hex("#c8963a"), light: hex("#f0cc6a"), dark: hex("#7a5420"), rope: hex("#5a4030"), wave: hex("#ffe9a0") };
const WATER = { deep: hex("#16364a"), light: hex("#4a8ab0"), foam: hex("#c8e8f4") };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const DARK = [0.1, 0.26, 0.48, 0.74, 1]; // les marches de l'obscurité, du noir à la pleine lumière
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
    this.crystals = level.crystals.map(([x, y], i) => ({ x, y, fx: createFx(iceCrystal, { x, y, seed: i + 21, palette: CRYSTAL, height: 20 }) }));
    this.drips = level.drips.map(([x, y], i) => ({ x, y, fx: createFx(drip, { x, y, seed: i + 1, height: 70 }) }));
    // les geysers jaillissent toutes les 5,2 s, chacun décalé ; la colonne d'eau porte de 1,15 à 2,5 s de leur cycle
    this.geysers = level.geysers.map(([x, y], i) => ({ x, y, t: -i * 1.7, fx: null }));
    this.bells = level.bells.map(([x, y], i) => ({ x, y, t: (i * 1.3) % BELL_PERIOD, hit: false }));
    // les mains d'ombre jaillissent toutes les 3,6 s (décalées) ; elles blessent de 0,35 à 2 s de leur cycle
    this.hands = level.hands.map(([x, y], i) => ({ x, y, t: -i * 0.9, fx: null }));
    // les trous noirs tournent sur place ; leur origine pixelfx est sous le disque, à 30 px du centre
    this.holes = level.holes.map(([x, y], i) => ({ x, y, fx: createFx(blackHole, { x, y: y + 30, seed: i + 4 }) }));
    // l'éclipse : un astre fixe dans le ciel, qui ne bouge presque pas avec la caméra
    this.sky = level.theme.celestial === "eclipse" && createFx(eclipse, { seed: 3 });
    this.falling = new Map(); // les dalles en route : "tx,ty" -> secondes depuis qu'on s'y est posé
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
    for (const c of this.crystals) if (near(c.x, c.y)) c.fx.update(dt);
    for (const d of this.drips) if (near(d.x, d.y)) d.fx.update(dt);
    for (const h of this.hands) {
      h.t += dt;
      if (h.t >= 3.6 || (!h.fx && h.t >= 0)) { h.t = 0; h.fx = createFx(graspingHands, { x: h.x, y: h.y, seed: 5 }); }
      h.fx?.update(dt);
    }
    for (const q of this.holes) if (near(q.x, q.y)) q.fx.update(dt);
    this.sky?.update(dt);
    for (const g of this.geysers) {
      g.t += dt;
      if (g.t >= 5.2 || (!g.fx && g.t >= 0)) { g.t = 0; g.fx = createFx(geyser, { x: g.x, y: g.y, seed: 4, height: 96 }); }
      g.fx?.update(dt);
    }
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
    // les dalles fragiles : sous les pieds, elles tremblent, tombent, puis reviennent
    if (hero.ground)
      for (const x of [hero.x - HW, hero.x + HW - 0.01]) {
        const k = `${Math.floor(x / 16)},${Math.floor((hero.y + 1) / 16)}`;
        if (level.at(Math.floor(x / 16), Math.floor((hero.y + 1) / 16)) === "_" && !this.falling.has(k)) this.falling.set(k, 0);
      }
    for (const [k, t] of this.falling) {
      const u = t + dt, [tx, ty] = k.split(",").map(Number);
      this.falling.set(k, u);
      if (u < CRUMBLE) level.shaking.set(k, u);
      else if (!level.crumbled.has(k) && u < BACK) {
        level.shaking.delete(k);
        level.crumbled.add(k);
        const T = level.theme.stone;
        game.addFx(createFx(poof, { x: tx * 16 + 8, y: ty * 16 + 6, seed: 4, palette: [T.shade, T.brickD, T.brick, T.edge] }), 1.4);
        game.emit("crumble", { x: tx * 16 });
      } else if (u >= BACK) {
        level.crumbled.delete(k);
        this.falling.delete(k);
      }
    }
    // les cloches : l'onde de choc blesse quand elle passe sur le chevalier
    for (const b of this.bells) {
      const before = b.t;
      b.t = (b.t + dt) % BELL_PERIOD;
      if (b.t < before) { b.hit = false; game.emit("bell", { x: b.x }); }
      if (b.t < RING && !b.hit) {
        const r = 18 + (b.t / RING) * 72, d = Math.hypot(hero.x - b.x, hero.y - 16 - (b.y + 14));
        if (Math.abs(d - r) < 10 && hero.hurt(b.x)) { b.hit = true; game.emit("hurt", { x: hero.x }); game.shake(0.2, 2); }
      }
    }
    // les mains d'ombre, dressées, blessent ce qui passe au-dessus d'elles
    for (const h of this.hands)
      if (h.fx && h.t > 0.35 && h.t < 2 && overlaps(me, { x0: h.x - 26, x1: h.x + 26, y0: h.y - 48, y1: h.y }) && hero.hurt(h.x)) {
        game.emit("hurt", { x: hero.x });
        game.shake(0.2, 2);
      }
    // les trous noirs attirent le chevalier vers leur cœur (de plus en plus fort en approchant) ; le cœur blesse
    for (const q of this.holes) {
      const dx = q.x - hero.x, dy = q.y - (hero.y - 16), d = Math.hypot(dx, dy);
      if (d < 120 && d > 1) {
        const pull = 900 * (1 - d / 120);
        hero.vx += (dx / d) * pull * dt;
        hero.vy += (dy / d) * pull * dt;
      }
      if (d < 14 && hero.hurt(q.x)) { game.emit("hurt", { x: hero.x }); game.shake(0.2, 2); }
    }
    // un geyser qui jaillit projette en l'air ce qui se tient au-dessus de lui
    for (const g of this.geysers)
      if (g.fx && g.t > 1.15 && g.t < 2.5 && Math.abs(hero.x - g.x) < 12 && hero.y > g.y - 100 && hero.y <= g.y + 2 && hero.vy > -400) {
        hero.vy = -470;
        hero.ground = false;
        if (!g.launched) { g.launched = true; game.emit("geyser", { x: g.x }); }
      } else if (g.t < 1) g.launched = false;
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
    if (this.sky) {
      this.sky.options.x = frame.ox + 236 - cam.x * 0.02;
      this.sky.options.y = frame.oy + 44;
      this.sky.draw(frame);
    }
    if (this.weather) {
      const [wx, wy] = this.weather.meta.origin;
      this.weather.options.x = frame.ox + wx;
      this.weather.options.y = frame.oy + wy;
      this.weather.draw(frame);
    }
    for (const f of this.fires) if (near(f.x, f.y)) f.fx.draw(frame, "back");
    drawTiles(frame, level);
    for (const c of this.crystals) if (near(c.x, c.y)) c.fx.draw(frame);
    for (const q of this.holes) if (near(q.x, q.y)) q.fx.draw(frame);
    for (const f of this.fires) if (near(f.x, f.y)) f.fx.draw(frame, "front");
    for (const s of this.shards) if (!s.got && near(s.x, s.y)) s.fx.draw(frame);
    if (this.grand && near(this.grand.x, this.grand.y)) drawGrand(frame, this.grand, level.theme);
  }
  // le décor devant les personnages : le poison, les gouttes
  drawFront(frame, near) {
    for (const p of this.poisons) if (near(p.x, p.y)) p.fx.draw(frame);
    for (const d of this.drips) if (near(d.x, d.y)) d.fx.draw(frame);
    for (const g of this.geysers) if (g.fx && near(g.x, g.y)) g.fx.draw(frame);
    for (const h of this.hands) if (h.fx && near(h.x, h.y)) h.fx.draw(frame);
    for (const b of this.bells) if (near(b.x, b.y)) drawBell(frame, b);
    this.drawWater(frame);
  }

  // l'eau profonde : un voile translucide par-dessus tout, une ligne claire qui ondule à la surface
  drawWater(frame) {
    const level = this.level, p = painterFor(frame), t = level.time ?? 0, { ox, oy, w: W, h: H } = frame;
    for (let ty = Math.floor(oy / 16); ty <= Math.floor((oy + H) / 16); ty++)
      for (let tx = Math.floor(ox / 16); tx <= Math.floor((ox + W) / 16); tx++) {
        if (!level.water(tx, ty)) continue;
        const top = !level.water(tx, ty - 1);
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const wx = tx * 16 + x, wy = ty * 16 + y;
            if (top) {
              const wave = Math.round(Math.sin(wx * 0.35 + t * 3) * 0.8 + Math.sin(wx * 0.13 - t * 2) * 0.7);
              if (y < 1 + wave) continue;
              if (y === 1 + wave) { p.blendPx(wx, wy, WATER.foam, 0.8); continue; }
              if (y === 2 + wave) { p.blendPx(wx, wy, WATER.light, 0.6); continue; }
            }
            p.blendPx(wx, wy, wy % 5 === 0 && (wx + Math.floor(t * 8)) % 9 === 0 ? WATER.light : WATER.deep, 0.42);
          }
      }
  }

  /**
   * L'obscurité des Mines : chaque pixel s'assombrit selon la lumière la plus proche (le chevalier, les braseros
   * allumés, les cristaux, les éclats, les marchands) en cinq marches tramées, comme un éclairage pixel art. Seule la
   * couleur s'assombrit : la lueur des feux et des sorts (le tampon de lumière) reste entière.
   */
  drawDark(frame, hero, others = []) {
    if (!this.level.theme.dark) return;
    const L = [[hero.x, hero.y - 18, 96]];
    for (const f of this.fires) L.push([f.x, f.y - 24, f.lit ? 120 : 44]);
    if (this.grand) L.push([this.grand.x, this.grand.y - 30, this.grand.lit ? 170 : 60]);
    for (const c of this.crystals) L.push([c.x, c.y - 20, 62]);
    for (const s of this.shards) if (!s.got) L.push([s.x, s.y, 36]);
    for (const [x, y, r] of others) L.push([x, y, r]);
    const { w: W, h: H, color, ox, oy } = frame;
    const lights = L.filter(([x, y, r]) => x + r > ox && x - r < ox + W && y + r > oy && y - r < oy + H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let f = 0;
        for (const [lx, ly, r] of lights) {
          const dx = x + ox - lx, dy = y + oy - ly, d2 = dx * dx + dy * dy;
          if (d2 < r * r) f = Math.max(f, 1 - Math.sqrt(d2) / r);
        }
        const step = Math.min(4, Math.floor(f * 1.6 * 4 + BAYER[((y & 3) << 2) | (x & 3)]));
        if (step === 4) continue;
        const i = y * W + x, c = color[i], k = DARK[step];
        color[i] = rgb((c & 255) * k, ((c >>> 8) & 255) * k, ((c >>> 16) & 255) * k);
      }
  }
}

// une cloche de bronze au bout de sa corde, qui se balance ; quand elle sonne, une onde dorée s'élargit
function drawBell(frame, b) {
  const p = painterFor(frame), swing = Math.sin((b.t / BELL_PERIOD) * Math.PI * 2) * (b.t < 1.2 ? 3 : 1.2);
  p.rect(Math.round(b.x), b.y, 1, 6, BELL.rope);
  for (let y = 0; y < 16; y++) {
    // la cloche s'évase vers le bas ; elle penche avec son balancement
    const half = y < 3 ? 3 : Math.min(9, 3 + (y - 3) * 0.6), cx = b.x + swing * (y / 16);
    for (let x = -half; x <= half; x++) {
      const c = y === 15 ? BELL.dark : x < -half + 2 ? BELL.light : x > half - 2 ? BELL.dark : BELL.body;
      p.px(Math.round(cx + x), b.y + 6 + y, c);
    }
  }
  p.glow(b.x, b.y + 14, 16, BELL.light, 0.15);
  if (b.t < RING) {
    const u = b.t / RING, r = 18 + u * 72;
    p.ring(b.x, b.y + 14, r, 2, BELL.wave, 1 - u);
    p.glowRing(b.x, b.y + 14, r, 4, BELL.wave, 0.5 * (1 - u));
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
