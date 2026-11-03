// Le Chevalier noir, gardien du dernier Grand Brasier. Il est fait comme le chevalier : le même squelette, les mêmes
// poses (poseFor), le même combo d'épée (combat.js), une cape ; armure noire, coupes teintes d'ombre. Il rejoint la liste
// des ennemis : les coups et les sorts du chevalier le touchent sans code à part.
// Il dort jusqu'à ce qu'on entre dans son arène, se dresse, puis choisit ses attaques selon la distance :
// de près le combo, de loin une ruée ou une boule d'ombre ; sous la moitié de sa vie, l'Éclipse (trois éclairs sur vous).

import { createFx, hex, mix, rgb, PAL, DUMMY_PAL, painterFor } from "pixelfx";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as smite from "pixelfx/fx/holy/smite";
import * as slash from "pixelfx/fx/melee/sword-slash";
import * as summon from "pixelfx/fx/spawn/summon-rise";
import * as poof from "pixelfx/fx/spawn/poof";
import * as dashStrike from "pixelfx/fx/moves/dash-strike";
import * as fireballThrow from "pixelfx/fx/moves/fireball-throw";
import * as holySmite from "pixelfx/fx/moves/holy-smite";
import { Attack } from "./combat.js";
import { poseFor, Cape, drawKnight } from "./knight.js";
import { track } from "./specials.js";
import { HW, HH } from "./hero.js";
import { TILE } from "./level.js";

const SHADOW = PAL.shadow, ARENA = 140, WALK = 64;
const VIOLET = hex("#a970e0"), DEEP = hex("#2c1a4a");
// l'armure noire : des plaques d'obsidienne, du violet aux jointures, une marque rouge sur la poitrine
const ARMOR = recolor({ A: "#a8a2d0", B: "#726c9c", C: "#4a4468", D: "#2e2944", E: "#7a3aa8", F: "#52267a", G: "#341648", J: "#120c1c", m: "#ff3060" });
const FLASHED = recolor({ A: "#ffffff", B: "#e8e0ff", C: "#c8b8f0", D: "#9a88c8", E: "#e0c8ff", F: "#b898e0", G: "#8060b0", J: "#4a3a6a", m: "#ffffff" });
const CAPE = ["#0a0612", "#1c0e2e", "#2e1848", "#4a2a6e"].map((c) => hex(c));
function recolor(pal) {
  return new Map(Object.entries(pal).map(([k, v]) => [hex(DUMMY_PAL[k]) >>> 0, hex(v) >>> 0]));
}
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const heroBox = (h) => ({ x0: h.x - HW, x1: h.x + HW, y0: h.y - HH, y1: h.y });

export class DarkKnight {
  constructor(x, y) {
    Object.assign(this, { x, y, home: { x, y }, face: -1, vx: 0, vy: 0, ground: true, landT: 0, stride: 0, time: 0 });
    Object.assign(this, { attack: null, special: null, hurtT: 0, invuln: 0, flash: 0, stun: 0, burn: 0, kx: 0 });
    Object.assign(this, { kind: "boss", boss: true, name: "LE CHEVALIER NOIR", hp: 50, max: 50, loot: 40, palette: SHADOW, slashPalette: SHADOW });
    Object.assign(this, { state: "dormant", st: 0, cool: 1.2, balls: [], strikes: [], combos: 0, poise: 0 });
    this.cape = new Cape(CAPE);
  }
  get pose() {
    return poseFor(this);
  }
  /** Le combat a-t-il commencé (et l'arène est-elle fermée) ? */
  get active() {
    return this.state !== "dormant";
  }
  box() {
    return { x0: this.x - 7, x1: this.x + 7, y0: this.y - 32, y1: this.y };
  }
  /**
   * Touché par le chevalier. Pendant une attaque il encaisse sans broncher ; sinon il vacille, mais au plus une fois
   * toutes les 1,5 s : un assaut continu ne le bloque pas.
   */
  hit(fromX, dmg) {
    if (this.state === "dormant") this.state = "intro";
    this.hp -= dmg;
    this.flash = 0.1;
    this.stun = 0.15;
    if (!this.attack && !this.special && this.time - this.poise > 1.5) {
      this.poise = this.time;
      this.hurtT = 0.2;
      this.kx = (this.x < fromX ? -1 : 1) * 90;
    }
    return this.hp <= 0;
  }

  step(dt, level, hero, game) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.st += dt;
    this.cape.step(dt, this);
    const hb = heroBox(hero), hurt = (x, shake = 0.2) => {
      if (hero.hurt(x)) { game.emit("hurt", { x: hero.x }); game.shake(shake, 2); }
    };

    if (this.state === "dormant") {
      if (Math.abs(hero.x - this.x) < 150 && Math.abs(hero.y - this.y) < 40) this.state = "intro";
      return;
    }
    // l'arène se ferme : le chevalier ne peut plus en sortir tant que le gardien vit
    const L = this.home.x - ARENA, R = Math.min(level.pxW - 8, this.home.x + ARENA);
    if (hero.x < L) { hero.x = L; hero.vx = Math.max(0, hero.vx); }
    if (hero.x > R) { hero.x = R; hero.vx = Math.min(0, hero.vx); }

    if (this.state === "intro") {
      if (this.st < dt * 1.5) {
        game.addFx(createFx(summon, { x: this.x, y: this.y, palette: SHADOW, seed: 6 }));
        game.say(this.name);
        game.emit("boom", { x: this.x });
        game.shake(0.5, 2);
      }
      this.face = hero.x < this.x ? -1 : 1;
      // il se dresse, l'épée levée
      this.special = { pose: track(holySmite, Math.min(-0.05, -0.42 + this.st * 0.5)) };
      if (this.st > 1.6) Object.assign(this, { state: "fight", special: null, st: 0 });
      return;
    }

    // les coups de son épée : mêmes impacts que ceux du chevalier, mais c'est le chevalier qu'ils visent
    if (this.attack) {
      this.attack.queued = true; // il enchaîne toujours les trois coups
      for (const imp of this.attack.step(dt, game)) if (overlaps(imp.box, hb)) hurt(this.x, imp.shake ?? 0.2);
      if (this.attack.done === "chain") this.attack = new Attack(this, this.attack.n + 1);
      else if (this.attack.done) { this.attack = null; this.cool = 0.9; }
    } else if (this.special?.step) {
      if (this.special.step(dt, hero, game, hurt)) { this.special = null; this.cool = 0.8; }
    } else if (this.hurtT <= 0) {
      this.face = hero.x < this.x ? -1 : 1;
      const d = Math.abs(hero.x - this.x);
      this.vx = d > 56 ? this.face * WALK : 0;
      this.cool -= dt;
      if (this.cool <= 0) this.choose(d, hero, level);
    }
    // le déplacement : sa marche, l'élan de ses coups, son recul ; il reste dans l'arène
    if (this.attack) this.vx *= Math.pow(0.02, dt);
    this.x += (this.vx + this.kx) * dt;
    this.kx *= Math.pow(0.003, dt);
    this.x = Math.max(L + 8, Math.min(R - 8, this.x));
    if (Math.abs(this.vx) > 12 && !this.attack) this.stride += Math.abs(this.vx) * dt;

    // ses boules d'ombre et les éclairs de l'Éclipse
    for (const b of this.balls) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.fx.options.x = b.x;
      b.fx.options.y = b.y;
      b.fx.update(dt);
      const wall = level.solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE));
      if (overlaps({ x0: b.x - 6, x1: b.x + 6, y0: b.y - 6, y1: b.y + 6 }, hb)) { hurt(b.x); b.dead = true; }
      if (wall || b.t > 2.5 || b.dead) {
        b.dead = true;
        game.addFx(createFx(poof, { x: b.x, y: b.y + 10, palette: SHADOW.slice(2), seed: 3 }), 1.4);
      }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    for (const s of this.strikes)
      if ((s.t -= dt) <= 0) {
        s.done = true;
        game.shake(0.25, 3);
        game.emit("smite", { x: s.x });
        if (Math.abs(hero.x - s.x) < 24 && hero.y > s.y - 60) hurt(s.x, 0.3);
      }
    this.strikes = this.strikes.filter((s) => !s.done);
  }

  // choisir une attaque : de près le combo, mais jamais deux de suite ; sinon une ruée, une boule d'ombre ou,
  // blessé, l'Éclipse
  choose(d, hero, level) {
    const r = ((this.time * 7919) % 1 + 1) % 1, angry = this.hp < this.max / 2;
    if (d < 64 && this.combos < 1) {
      this.combos++;
      this.attack = new Attack(this, 0);
      return;
    }
    this.combos = 0;
    if (angry && r < 0.35) this.special = this.eclipse(hero);
    else if (r < 0.6) this.special = this.dash();
    else this.special = this.cast(hero);
  }
  // la ruée : il s'accroupit, file à 480 px/s sur 0,22 s, et frappe tout ce qu'il traverse
  dash() {
    const me = this;
    let t = -0.38, hit = false, slashed = false;
    return {
      pose: track(dashStrike, -0.16),
      step(dt, hero, game, hurt) {
        t += dt;
        if (t < 0) this.pose = track(dashStrike, -0.16 + (t + 0.38) * 0.4);
        else if (t < 0.22) {
          if (t - dt < 0) game.emit("swing", { x: me.x, n: 2 });
          me.vx = me.face * 480;
          this.pose = track(dashStrike, Math.min(t, 0.13));
          if (!hit && overlaps({ x0: me.x - 16, x1: me.x + 16, y0: me.y - 34, y1: me.y }, heroBox(hero))) { hit = true; hurt(me.x, 0.3); }
        } else {
          me.vx = 0;
          if (!slashed) { slashed = true; game.addFx(createFx(slash, { x: me.x, y: me.y, flip: me.face < 0, palette: SHADOW, seed: 5 }), 1.4); }
          this.pose = track(dashStrike, 0.16 + (t - 0.22) * 0.8);
        }
        return t > 0.55;
      },
    };
  }
  // la boule d'ombre : le geste du lancer, puis une boule de feu violette qui file vers le chevalier
  cast(hero) {
    const me = this;
    let tau = 0.65, thrown = false;
    return {
      pose: track(fireballThrow, tau),
      step(dt, hero, game) {
        tau += dt * 1.3;
        this.pose = track(fireballThrow, tau);
        if (!thrown && tau >= 0.95) {
          thrown = true;
          const x = me.x + me.face * 24, y = me.y - 22, dx = hero.x - x, dy = hero.y - 18 - y, n = Math.hypot(dx, dy) || 1;
          me.balls.push({ x, y, vx: (dx / n) * 190, vy: (dy / n) * 190, t: 0, fx: createFx(fireball, { x, y, flip: dx < 0, palette: SHADOW, seed: 8 }) });
          game.emit("cast", { x: me.x });
        }
        return tau >= 1.35;
      },
    };
  }
  // l'Éclipse : l'épée levée, trois éclairs d'ombre tombent là où se tient le chevalier, à 0,45 s d'écart
  eclipse() {
    const me = this;
    let t = 0, n = 0;
    return {
      pose: track(holySmite, -0.05),
      step(dt, hero, game) {
        t += dt;
        if (n < 3 && t > 0.3 + n * 0.45) {
          n++;
          game.addFx(createFx(smite, { x: hero.x, y: me.home.y, palette: SHADOW, seed: 9 + n }));
          me.strikes.push({ x: hero.x, y: me.home.y, t: 0.47 });
          game.emit("cast", { x: me.x });
        }
        return t > 1.9;
      },
    };
  }

  draw(frame) {
    const p = painterFor(frame);
    // les deux rideaux d'ombre qui ferment l'arène
    if (this.active)
      for (const x of [this.home.x - ARENA - 6, this.home.x + ARENA + 6])
        for (let y = this.home.y - 80; y < this.home.y; y += 2) {
          const k = 0.5 + 0.5 * Math.sin(this.time * 4 + y * 0.2);
          p.rect(Math.round(x + Math.sin(this.time * 3 + y * 0.15) * 1.5), y, 2, 2, mix(DEEP, VIOLET, k));
          p.glow(x, y, 5, VIOLET, 0.04);
        }
    // une aura violette le détache du fond sombre
    p.glow(this.x, this.y - 18, 26, VIOLET, 0.22);
    this.cape.draw(p);
    drawKnight(frame, this, this.flash > 0 ? FLASHED : ARMOR);
    for (const b of this.balls) b.fx.draw(frame);
  }
}
