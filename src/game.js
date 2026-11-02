// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor, Rng } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as burst from "pixelfx/fx/pickups/collect-burst";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as critHit from "pixelfx/fx/impacts/crit-hit";
import * as poof from "pixelfx/fx/spawn/poof";
import "./font.js";
import { Embers } from "./embers.js";
import { Level, LEVEL1 } from "./level.js";
import { Hero, HW, HH } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { Slime, overlaps, GOO } from "./enemies.js";
import { drawBackdrop, drawTiles } from "./tiles.js";
import { Skills, node } from "./skills.js";
import { Special } from "./specials.js";
import { Altar } from "./altar.js";
import { drawHud } from "./hud.js";

export const W = 320, H = 180;
const STEP = 1 / 120;
const SAVE_VERSION = 1; // à augmenter quand le niveau ou le format changent
const COALS = ["#1a0806", "#2a0c0a", "#3e120e", "#561812", "#6e1e14", "#862a18", "#9a361c", "#ad4420", "#c05424"];
const FLAME = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
const KEYS = ["left", "right", "up", "down", "jump", "attack", "special", "confirm", "back"];
const ARDOR_HIT = 10, ARDOR_KILL = 20;

export function createGame() {
  const level = new Level(LEVEL1);
  const skills = new Skills();
  const hero = new Hero(level.spawn.x, level.spawn.y, skills);
  const cape = new Cape();
  const frame = createFrame(W, H);
  // les braseros : éteints, ils couvent ; allumés, ils flambent et servent de point de reprise
  const fires = level.braziers.map(([x, y], i) => ({ x, y, lit: false, fx: createFx(brazier, { x, y, seed: i + 1 }) }));
  const LIT = fires[0].fx.options.palette;
  const light = (f, on) => {
    f.lit = on;
    f.fx.options.palette = on ? LIT : COALS;
    f.fx.options.light = on ? 1 : 0.3;
  };
  // celui du départ brûle déjà : c'est le plus proche du point de départ
  const START = fires.reduce((b, f, i) => (Math.hypot(f.x - level.spawn.x, f.y - level.spawn.y) < Math.hypot(fires[b].x - level.spawn.x, fires[b].y - level.spawn.y) ? i : b), 0);
  fires.forEach((f, i) => light(f, i === START));
  let checkpoint = START, atFire = -1; // atFire : le brasero où il se tient, -1 ailleurs
  const embers = new Embers(), R = new Rng(7);
  let purse = 0; // les braises ramassées
  let streak = 0, streakT = 0; // les braises ramassées d'affilée font monter le tintement
  const toast = { text: "", t: 0 };
  let slimes = [];
  const spawnSlimes = () => (slimes = level.slimes.map(([x, y], i) => new Slime(x, y, i + 1)));
  spawnSlimes();
  // les effets ponctuels en cours ; speed fait jouer un effet plus vite
  let fxs = [], projectiles = [], later = [], shieldFx = null;
  let altar = null, prev = {};
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0, freeze = 0, shakeT = 0, shake0 = 1, amp = 0;

  const near = (x, y, m = 80) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;
  const litFireHere = () => fires.findIndex((f) => f.lit && Math.abs(hero.x - f.x) <= 12 && Math.abs(hero.y - f.y) <= 4);

  function follow(dt) {
    // la caméra regarde un peu devant le chevalier et reste dans le niveau
    cam.look += (hero.face * 36 - cam.look) * Math.min(1, dt * 2.5);
    const tx = hero.x + cam.look - W / 2, ty = hero.y - H * 0.62;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(0, Math.min(level.pxW - W, cam.x));
    cam.y = Math.max(0, Math.min(level.pxH - H, cam.y));
  }

  function kill(s) {
    game.addFx(createFx(poof, { x: s.x, y: s.y, seed: 3, palette: GOO, light: 0.6 }), 1.3);
    embers.burst(s.x, s.y - 8, s.loot, () => R.next());
    game.emit("kill", { x: s.x });
    hero.ardor = Math.min(100, hero.ardor + ARDOR_KILL);
  }

  // un impact : { box, dmg, stop, shake, amp, push, sword, stroke, crit, once, always, sound }
  function strike(imp) {
    let touched = false;
    for (const s of slimes) {
      if (s.hp <= 0 || !overlaps(imp.box, s.box()) || imp.once?.has(s)) continue;
      imp.once?.add(s);
      touched = true;
      let dmg = imp.dmg;
      // les passifs de l'épée : le troisième coup brûle plus fort, frappe en critique, et les coups enflamment
      if (imp.sword && imp.stroke === 2 && skills.has("lame-ardente")) dmg += 1;
      const crit = imp.crit || (imp.sword && imp.stroke === 2 && skills.has("critique"));
      if (imp.sword && imp.stroke === 2 && skills.has("critique")) dmg *= 2;
      if (imp.sword && skills.has("brulure")) s.burn = 3;
      if (imp.sword) hero.ardor = Math.min(100, hero.ardor + ARDOR_HIT);
      const dead = s.hit(hero.x, dmg, imp.push ?? 2);
      game.emit("hit", { x: s.x, heavy: (imp.stop ?? 0) >= 0.14 });
      game.addFx(createFx(crit ? critHit : hitSpark, { x: s.x, y: s.y, height: crit ? 14 : 10, flip: hero.x > s.x, seed: Math.floor(hero.time * 60) }));
      if (dead) kill(s);
    }
    // un coup qui porte gèle le monde et secoue l'image ; un coup dans le vide, non (sauf une explosion)
    if (touched || imp.always) {
      freeze = Math.max(freeze, imp.stop ?? 0.06);
      game.shake(imp.shake ?? 0.12, imp.amp ?? 1);
      if (imp.sound) game.emit(imp.sound, { x: (imp.box.x0 + imp.box.x1) / 2 });
    }
  }

  const game = {
    frame, hero, level, cam, skills,
    // les événements de l'image (pour les sons) : { type, x, y, ... } ; main.js les lit après step()
    events: [],
    emit(type, e = {}) { game.events.push({ type, ...e }); },
    /** 0 loin de tout feu, 1 tout près d'un brasero allumé. */
    fireNear() {
      let k = 0;
      for (const f of fires) if (f.lit) k = Math.max(k, 1 - Math.hypot(f.x - hero.x, f.y - hero.y) / 140);
      return altar ? k * 0.5 : Math.max(0, k);
    },
    get slimes() { return slimes; },
    get purse() { return purse; },
    get altarOpen() { return !!altar; },
    spend(n) { purse -= n; },
    say(text) { toast.text = text; toast.t = 2; },
    addFx(fx, speed = 1) { fxs.push({ fx, speed }); },
    addProjectile(p) { projectiles.push(p); },
    /** Un impact qui tombera dans delay secondes (le météore, l'éclair). */
    later(delay, imp) { later.push({ t: delay, imp }); },
    addShield(fx) { shieldFx?.stop(); shieldFx = fx; },
    shake(t, a) { shakeT = shake0 = Math.max(shakeT, t); amp = Math.max(amp * (shakeT > 0 ? 1 : 0), a); },

    /** Ce qu'on garde d'une partie à l'autre. */
    save() { return { v: SAVE_VERSION, purse, lit: fires.map((f) => f.lit), checkpoint, skills: skills.toJSON() }; },
    load(s) {
      // une sauvegarde d'une autre version du jeu est ignorée
      if (!s || s.v !== SAVE_VERSION) return;
      purse = s.purse ?? 0;
      skills.load(s.skills);
      fires.forEach((f, i) => light(f, !!s.lit?.[i] || i === START));
      checkpoint = Math.min(fires.length - 1, s.checkpoint ?? START);
      const f = fires[checkpoint];
      hero.spawnAt = { x: f.x, y: f.y };
      hero.reset();
      atFire = checkpoint;
    },

    // un pas de 1/120 s : le chevalier, ses coups, les ennemis, les contacts
    tick(dt, keys) {
      for (const imp of hero.step(dt, keys, level, game)) strike(imp);
      cape.step(dt, hero);
      for (const p of projectiles) for (const imp of p.step(dt, game)) strike(imp);
      projectiles = projectiles.filter((p) => !p.dead);
      for (const l of later) if ((l.t -= dt) <= 0) strike(l.imp);
      later = later.filter((l) => l.t > 0);

      for (const s of slimes) {
        if (s.hp <= 0 || !near(s.x, s.y, 200)) continue;
        s.step(dt, level);
        if (s.landed) game.emit("plop", { x: s.x });
        // la brûlure : 1 dégât par seconde, une flammèche à chaque fois
        if (s.burn > 0) {
          s.burn -= dt;
          s.burnT = (s.burnT ?? 0) + dt;
          if (s.burnT >= 1) {
            s.burnT -= 1;
            s.hp -= 1;
            s.flash = 0.08;
            game.addFx(createFx(hitSpark, { x: s.x, y: s.y, height: 12, palette: FLAME, seed: 11 }));
            if (s.hp <= 0) kill(s);
          }
        }
        const me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
        if (s.hp <= 0 || s.stun > 0 || !overlaps(me, s.box())) continue;
        if (hero.shieldT > 0) {
          // le bouclier repousse ce qui le heurte
          s.hit(hero.x, 0, 3);
          game.emit("hit", { x: s.x });
        } else if (hero.hurt(s.x)) {
          game.emit("hurt", { x: hero.x });
          freeze = 0.08;
          game.shake(0.2, 2);
        }
      }
      slimes = slimes.filter((s) => s.hp > 0);
      if (shieldFx) {
        shieldFx.options.x = hero.x;
        shieldFx.options.y = hero.y;
        shieldFx.options.flip = hero.face < 0;
        if (hero.shieldT <= 0) shieldFx.stop();
      }

      const got = embers.step(dt, level, hero);
      for (let i = 0; i < got; i++) game.emit("ember", { x: hero.x, streak: streak++ });
      if (got) streakT = 0.6;
      streakT -= dt;
      if (streakT <= 0) streak = 0;
      purse += got;
      // il réapparaît sur le brasero après une chute : ce n'est pas une visite, il ne regagne rien
      if (hero.respawned) {
        hero.respawned = false;
        game.emit("fall");
        atFire = checkpoint;
      }
      // un brasero où l'on entre s'allume, rend les cœurs et devient le point de reprise
      const here = fires.findIndex((f) => Math.abs(hero.x - f.x) <= 12 && Math.abs(hero.y - f.y) <= 4);
      if (here >= 0 && here !== atFire) {
        const f = fires[here];
        if (!f.lit) {
          light(f, true);
          game.addFx(createFx(burst, { x: f.x, y: f.y - 30, palette: FLAME, seed: here + 2 }));
          game.shake(0.15, 1);
          game.say("BRASIER ALLUMÉ");
          game.emit("ignite", { x: f.x });
        }
        checkpoint = here;
        hero.spawnAt = { x: f.x, y: f.y };
        hero.hp = hero.maxHp;
        game.onSave?.(game.save());
      }
      atFire = here;
      // plus de cœurs : retour au dernier brasero, les ennemis reviennent
      if (hero.dead) {
        hero.reset();
        atFire = checkpoint;
        spawnSlimes();
        game.say("VOUS REPRENEZ AU BRASIER");
        game.emit("death");
      }
    },

    step(dt, keys) {
      game.events.length = 0;
      const pressed = Object.fromEntries(KEYS.map((k) => [k, !!keys[k] && !prev[k]]));
      prev = { ...keys };
      toast.t = Math.max(0, toast.t - dt);
      for (const f of fires) if (near(f.x, f.y)) f.fx.update(dt);

      // l'autel ouvert : le monde attend
      if (altar) {
        altar.update(dt);
        if (altar.input(pressed, game) === "close") {
          altar = null;
          game.emit("close");
        }
        return;
      }
      // C : l'autel devant un brasero allumé, sinon le coup spécial équipé
      if (pressed.special) {
        if (litFireHere() >= 0 && !hero.busy) {
          altar = new Altar();
          game.emit("open");
          return;
        }
        const n = skills.equipped && node(skills.equipped);
        if (n && !hero.busy && hero.ardor >= n.ardor) {
          hero.ardor -= n.ardor;
          hero.special = new Special(n.id, hero);
        } else if (n) game.emit("deny");
      }

      shakeT = Math.max(0, shakeT - dt);
      // gel à l'impact : rien ne bouge, sauf les braseros (le feu ne s'arrête pas)
      if (freeze > 0) {
        freeze -= dt;
        acc = 0;
        return;
      }
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) {
        acc -= STEP;
        game.tick(STEP, keys);
      }
      for (const e of fxs) e.fx.update(dt * e.speed);
      fxs = fxs.filter((e) => !e.fx.done());
      if (shieldFx) {
        shieldFx.update(dt);
        if (shieldFx.done()) shieldFx = null;
      }
      follow(dt);
    },

    draw() {
      const k = shakeT > 0 ? amp * (shakeT / shake0) : 0, n = Math.floor(shakeT * 60);
      frame.ox = Math.round(cam.x + Math.sin(n * 2.4) * k);
      frame.oy = Math.round(cam.y + Math.cos(n * 3.7) * k * 0.7);
      frame.light.fill(0);
      drawBackdrop(frame, cam);
      for (const f of fires) if (near(f.x, f.y)) f.fx.draw(frame, "back");
      drawTiles(frame, level);
      for (const f of fires) if (near(f.x, f.y)) f.fx.draw(frame, "front");
      for (const s of slimes) if (near(s.x, s.y)) s.draw(frame);
      for (const e of fxs) e.fx.draw(frame, "back");
      shieldFx?.draw(frame, "back");
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      shieldFx?.draw(frame, "front");
      for (const e of fxs) e.fx.draw(frame, "front");
      for (const p of projectiles) p.draw(frame);
      embers.draw(painterFor(frame), hero.time);
      const at = litFireHere();
      drawHud(frame, { hp: hero.hp, maxHp: hero.maxHp, purse, toast, ardor: hero.ardor, equipped: skills.equipped, altarHint: at >= 0 && !altar ? [fires[at].x, fires[at].y] : null });
      if (altar) altar.draw(frame, game);
      return frame;
    },
  };
  return game;
}
