// Les gardiens des Grands Brasiers. Chacun est fait comme le chevalier : le même squelette, les mêmes poses (poseFor),
// le même combo d'épée (combat.js), une cape ; seules changent l'armure, l'arme, la teinte des coups et le répertoire
// d'attaques, décrits dans src/guardians.js. Un gardien rejoint la liste des ennemis : les coups et les sorts du chevalier
// le touchent sans code à part.
// Il dort jusqu'à ce qu'on entre dans son arène (le sol plat autour de lui), se dresse, puis choisit ses attaques selon la
// distance : de près son attaque rapprochée, de loin une attaque à distance, et sous la moitié de sa vie ses colères.

import { createFx, hex, mix, DUMMY_PAL, painterFor } from "pixelfx";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as slash from "pixelfx/fx/melee/sword-slash";
import * as summon from "pixelfx/fx/spawn/summon-rise";
import * as poof from "pixelfx/fx/spawn/poof";
import * as slam from "pixelfx/fx/impacts/ground-slam";
import * as dashStrike from "pixelfx/fx/moves/dash-strike";
import * as fireballThrow from "pixelfx/fx/moves/fireball-throw";
import * as holySmite from "pixelfx/fx/moves/holy-smite";
import * as groundPound from "pixelfx/fx/moves/ground-pound";
import { Attack } from "./combat.js";
import { poseFor, Cape, drawKnight } from "./knight.js";
import { track } from "./specials.js";
import { HW, HH } from "./hero.js";
import { TILE } from "./level.js";

const WALK = 64, MAX_ARENA = 9; // l'arène s'étend sur le sol plat, au plus 9 cases de chaque côté
const recolor = (pal) => new Map(Object.entries(pal).map(([k, v]) => [hex(DUMMY_PAL[k]) >>> 0, hex(v) >>> 0]));
const FLASHED = recolor({ A: "#ffffff", B: "#f0ecff", C: "#d0c8f0", D: "#a098c8", E: "#ffffff", F: "#e0d8ff", G: "#a090c8", J: "#4a3a6a", m: "#ffffff" });
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const heroBox = (h) => ({ x0: h.x - HW, x1: h.x + HW, y0: h.y - HH, y1: h.y });

export class Guardian {
  /** cfg : une fiche de src/guardians.js ; (x, y) : ses pieds. */
  constructor(cfg, x, y) {
    this.cfg = cfg;
    Object.assign(this, { x, y, home: { x, y }, face: -1, vx: 0, vy: 0, ground: true, landT: 0, stride: 0, time: 0 });
    Object.assign(this, { attack: null, special: null, hurtT: 0, flash: 0, stun: 0, burn: 0, kx: 0, lift: 0 });
    Object.assign(this, { kind: "boss", boss: true, name: cfg.name, hp: cfg.hp, max: cfg.hp, loot: cfg.loot ?? 40 });
    Object.assign(this, { palette: cfg.slash, slashPalette: cfg.slash, weapon: cfg.weapon });
    Object.assign(this, { state: "dormant", st: 0, cool: 1.2, balls: [], strikes: [], combos: 0, poise: 0, arena: null });
    this.armor = recolor(cfg.armor);
    this.aura = hex(cfg.aura);
    this.cape = new Cape(cfg.cape.map((c) => hex(c)));
  }
  get pose() {
    const q = poseFor(this);
    return this.weapon && q.weapon ? { ...q, weapon: this.weapon, two: this.cfg.two ?? q.two } : q;
  }
  get active() {
    return this.state !== "dormant";
  }
  box() {
    return { x0: this.x - 7, x1: this.x + 7, y0: this.y + this.lift - 32, y1: this.y + this.lift };
  }
  /** Touché : il encaisse sans broncher pendant une attaque, et ne vacille qu'une fois toutes les 1,5 s. */
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

  // l'arène : le sol plat et dégagé de part et d'autre du gardien
  measure(level) {
    const ty = Math.floor((this.home.y - 1) / TILE), tx0 = Math.floor(this.home.x / TILE);
    const flat = (tx) => level.solid(tx, ty + 1) && !level.solid(tx, ty) && !level.solid(tx, ty - 1);
    let a = tx0, b = tx0;
    while (a > tx0 - MAX_ARENA && flat(a - 1)) a--;
    while (b < tx0 + MAX_ARENA && flat(b + 1)) b++;
    this.arena = { L: a * TILE + 4, R: (b + 1) * TILE - 4 };
  }

  step(dt, level, hero, game) {
    if (!this.arena) this.measure(level);
    this.update(dt, level, hero, game);
    // la cape suit le corps, même en plein bond
    const y = this.y;
    this.y += this.lift;
    this.cape.step(dt, this);
    this.y = y;
  }

  update(dt, level, hero, game) {
    const { L, R } = this.arena, cfg = this.cfg;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.st += dt;
    const hb = heroBox(hero), hurt = (x, shake = 0.2) => {
      if (hero.hurt(x)) { game.emit("hurt", { x: hero.x }); game.shake(shake, 2); }
    };

    if (this.state === "dormant") {
      if (hero.x > L - 8 && hero.x < R + 8 && Math.abs(hero.y - this.y) < 40) this.state = "intro";
      return;
    }
    // l'arène se ferme : le chevalier ne peut plus en sortir tant que le gardien vit
    if (hero.x < L) { hero.x = L; hero.vx = Math.max(0, hero.vx); }
    if (hero.x > R) { hero.x = R; hero.vx = Math.min(0, hero.vx); }

    if (this.state === "intro") {
      if (this.st < dt * 1.5) {
        game.addFx(createFx(summon, { x: this.x, y: this.y, palette: cfg.slash, seed: 6 }));
        game.say(this.name);
        game.emit("boss-wake", { x: this.x });
        game.shake(0.5, 2);
      }
      this.face = hero.x < this.x ? -1 : 1;
      this.special = { pose: track(holySmite, Math.min(-0.05, -0.42 + this.st * 0.5)) };
      if (this.st > 1.6) Object.assign(this, { state: "fight", special: null, st: 0 });
      return;
    }

    if (this.attack) {
      this.attack.queued = true; // il enchaîne toujours les trois coups
      for (const imp of this.attack.step(dt, game)) if (overlaps(imp.box, hb)) hurt(this.x, imp.shake ?? 0.2);
      if (this.attack.done === "chain") this.attack = new Attack(this, this.attack.n + 1);
      else if (this.attack.done) { this.attack = null; this.cool = cfg.rest ?? 0.9; }
    } else if (this.special?.step) {
      if (this.special.step(dt, hero, game, hurt)) { this.special = null; this.lift = 0; this.cool = cfg.rest ?? 0.8; }
    } else if (this.hurtT <= 0) {
      this.face = hero.x < this.x ? -1 : 1;
      const d = Math.abs(hero.x - this.x);
      this.vx = d > 56 ? this.face * WALK : 0;
      this.cool -= dt;
      if (this.cool <= 0) this.choose(d, hero);
    }
    if (this.attack) this.vx *= Math.pow(0.02, dt);
    this.x += (this.vx + this.kx) * dt;
    this.kx *= Math.pow(0.003, dt);
    this.x = Math.max(L + 8, Math.min(R - 8, this.x));
    if (Math.abs(this.vx) > 12 && !this.attack) this.stride += Math.abs(this.vx) * dt;
    this.ground = this.lift > -2;

    // ses projectiles et ses frappes à retardement
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
        game.addFx(createFx(poof, { x: b.x, y: b.y + 10, palette: cfg.slash.slice(2), seed: 3 }), 1.4);
      }
    }
    this.balls = this.balls.filter((b) => !b.dead);
    for (const s of this.strikes)
      if ((s.t -= dt) <= 0) {
        s.done = true;
        game.shake(0.25, 3);
        game.emit(s.sound ?? "smite", { x: s.x });
        if (Math.abs(hero.x - s.x) < s.r && hero.y > s.y - 60) hurt(s.x, 0.3);
      }
    this.strikes = this.strikes.filter((s) => !s.done);
  }

  // de près : son attaque rapprochée, jamais deux fois de suite ; sinon une attaque à distance, ou une colère
  choose(d, hero) {
    const r = ((this.time * 7919) % 1 + 1) % 1, cfg = this.cfg, angry = this.hp < this.max / 2;
    if (d < 64 && this.combos < 1) {
      this.combos++;
      const near = cfg.near[Math.floor(r * cfg.near.length)];
      if (near === "combo") this.attack = new Attack(this, 0);
      else this.special = this.move(near, hero);
      return;
    }
    this.combos = 0;
    const list = angry ? [...cfg.far, ...cfg.angry, ...cfg.angry] : cfg.far;
    this.special = this.move(list[Math.floor(r * list.length)], hero);
  }
  move(name, hero) {
    const m = this[name](this.cfg.moves?.[name] ?? {}, hero);
    m.kind = name;
    return m;
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
          if (t - dt < 0) { game.emit("swing", { x: me.x, n: 2 }); game.emit("dash", { x: me.x }); }
          me.vx = me.face * 480;
          this.pose = track(dashStrike, Math.min(t, 0.13));
          if (!hit && overlaps({ x0: me.x - 16, x1: me.x + 16, y0: me.y - 34, y1: me.y }, heroBox(hero))) { hit = true; hurt(me.x, 0.3); }
        } else {
          me.vx = 0;
          if (!slashed) { slashed = true; game.addFx(createFx(slash, { x: me.x, y: me.y, flip: me.face < 0, palette: me.cfg.slash, seed: 5 }), 1.4); }
          this.pose = track(dashStrike, 0.16 + (t - 0.22) * 0.8);
        }
        return t > 0.55;
      },
    };
  }
  // le tir : le geste du lancer, puis count projectiles en éventail vers le chevalier (o.fx : l'effet du projectile)
  ball(o) {
    const me = this, count = o.count ?? 1, speed = o.speed ?? 190;
    let tau = 0.65, thrown = false;
    return {
      pose: track(fireballThrow, tau),
      step(dt, hero, game) {
        tau += dt * 1.3;
        this.pose = track(fireballThrow, tau);
        if (!thrown && tau >= 0.95) {
          thrown = true;
          const x = me.x + me.face * 24, y = me.y - 22, base = Math.atan2(hero.y - 18 - y, hero.x - x);
          for (let i = 0; i < count; i++) {
            const a = base + (i - (count - 1) / 2) * 0.22;
            me.balls.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0, fx: createFx(o.fx ?? fireball, { x, y, angle: a, palette: o.palette ?? me.cfg.slash, seed: 8 + i }) });
          }
          game.emit("cast", { x: me.x, kind: me.cfg.cast });
        }
        return tau >= 1.35;
      },
    };
  }
  // les frappes : l'arme levée, count effets tombent ou jaillissent là où se tient le chevalier ; chacun blesse après delay
  barrage(o) {
    const me = this, count = o.count ?? 3, gap = o.gap ?? 0.45;
    let t = 0, n = 0;
    return {
      pose: track(holySmite, -0.05),
      step(dt, hero, game) {
        t += dt;
        if (n < count && t > 0.3 + n * gap) {
          n++;
          game.addFx(createFx(o.fx, { x: hero.x, y: me.home.y, palette: o.palette ?? me.cfg.slash, seed: 9 + n }));
          me.strikes.push({ x: hero.x, y: me.home.y, t: o.delay ?? 0.47, r: o.r ?? 24, sound: o.sound });
          game.emit("cast", { x: me.x, kind: me.cfg.cast });
        }
        return t > 0.6 + count * gap;
      },
    };
  }
  // l'onde : il lève son arme 0,5 s, puis une onde jaillit à ses pieds et blesse tout ce qui est à moins de o.r px
  nova(o) {
    const me = this;
    let t = 0, fired = false;
    return {
      pose: track(holySmite, -0.3),
      step(dt, hero, game) {
        t += dt;
        this.pose = track(holySmite, Math.min(0.47, -0.3 + t * 0.6));
        if (!fired && t > 0.5) {
          fired = true;
          game.addFx(createFx(o.fx, { x: me.x, y: me.y, palette: o.palette ?? me.cfg.slash, seed: 4 }));
          me.strikes.push({ x: me.x, y: me.home.y, t: o.delay ?? 0.3, r: o.r ?? 64, sound: me.cfg.cast === "ice" ? "ice" : "quake" });
        }
        return t > 1.3;
      },
    };
  }
  // le bond : il s'accroupit, saute vers le chevalier et retombe en écrasant le sol ; il faut sauter pour l'éviter
  leap(o) {
    const me = this;
    let t = 0, phase = "coil", x0 = 0, x1 = 0;
    return {
      pose: track(groundPound, -0.16),
      step(dt, hero, game, hurt) {
        t += dt;
        if (phase === "coil") {
          this.pose = track(groundPound, Math.min(0, -0.16 + t * 0.5));
          if (t > 0.35) { phase = "air"; t = 0; x0 = me.x; x1 = Math.max(me.arena.L + 8, Math.min(me.arena.R - 8, hero.x)); game.emit("jump", { x: me.x }); }
        } else if (phase === "air") {
          const u = Math.min(1, t / 0.7);
          me.x = x0 + (x1 - x0) * u;
          me.lift = -90 * 4 * u * (1 - u);
          this.pose = track(groundPound, u < 0.5 ? 0.26 : 0.6);
          if (u >= 1) {
            phase = "land"; t = 0; me.lift = 0;
            game.addFx(createFx(o.fx ?? slam, { x: me.x, y: me.y, palette: o.palette, seed: 5, reach: 80 }));
            game.shake(0.45, 4);
            game.emit("quake", { x: me.x });
            // l'onde court au sol : en l'air, on y échappe
            if (hero.ground && Math.abs(hero.x - me.x) < (o.r ?? 76)) hurt(me.x, 0.4);
          }
        } else this.pose = track(groundPound, 0.62 + t);
        return phase === "land" && t > 0.45;
      },
    };
  }

  draw(frame) {
    const p = painterFor(frame), a = this.arena, glow = this.aura;
    if (this.active && a)
      for (const x of [a.L - 6, a.R + 6])
        for (let y = this.home.y - 80; y < this.home.y; y += 2) {
          const k = 0.5 + 0.5 * Math.sin(this.time * 4 + y * 0.2);
          p.rect(Math.round(x + Math.sin(this.time * 3 + y * 0.15) * 1.5), y, 2, 2, mix(hex(this.cfg.cape[1]), glow, k));
          p.glow(x, y, 5, glow, 0.04);
        }
    // une aura le détache du décor
    p.glow(this.x, this.y + this.lift - 18, 26, glow, 0.22);
    const y = this.y;
    this.y += this.lift;
    this.cape.draw(p);
    drawKnight(frame, this, this.flash > 0 ? FLASHED : this.armor);
    this.y = y;
    for (const b of this.balls) b.fx.draw(frame);
  }
}
