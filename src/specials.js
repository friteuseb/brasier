// Les coups spéciaux. Chacun réutilise des effets pixelfx et les poses de leurs « moves », raccourcies pour un jeu de
// plateforme ; les décalages de corps des poses (x, y) sont retirés, c'est la physique qui déplace le chevalier.
// Un coup spécial avance avec step(dt, game) et renvoie des impacts { box, dmg, stop, shake, amp, push, crit }.

import { createFx, poseAt, READY } from "pixelfx";
import * as fireballThrow from "pixelfx/fx/moves/fireball-throw";
import * as meteorCall from "pixelfx/fx/moves/meteor-call";
import * as holySmite from "pixelfx/fx/moves/holy-smite";
import * as dashStrike from "pixelfx/fx/moves/dash-strike";
import * as groundPound from "pixelfx/fx/moves/ground-pound";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as blast from "pixelfx/fx/explosions/small-explosion";
import * as meteor from "pixelfx/fx/fire/meteor";
import * as smite from "pixelfx/fx/holy/smite";
import * as heal from "pixelfx/fx/holy/heal";
import * as shield from "pixelfx/fx/holy/divine-shield";
import * as slash from "pixelfx/fx/melee/sword-slash";
import * as slam from "pixelfx/fx/impacts/ground-slam";
import { knightActor } from "./knight.js";
import { TILE } from "./level.js";

const still = (q) => ({ ...q, x: 0, y: 0, ghost: q.ghost, weapon: "sword", two: false });
const track = (mod, t) => still(poseAt(mod.act.poses, t));
const around = (x, y, rx, up, down = 4) => ({ x0: x - rx, x1: x + rx, y0: y - up, y1: y + down });

/** Le sol sous (x, y) : le haut de la première case pleine ou planche, sinon y. */
export function floorBelow(level, x, y) {
  const tx = Math.floor(x / TILE);
  for (let ty = Math.floor((y - 8) / TILE); ty < Math.floor(y / TILE) + 5; ty++) if (level.solid(tx, ty) || level.oneWay(tx, ty)) return ty * TILE;
  return y;
}

// chaque coup : start(h, game) prépare l'état, step(s, dt, h, game) avance et renvoie des impacts, pose(s), done(s)
const MOVES = {
  "boule-de-feu": {
    // les poses du lancer autour de THROW (0,95 s), jouées 1,4 fois plus vite
    start: () => ({ tau: 0.7, thrown: false }),
    step(s, dt, h, game) {
      s.tau += dt * 1.4;
      if (!s.thrown && s.tau >= 0.95) {
        s.thrown = true;
        game.addProjectile(new Fireball(h.x + h.face * 26, h.y - 22, h.face));
        game.emit("cast", { x: h.x, kind: "fire" });
      }
      return [];
    },
    pose: (s) => track(fireballThrow, s.tau),
    done: (s) => s.tau >= 1.3,
  },
  meteores: {
    start: () => ({ tau: 1.0, called: false }),
    step(s, dt, h, game) {
      s.tau += dt * 1.3;
      if (!s.called && s.tau >= 1.43) {
        // le météore tombe à 7 cases devant ; il touche le sol 0,62 s après son départ
        s.called = true;
        const x = h.x + h.face * 110, y = floorBelow(game.level, x, h.y);
        game.addFx(createFx(meteor, { x, y, flip: h.face < 0, seed: 4 }));
        game.later(0.62, { box: around(x, y, 60, 56), dmg: 6, stop: 0.2, shake: 0.5, amp: 4, push: 4, sound: "boom" });
        game.emit("cast", { x: h.x, kind: "fire" });
      }
      return [];
    },
    pose: (s) => track(meteorCall, s.tau),
    done: (s) => s.tau >= 2.3,
  },
  chatiment: {
    start: () => ({ tau: -0.25, struck: false }),
    step(s, dt, h, game) {
      s.tau += dt * 1.2;
      if (!s.struck && s.tau >= 0) {
        // l'éclair vise l'ennemi le plus proche devant, à moins de 10 cases ; sinon 5 cases devant
        s.struck = true;
        const ahead = game.slimes.filter((e) => (e.x - h.x) * h.face > 0 && Math.abs(e.x - h.x) < 160 && Math.abs(e.y - h.y) < 48);
        ahead.sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x));
        const x = ahead[0]?.x ?? h.x + h.face * 80, y = ahead[0]?.y ?? floorBelow(game.level, x, h.y);
        game.addFx(createFx(smite, { x, y, seed: 9 }));
        game.later(0.47, { box: around(x, y, 28, 60), dmg: 4, stop: 0.14, shake: 0.3, amp: 3, push: 3, sound: "smite" });
        game.emit("cast", { x: h.x, kind: "holy" });
      }
      return [];
    },
    pose: (s) => track(holySmite, s.tau),
    done: (s) => s.tau >= 0.9,
  },
  soin: {
    start: () => ({ t: 0, healed: false, fx: null }),
    step(s, dt, h, game) {
      s.t += dt;
      if (!s.fx) {
        s.fx = createFx(heal, { x: h.x, y: h.y, flip: h.face < 0, actor: knightActor() });
        game.addFx(s.fx);
        game.emit("cast", { x: h.x, kind: "holy" });
      }
      s.fx.options.x = h.x;
      s.fx.options.y = h.y;
      if (!s.healed && s.t >= 0.6) {
        s.healed = true;
        h.hp = Math.min(h.maxHp, h.hp + 2);
      }
      return [];
    },
    pose: (s) => track(holySmite, Math.min(-0.05, -0.4 + s.t)),
    done: (s) => s.t >= 0.9,
  },
  bouclier: {
    start: () => ({ t: 0 }),
    step(s, dt, h, game) {
      if (s.t === 0) {
        h.shieldT = 6;
        game.addShield(createFx(shield, { x: h.x, y: h.y, flip: h.face < 0, actor: knightActor() }));
        game.emit("cast", { x: h.x, kind: "holy" });
      }
      s.t += dt;
      return [];
    },
    pose: (s) => track(holySmite, Math.min(-0.05, -0.4 + s.t * 1.5)),
    done: (s) => s.t >= 0.4,
  },
  ruee: {
    // anticipation courte, puis la ruée : 600 px/s pendant 0,16 s, sans gravité ; chaque ennemi traversé est touché une fois
    start: () => ({ tau: -0.16, hit: new Set(), slashed: false }),
    step(s, dt, h, game) {
      const t0 = s.tau;
      s.tau += dt;
      if (t0 < 0 && s.tau >= 0) game.emit("swing", { x: h.x, n: 2 });
      const out = [];
      if (s.tau >= 0 && s.tau < 0.16) {
        h.vx = h.face * 600;
        h.vy = 0;
        h.invuln = Math.max(h.invuln, 0.05);
        h.ghostly = true;
        out.push({ box: around(h.x, h.y, 14, 36), dmg: 3, stop: 0.08, shake: 0.2, amp: 2, push: 3, crit: true, once: s.hit });
      } else if (s.tau >= 0.16 && !s.slashed) {
        s.slashed = true;
        h.vx = h.face * 60;
        h.ghostly = false;
        game.addFx(createFx(slash, { x: h.x, y: h.y, flip: h.face < 0, seed: 5 }), 1.4);
      }
      return out;
    },
    pose: (s) => track(dashStrike, s.tau < 0.16 ? Math.min(s.tau, 0.13) : 0.16 + (s.tau - 0.16) * 0.8),
    done: (s) => s.tau >= 0.42,
  },
  seisme: {
    // un bond (ou rien s'il est déjà en l'air), une chute à 700 px/s, puis la frappe au sol à l'atterrissage
    start: (h) => ({ phase: h.ground ? "up" : "down", t: 0, landed: false, primed: h.ground ? false : true }),
    step(s, dt, h, game) {
      s.t += dt;
      if (s.phase === "up") {
        if (!s.primed) { h.vy = -340; h.ground = false; s.primed = true; game.emit("jump", { x: h.x }); }
        if (h.vy > -40) s.phase = "down";
      } else if (s.phase === "down") {
        h.vy = 700;
        h.vx *= 0.9;
        if (h.ground) {
          s.phase = "land";
          s.t = 0;
          game.addFx(createFx(slam, { x: h.x, y: h.y, seed: 5, reach: 80 }));
          return [{ box: around(h.x, h.y, 72, 48), dmg: 5, stop: 0.2, shake: 0.45, amp: 4, push: 4, sound: "boom", always: true }];
        }
      }
      return [];
    },
    pose: (s) => track(groundPound, s.phase === "up" ? 0.26 : s.phase === "down" ? 0.6 : 0.62 + s.t),
    done: (s) => s.phase === "land" && s.t >= 0.35,
  },
};

export class Special {
  constructor(id, hero) {
    this.id = id;
    this.m = MOVES[id];
    this.s = this.m.start(hero);
    this.done = false;
  }
  step(dt, hero, game) {
    const out = this.m.step(this.s, dt, hero, game);
    if (this.m.done(this.s)) this.done = true;
    return out;
  }
  get pose() {
    return this.m.pose(this.s) ?? READY;
  }
  /** Le chevalier reste-t-il cloué au sol pendant ce coup ? (la ruée et le séisme le déplacent eux-mêmes) */
  get rooted() {
    return this.id !== "ruee" && this.id !== "seisme";
  }
}

/** La boule de feu : elle file droit, explose contre un mur, un ennemi, ou au bout de 1,4 s. */
export class Fireball {
  constructor(x, y, dir) {
    Object.assign(this, { x, y, dir, t: 0, dead: false });
    this.fx = createFx(fireball, { x, y, flip: dir < 0, seed: 3 });
  }
  step(dt, game) {
    this.t += dt;
    this.x += this.dir * 300 * dt;
    this.fx.options.x = this.x;
    this.fx.options.y = this.y;
    this.fx.update(dt);
    const me = around(this.x, this.y + 6, 6, 12, 0);
    const wall = game.level.solid(Math.floor((this.x + this.dir * 4) / TILE), Math.floor(this.y / TILE));
    const enemy = game.slimes.some((e) => { const b = e.box(); return me.x0 < b.x1 && me.x1 > b.x0 && me.y0 < b.y1 && me.y1 > b.y0; });
    if (!(wall || enemy || this.t > 1.4)) return [];
    this.dead = true;
    const y = floorBelow(game.level, this.x, this.y + 20);
    game.addFx(createFx(blast, { x: this.x, y, size: 0.45, seed: 7 }), 1.2);
    return [{ box: around(this.x, y, 26, 44), dmg: 3, stop: 0.1, shake: 0.3, amp: 3, push: 3, sound: "boom", always: true }];
  }
  draw(frame) {
    this.fx.draw(frame);
  }
}
