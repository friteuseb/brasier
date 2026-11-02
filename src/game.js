// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor, hex, Rng } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as burst from "pixelfx/fx/pickups/collect-burst";
import "./font.js";
import { Embers } from "./embers.js";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as poof from "pixelfx/fx/spawn/poof";
import { Level, LEVEL1 } from "./level.js";
import { Hero, HW, HH, MAX_HP } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { Slime, overlaps, GOO } from "./enemies.js";
import { drawBackdrop, drawTiles } from "./tiles.js";

export const W = 320, H = 180;
const STEP = 1 / 120;
const SAVE_VERSION = 1; // à augmenter quand le niveau ou le format changent

export function createGame() {
  const level = new Level(LEVEL1);
  const hero = new Hero(level.spawn.x, level.spawn.y);
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
  // les effets ponctuels en cours : coups d'épée, étincelles, nuages ; speed fait jouer un effet plus vite
  let fxs = [];
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0, freeze = 0, shakeT = 0, shake0 = 1, amp = 0;

  const near = (x, y, m = 80) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;

  function follow(dt) {
    // la caméra regarde un peu devant le chevalier et reste dans le niveau
    cam.look += (hero.face * 36 - cam.look) * Math.min(1, dt * 2.5);
    const tx = hero.x + cam.look - W / 2, ty = hero.y - H * 0.62;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(0, Math.min(level.pxW - W, cam.x));
    cam.y = Math.max(0, Math.min(level.pxH - H, cam.y));
  }

  const game = {
    frame, hero, level, cam,
    // les événements de l'image (pour les sons) : { type, x, y, ... } ; main.js les lit après step()
    events: [],
    emit(type, e = {}) { game.events.push({ type, ...e }); },
    /** 0 loin de tout feu, 1 tout près d'un brasero allumé. */
    fireNear() {
      let k = 0;
      for (const f of fires) if (f.lit) k = Math.max(k, 1 - Math.hypot(f.x - hero.x, f.y - hero.y) / 140);
      return Math.max(0, k);
    },
    get slimes() { return slimes; },
    get purse() { return purse; },
    say(text) { toast.text = text; toast.t = 2; },
    /** Ce qu'on garde d'une partie à l'autre. */
    save() { return { v: SAVE_VERSION, purse, lit: fires.map((f) => f.lit), checkpoint }; },
    load(s) {
      // une sauvegarde d'une autre version du jeu est ignorée
      if (!s || s.v !== SAVE_VERSION) return;
      purse = s.purse ?? 0;
      fires.forEach((f, i) => light(f, !!s.lit?.[i] || i === START));
      checkpoint = Math.min(fires.length - 1, s.checkpoint ?? START);
      const f = fires[checkpoint];
      hero.spawnAt = { x: f.x, y: f.y };
      hero.reset();
      atFire = checkpoint;
    },
    addFx(fx, speed = 1) { fxs.push({ fx, speed }); },
    shake(t, a) { shakeT = shake0 = Math.max(shakeT, t); amp = Math.max(amp * (shakeT > 0 ? 1 : 0), a); },

    // un pas de 1/120 s : le chevalier, ses coups, les ennemis, les contacts
    tick(dt, keys) {
      const impacts = hero.step(dt, keys, level, game);
      cape.step(dt, hero);
      for (const { hit, box, dmg } of impacts) {
        let touched = false;
        for (const s of slimes) {
          if (!overlaps(box, s.box())) continue;
          touched = true;
          const dead = s.hit(hero.x, dmg, hit.push ?? 2);
          game.emit("hit", { x: s.x, heavy: (hit.stop ?? 0) >= 0.14 });
          game.addFx(createFx(hitSpark, { x: s.x, y: s.y, height: 10, flip: hero.x > s.x, seed: Math.floor(hero.time * 60) }));
          // il meurt en éclaboussure de sa propre couleur, plus discrète qu'un nuage gris
          if (dead) {
            game.addFx(createFx(poof, { x: s.x, y: s.y, seed: 3, palette: GOO, light: 0.6 }), 1.3);
            embers.burst(s.x, s.y - 8, s.loot, () => R.next());
            game.emit("kill", { x: s.x });
          }
        }
        // un coup qui porte gèle le monde et secoue l'image ; un coup dans le vide, non
        if (touched) {
          freeze = Math.max(freeze, hit.stop ?? 0.06);
          game.shake(hit.shake ?? 0.12, hit.amp ?? 1);
        }
      }
      slimes = slimes.filter((s) => s.hp > 0);
      for (const s of slimes) {
        if (!near(s.x, s.y, 200)) continue;
        s.step(dt, level);
        const me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
        if (s.landed) game.emit("plop", { x: s.x });
        if (s.stun <= 0 && overlaps(me, s.box()) && hero.hurt(s.x)) {
          game.emit("hurt", { x: hero.x });
          freeze = 0.08;
          game.shake(0.2, 2);
        }
      }
      const got = embers.step(dt, level, hero);
      for (let i = 0; i < got; i++) game.emit("ember", { x: hero.x, streak: streak++ });
      if (got) streakT = 0.6;
      streakT -= dt;
      if (streakT <= 0) streak = 0;
      purse += got;
      // un brasero touché s'allume : il rend les cœurs et devient le point de reprise
      // il réapparaît sur le brasero après une chute : ce n'est pas une visite, il ne regagne rien
      if (hero.respawned) {
        hero.respawned = false;
        game.emit("fall");
        atFire = checkpoint;
      }
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
        hero.hp = MAX_HP;
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
      shakeT = Math.max(0, shakeT - dt);
      // gel à l'impact : rien ne bouge, sauf les braseros (le feu ne s'arrête pas)
      if (freeze > 0) {
        freeze -= dt;
        acc = 0;
      } else {
        acc += Math.min(dt, 0.1);
        while (acc >= STEP) {
          acc -= STEP;
          game.tick(STEP, keys);
        }
        for (const e of fxs) e.fx.update(dt * e.speed);
        fxs = fxs.filter((e) => !e.fx.done());
        follow(dt);
      }
      toast.t = Math.max(0, toast.t - dt);
      for (const f of fires) if (near(f.x, f.y)) f.fx.update(dt);
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
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      for (const e of fxs) e.fx.draw(frame, "front");
      embers.draw(painterFor(frame), hero.time);
      drawHud(frame, hero.hp, purse, toast);
      return frame;
    },
  };
  return game;
}

// l'interface : les cœurs et les braises en haut à gauche, un message au centre
const COALS = ["#1a0806", "#2a0c0a", "#3e120e", "#561812", "#6e1e14", "#862a18", "#9a361c", "#ad4420", "#c05424"];
const FLAME = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
const HEART = [".##.##.", "#hh#ll#", "#hllll#", "#lllll#", ".#lll#.", "..#l#..", "...#..."];
const HC = { "#": hex("#1a0c12"), h: hex("#ffd0d8"), l: hex("#e0303e"), e: hex("#3a2a3a") };
const EMBER = ["..#..", ".#o#.", "#oyo#", "#oyo#", ".###."];
const EC = { "#": hex("#5a1410"), o: hex("#f2561d"), y: hex("#ffe26b") };
const INK = hex("#120c18"), TEXT = hex("#f4e6c8"), GOLD = hex("#ffc23d");

function drawHud(frame, hp, purse, toast) {
  const { w: W, color, light } = frame;
  // l'interface ne prend pas la lumière du décor : on éteint la lueur sous chaque pixel qu'elle peint
  const before = color.slice();
  const unlit = () => { for (let i = 0; i < color.length; i++) if (color[i] !== before[i]) light[i] = 0; };
  const sprite = (rows, pal, ox, oy, pick) =>
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && (color[(oy + y) * W + ox + x] = pick ? pick(ch) : pal[ch])));
  for (let i = 0; i < MAX_HP; i++) sprite(HEART, HC, 6 + i * 9, 6, (ch) => (i < hp ? HC[ch] : ch === "#" ? HC["#"] : HC.e));
  sprite(EMBER, EC, 7, 16);
  const p = painterFor(frame);
  p.place(frame.ox, frame.oy);
  p.text(String(purse), 15, 15, GOLD, { font: "frmini", outline: INK });
  if (toast.t > 0) {
    const a = Math.min(1, toast.t / 0.4);
    p.text(toast.text, W / 2, 34, TEXT, { font: "fr", align: "center", outline: INK, a });
  }
  unlit();
}
