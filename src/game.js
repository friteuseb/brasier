// Le jeu sans navigateur : un état, step(dt, keys) et draw(). main.js l'affiche, tools/shot.mjs le photographie.

import { createFrame, createFx, painterFor, Rng, hex } from "pixelfx";
import * as brazier from "pixelfx/fx/fire/brazier";
import * as burst from "pixelfx/fx/pickups/collect-burst";
import * as hitSpark from "pixelfx/fx/impacts/hit-spark";
import * as critHit from "pixelfx/fx/impacts/crit-hit";
import * as poof from "pixelfx/fx/spawn/poof";
import "./font.js";
import { Embers } from "./embers.js";
import { Level } from "./level.js";
import { FIRST, place } from "./levels/index.js";
import { WorldMap, drawSummary } from "./screens.js";
import * as burnAway from "pixelfx/fx/transitions/burn-away";
import * as flamePillar from "pixelfx/fx/fire/flame-pillar";
import * as poisonCloud from "pixelfx/fx/nature/poison-cloud";
import * as shardFx from "pixelfx/fx/pickups/crystal-shard";
import * as fireflies from "pixelfx/fx/weather/fireflies";
import * as leaves from "pixelfx/fx/weather/falling-leaves";
import * as rain from "pixelfx/fx/weather/rain";

// la météo d'un niveau : un effet pixelfx de la taille de l'écran, derrière le décor
const WEATHER = { fireflies, leaves, rain };
import { Hero, HW, HH } from "./hero.js";
import { Cape, drawKnight } from "./knight.js";
import { KINDS, overlaps, GOO } from "./enemies.js";
import { Merchant } from "./shop.js";
import { drawBackdrop, drawTiles } from "./tiles.js";
import { Skills, node } from "./skills.js";
import { Special } from "./specials.js";
import { Altar } from "./altar.js";
import { drawHud } from "./hud.js";

export const W = 320, H = 180;
const STEP = 1 / 120;
const SAVE_VERSION = 2; // à augmenter quand le format change ; load() reprend la version 1
const COALS = ["#1a0806", "#2a0c0a", "#3e120e", "#561812", "#6e1e14", "#862a18", "#9a361c", "#ad4420", "#c05424"];
const FLAME = ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"];
const KEYS = ["left", "right", "up", "down", "jump", "attack", "special", "cycle", "confirm", "back"];
const ARDOR_HIT = 10, ARDOR_KILL = 20;

export function createGame() {
  const skills = new Skills();
  const hero = new Hero(0, 0, skills);
  const cape = new Cape();
  const frame = createFrame(W, H);
  const embers = new Embers(), R = new Rng(7);
  let purse = 0; // les braises ramassées
  let streak = 0, streakT = 0; // les braises ramassées d'affilée font monter le tintement
  const toast = { text: "", t: 0 };
  // la progression : pour chaque niveau, terminé ou non, ses braseros allumés et le dernier visité
  let progress = {}, current = FIRST;
  // ce qui appartient au niveau en cours : enter() le refait
  let level, fires, START, checkpoint, atFire, enemies, merchants, grand, stats, poisons, shards, weather;
  const shardTotal = () => Object.values(progress).reduce((n, p) => n + (p.shards?.length ?? 0), 0);
  // les effets ponctuels en cours ; speed fait jouer un effet plus vite
  let fxs = [], projectiles = [], later = [], shieldFx = null;
  // mode : "play", "summary" (bilan) ou "map" (carte du royaume) ; trans : la transition d'écran en cours
  let mode = "play", altar = null, map = null, summaryT = 0, trans = null, prev = {};
  const cam = { x: 0, y: 0, look: 0 };
  let acc = 0, freeze = 0, shakeT = 0, shake0 = 1, amp = 0;
  // les braseros : éteints, ils couvent ; allumés, ils flambent et servent de point de reprise
  const LIT = brazier.meta.options.palette;
  const light = (f, on) => {
    f.lit = on;
    f.fx.options.palette = on ? LIT : COALS;
    f.fx.options.light = on ? 1 : 0.3;
  };
  const spawnEnemies = () => (enemies = level.foes.map(([ch, x, y], i) => new KINDS[ch](x, y, i + 1)));

  /** Entrer dans un niveau : au dernier brasero visité, ou au départ. */
  function enter(id) {
    current = id;
    const node = place(id), pr = (progress[id] ??= { done: false, lit: [], checkpoint: null });
    pr.shards ??= [];
    level = new Level(node.def);
    fires = level.braziers.map(([x, y], i) => ({ x, y, lit: false, fx: createFx(brazier, { x, y, seed: i + 1 }) }));
    // celui du départ brûle déjà : c'est le plus proche du point de départ
    const sp = level.spawn, dist = (f) => Math.hypot(f.x - sp.x, f.y - sp.y);
    START = fires.length ? fires.reduce((b, f, i) => (dist(f) < dist(fires[b]) ? i : b), 0) : -1;
    fires.forEach((f, i) => light(f, i === START || !!pr.lit[i]));
    checkpoint = pr.checkpoint ?? START;
    atFire = checkpoint;
    const at = fires[checkpoint] ?? sp;
    hero.spawnAt = { x: at.x, y: at.y };
    hero.reset();
    spawnEnemies();
    merchants = level.merchants.map(([x, y], i) => new Merchant(x, y, i + 1));
    grand = level.grand && { x: level.grand[0], y: level.grand[1], lit: false, used: false, t: 0, fx: createFx(brazier, { x: level.grand[0], y: level.grand[1] - PED, seed: 99 }) };
    if (grand) light(grand, pr.done);
    poisons = level.poisons.map(([x, y], i) => ({ x, y, fx: createFx(poisonCloud, { x, y, seed: i + 2 }) }));
    // un éclat déjà ramassé ne revient pas ; tous les 3 éclats, un cœur de plus
    shards = level.shards.map(([x, y], i) => ({ x, y, i, got: pr.shards.includes(i), fx: createFx(shardFx, { x, y: y + 14, seed: i + 5 }) }));
    hero.bonusHp = Math.floor(shardTotal() / 3);
    const wmod = WEATHER[level.theme.weather];
    weather = wmod && createFx(wmod, { seed: 3 });
    hero.oathT = 0;
    fxs = []; projectiles = []; later = []; shieldFx = null; embers.list = []; altar = null;
    cam.x = Math.max(0, Math.min(level.pxW - W, hero.x - W / 2));
    cam.y = Math.max(0, Math.min(level.pxH - H, hero.y - H * 0.62));
    stats = { name: node.name, embers: 0, kills: 0, foes: enemies.length, time: 0, shards: pr.shards.length, shardsMax: shards.length };
    mode = "play";
  }
  /** Une transition d'écran : les flammes couvrent l'écran, then() change ce qu'il y a dessous, puis elles s'ouvrent. */
  function transition(then) {
    trans = { fx: createFx(burnAway, { seed: 3 }), t: 0, swapped: false, then };
    game.emit("ignite");
  }
  function toMap() {
    mode = "map";
    map = new WorldMap(current);
    game.onSave?.(game.save());
  }

  const near = (x, y, m = 80) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m * 2;
  const merchantHere = () => merchants.find((m) => m.reach(hero));

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
    // le slime meurt en éclaboussure verte, les autres en nuage de leur couleur
    const palette = s.kind === "slime" ? GOO : s.palette.slice(1);
    game.addFx(createFx(poof, { x: s.x, y: s.kind === "slime" || s.kind === "snake" ? s.y : s.y + 10, seed: 3, palette, light: 0.6 }), 1.3);
    embers.burst(s.x, s.y - 8, s.loot, () => R.next());
    game.emit("kill", { x: s.x });
    hero.ardor = Math.min(100, hero.ardor + ARDOR_KILL);
    stats.kills++;
  }

  // un impact : { box, dmg, stop, shake, amp, push, sword, stroke, crit, once, always, sound }
  function strike(imp) {
    let touched = false;
    for (const s of enemies) {
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
    // les passages d'école : le feu brûle les barricades, le séisme brise les murs fissurés
    const fire = imp.fire || (imp.sword && skills.has("lame-ardente"));
    if (fire) for (const [x, y] of level.breakIn("%", imp.box)) {
      game.addFx(createFx(poof, { x, y: y + 8, seed: 5, palette: ["#1a0f0a", "#3a2418", "#6a4a30", "#9a7a58"] }), 1.2);
      game.addFx(createFx(hitSpark, { x, y: y + 8, height: 8, palette: FLAME, seed: 7 }));
      game.emit("ignite", { x });
      touched = true;
    }
    if (imp.quake) for (const [x, y] of level.breakIn("X", imp.box)) {
      game.addFx(createFx(poof, { x, y: y + 8, seed: 6, palette: ["#16131f", "#2c273d", "#4f4669", "#7b6f9c"] }), 1.2);
      game.emit("boom", { x });
      touched = true;
    }
    // un coup qui porte gèle le monde et secoue l'image ; un coup dans le vide, non (sauf une explosion)
    if (touched || imp.always) {
      freeze = Math.max(freeze, imp.stop ?? 0.06);
      game.shake(imp.shake ?? 0.12, imp.amp ?? 1);
      if (imp.sound) game.emit(imp.sound, { x: (imp.box.x0 + imp.box.x1) / 2 });
    }
  }

  // la transition se dessine par-dessus tout, à l'écran
  function drawTransition() {
    if (!trans) return;
    const [ox, oy] = burnAway.meta.origin;
    trans.fx.options.x = frame.ox + ox;
    trans.fx.options.y = frame.oy + oy;
    trans.fx.draw(frame);
  }

  const game = {
    frame, hero, cam, skills,
    get level() { return level; },
    get mode() { return mode; },
    // les événements de l'image (pour les sons) : { type, x, y, ... } ; main.js les lit après step()
    events: [],
    emit(type, e = {}) { game.events.push({ type, ...e }); },
    /** 0 loin de tout feu, 1 tout près d'un brasero allumé. */
    fireNear() {
      let k = 0;
      for (const f of fires) if (f.lit) k = Math.max(k, 1 - Math.hypot(f.x - hero.x, f.y - hero.y) / 140);
      if (grand?.lit) k = Math.max(k, 1 - Math.hypot(grand.x - hero.x, grand.y - hero.y) / 200);
      return mode !== "play" ? 0 : altar ? k * 0.5 : Math.max(0, k);
    },
    get enemies() { return enemies; },
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

    /** Ce qu'on garde d'une partie à l'autre : braises, arbre, progression, et où l'on en est. */
    save() {
      if (progress[current] && mode === "play") Object.assign(progress[current], { lit: fires.map((f) => f.lit), checkpoint });
      return { v: SAVE_VERSION, purse, skills: skills.toJSON(), progress, current, where: mode === "map" ? "map" : "level" };
    },
    load(s) {
      if (!s) return;
      // la version 1 ne connaissait qu'un niveau, les Remparts
      if (s.v === 1) s = { purse: s.purse, skills: s.skills, progress: { remparts: { done: false, lit: s.lit ?? [], checkpoint: s.checkpoint ?? null } }, current: "remparts", where: "level" };
      else if (s.v !== SAVE_VERSION) return;
      purse = s.purse ?? 0;
      skills.load(s.skills);
      progress = s.progress ?? {};
      if (s.where === "map") { current = place(s.current) ? s.current : FIRST; toMap(); }
      else enter(place(s.current)?.def ? s.current : FIRST);
    },

    // un pas de 1/120 s : le chevalier, ses coups, les ennemis, les contacts
    tick(dt, keys) {
      for (const imp of hero.step(dt, keys, level, game)) strike(imp);
      cape.step(dt, hero);
      for (const p of projectiles) for (const imp of p.step(dt, game)) strike(imp);
      projectiles = projectiles.filter((p) => !p.dead);
      for (const l of later) if ((l.t -= dt) <= 0) strike(l.imp);
      later = later.filter((l) => l.t > 0);

      for (const m of merchants) m.step(dt, hero);
      // les plateformes de lumière portent tant que dure la grâce du Serment
      hero.oathT = Math.max(0, (hero.oathT ?? 0) - dt);
      level.lightOn = hero.oathT > 0 || hero.shieldT > 0;
      level.time = (level.time ?? 0) + dt;
      // le poison : une nappe au sol qui blesse qui la traverse
      const me = { x0: hero.x - HW, x1: hero.x + HW, y0: hero.y - HH, y1: hero.y };
      for (const p of poisons)
        if (overlaps(me, { x0: p.x - 40, x1: p.x + 40, y0: p.y - 20, y1: p.y }) && hero.hurt(p.x)) {
          game.emit("hurt", { x: hero.x });
          game.shake(0.15, 1);
        }
      // les éclats de brasier
      for (const s of shards)
        if (!s.got && overlaps(me, { x0: s.x - 9, x1: s.x + 9, y0: s.y - 12, y1: s.y + 10 })) {
          s.got = true;
          progress[current].shards.push(s.i);
          stats.shards++;
          const total = shardTotal();
          hero.bonusHp = Math.floor(total / 3);
          if (total % 3 === 0) hero.hp = hero.maxHp;
          game.say(total % 3 === 0 ? "UN CŒUR DE PLUS !" : `ÉCLAT DE BRASIER  ${total % 3} / 3`);
          game.addFx(createFx(burst, { x: s.x, y: s.y + 10, palette: FLAME, seed: 9 }));
          game.emit("learn", { x: s.x });
          game.onSave?.(game.save());
        }
      for (const s of enemies) {
        if (s.hp <= 0 || !near(s.x, s.y, 200)) continue;
        s.step(dt, level, hero);
        if (s.landed) game.emit("plop", { x: s.x });
        // les attaques des monstres s'entendent : plongeon, charge, morsure
        for (const [flag, sound] of [["swooped", "swoop"], ["charged", "charge"], ["struck", "lunge"]])
          if (s[flag]) { s[flag] = false; game.emit(sound, { x: s.x }); }
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
      enemies = enemies.filter((s) => s.hp > 0);
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
      stats.embers += got;
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
        progress[current].lit[here] = true;
        checkpoint = here;
        hero.spawnAt = { x: f.x, y: f.y };
        hero.hp = hero.maxHp;
        game.onSave?.(game.save());
      }
      atFire = here;
      // le Grand Brasier : le rallumer termine le niveau ; le bilan suit 2,2 s plus tard
      if (grand && !grand.used && Math.abs(hero.x - grand.x) < 18 && Math.abs(hero.y - grand.y) < 6) {
        grand.used = true;
        if (!grand.lit) light(grand, true);
        game.addFx(createFx(flamePillar, { x: grand.x, y: grand.y - PED, seed: 4 }));
        game.shake(0.6, 3);
        game.say("GRAND BRASIER RALLUMÉ");
        game.emit("ignite", { x: grand.x });
        game.emit("boom", { x: grand.x });
        progress[current].done = true;
        game.onSave?.(game.save());
      }
      if (grand?.used && (grand.t += dt) >= 2.2 && !trans && mode === "play") transition(() => { mode = "summary"; summaryT = 0; });
      // plus de cœurs : retour au dernier brasero, les ennemis reviennent
      if (hero.dead) {
        hero.reset();
        atFire = checkpoint;
        spawnEnemies();
        game.say("VOUS REPRENEZ AU BRASIER");
        game.emit("death");
      }
    },

    step(dt, keys) {
      game.events.length = 0;
      // pendant une transition, les touches ne comptent pas
      if (trans) keys = {};
      const pressed = Object.fromEntries(KEYS.map((k) => [k, !!keys[k] && !prev[k]]));
      prev = { ...keys };
      if (trans) {
        trans.t += dt;
        trans.fx.update(dt);
        if (!trans.swapped && trans.t >= 1.4) { trans.swapped = true; trans.then(); }
        if (trans.fx.done()) trans = null;
      }
      toast.t = Math.max(0, toast.t - dt);
      if (mode === "summary") {
        summaryT += dt;
        if (summaryT > 1.5 && !trans && (pressed.attack || pressed.confirm || pressed.jump)) transition(toMap);
        return;
      }
      if (mode === "map") {
        map.update(dt);
        const id = trans ? null : map.input(pressed, progress, game.emit);
        if (id) transition(() => enter(id));
        return;
      }
      stats.time += dt;
      for (const f of fires) if (near(f.x, f.y)) f.fx.update(dt);
      for (const p of poisons) if (near(p.x, p.y)) p.fx.update(dt);
      for (const s of shards) if (!s.got && near(s.x, s.y)) s.fx.update(dt);
      if (grand && near(grand.x, grand.y)) grand.fx.update(dt);
      weather?.update(dt);

      // l'autel ouvert : le monde attend
      if (altar) {
        altar.update(dt);
        if (altar.input(pressed, game) === "close") {
          altar = null;
          game.emit("close");
        }
        return;
      }
      // V : passer au coup spécial suivant parmi ceux qu'on a appris
      if (pressed.cycle) {
        const id = skills.cycle();
        if (id) {
          game.emit("equip");
          game.say(node(id).name.toUpperCase());
        }
      }
      // C : l'échoppe devant un marchand, sinon le coup spécial équipé
      if (pressed.special) {
        if (merchantHere() && !hero.busy) {
          altar = new Altar();
          game.emit("open");
          return;
        }
        const n = skills.equipped && node(skills.equipped);
        if (n && !hero.busy && hero.ardor >= n.ardor) {
          hero.ardor -= n.ardor;
          hero.special = new Special(n.id, hero);
          // un sort du Serment fait apparaître les plateformes de lumière pour 8 s
          if (n.branch.id === "serment") hero.oathT = 8;
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
      if (mode !== "play") {
        frame.ox = frame.oy = 0;
        if (mode === "summary") drawSummary(frame, stats, summaryT);
        else map.draw(frame, progress);
        drawTransition();
        return frame;
      }
      const k = shakeT > 0 ? amp * (shakeT / shake0) : 0, n = Math.floor(shakeT * 60);
      frame.ox = Math.round(cam.x + Math.sin(n * 2.4) * k);
      frame.oy = Math.round(cam.y + Math.cos(n * 3.7) * k * 0.7);
      frame.light.fill(0);
      drawBackdrop(frame, cam, level.theme);
      if (weather) {
        const [wx, wy] = weather.meta.origin;
        weather.options.x = frame.ox + wx;
        weather.options.y = frame.oy + wy;
        weather.draw(frame);
      }
      for (const f of fires) if (near(f.x, f.y)) f.fx.draw(frame, "back");
      drawTiles(frame, level);
      for (const f of fires) if (near(f.x, f.y)) f.fx.draw(frame, "front");
      for (const s of shards) if (!s.got && near(s.x, s.y)) s.fx.draw(frame);
      if (grand && near(grand.x, grand.y)) drawGrand(frame, grand, level.theme);
      const p = painterFor(frame);
      for (const m of merchants) if (near(m.x, m.y)) { m.drawBack(frame, p.place(0, 0)); m.drawMage(frame); m.drawFront(frame, painterFor(frame)); }
      for (const s of enemies) if (near(s.x, s.y)) s.draw(frame);
      for (const e of fxs) e.fx.draw(frame, "back");
      shieldFx?.draw(frame, "back");
      cape.draw(painterFor(frame));
      drawKnight(frame, hero);
      shieldFx?.draw(frame, "front");
      for (const e of fxs) e.fx.draw(frame, "front");
      for (const p of projectiles) p.draw(frame);
      for (const p of poisons) if (near(p.x, p.y)) p.fx.draw(frame);
      embers.draw(painterFor(frame), hero.time);
      const at = merchantHere();
      drawHud(frame, { hp: hero.hp, maxHp: hero.maxHp, purse, toast, ardor: hero.ardor, equipped: skills.equipped, specials: [...skills.owned].filter((id) => node(id).ardor).length, altarHint: at && !altar ? [at.x, at.y] : null });
      if (altar) altar.draw(frame, game);
      drawTransition();
      return frame;
    },
  };
  enter(FIRST);
  return game;
}

// le Grand Brasier : un socle de pierre de deux cases sous un brasero
const PED = 18;
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
