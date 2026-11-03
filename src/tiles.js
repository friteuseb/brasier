// Le décor, dessiné en code comme les effets : un ciel, des silhouettes au loin, des blocs de pierre, des planches.
// Les couleurs viennent du thème du niveau (src/levels/*.js) ; le bois et la lune sont communs.

import { hex, mix, rand } from "pixelfx";
import { TILE } from "./level.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const C = Object.fromEntries(
  Object.entries({
    star: "#cfc8ff", moon: "#efe6c8", moonD: "#b9ab88", window: "#e8a83e", windowD: "#a0582a",
    wood: "#8a5a32", woodL: "#b9884f", woodD: "#5a3820", woodK: "#2a1810",
    crack: "#0c0a12", lightA: "#ffe9a0", lightB: "#ffc23d", lightD: "#6a5420",
  }).map(([k, v]) => [k, hex(v)]),
);
// le thème en couleurs prêtes à peindre, calculé une fois par thème
const themes = new WeakMap();
function colors(theme) {
  let T = themes.get(theme);
  if (T) return T;
  const st = Object.fromEntries(Object.entries(theme.stone).map(([k, v]) => [k, hex(v)]));
  T = { ...st, skyTop: hex(theme.sky[0]), skyLow: hex(theme.sky[1]), far: hex(theme.far[0]), farLit: hex(theme.far[1]), near: hex(theme.near[0]), nearEdge: hex(theme.near[1]), moss: theme.moss?.map(hex) };
  themes.set(theme, T);
  return T;
}

// ---- l'arrière-plan, en coordonnées d'écran, décalé par la caméra (parallaxe)
const towerAt = (i, seed) => {
  const r = rand(i, 0, seed);
  return { h: 40 + Math.floor(r * 50), w: 18 + Math.floor(rand(i, 1, seed) * 14), win: rand(i, 2, seed) > 0.45 };
};

export function drawBackdrop(frame, cam, theme) {
  const { w: W, h: H, color } = frame, T = colors(theme);
  const farX = cam.x * 0.15, nearX = cam.x * 0.4, yOff = cam.y * 0.1;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    for (let x = 0; x < W; x++) {
      const d = BAYER[((y & 3) << 2) | (x & 3)] / 16;
      let c = mix(T.skyTop, T.skyLow, Math.min(1, Math.floor(t * 5 + d) / 4));
      const sx = Math.floor(x + cam.x * 0.03), r = rand(sx, y, 91);
      if (theme.stars && r > 0.9965 && y < 110) c = mix(c, C.star, 0.3 + (r - 0.9965) * 200);
      color[y * W + x] = c;
    }
  }
  // la lune, avec un croissant d'ombre
  if (theme.moon) moon(frame, cam);
  const line = { trees: treeline, cave: cavern, nave }[theme.skyline] ?? skyline;
  line(frame, farX, 118 - yOff, 64, T.far, T.farLit, 7, false);
  line(frame, nearX, 140 - yOff, 92, T.near, T.nearEdge, 11, theme.windows);
}

// une nef : des piliers, et entre eux de hautes fenêtres en ogive garnies de vitraux (le plan proche seulement)
const GLASS = ["#3e1420", "#141e40", "#4a3a18", "#12342a", "#2a1434"].map((c) => hex(c));
function nave(frame, scroll, base, span, body, edge, seed, windows) {
  const { w: W, h: H, color } = frame;
  for (let x = 0; x < W; x++) {
    const wx = x + Math.floor(scroll), lx = ((wx % span) + span) % span, pillar = lx < 10;
    for (let y = 0; y < H; y++) {
      let c = 0;
      if (pillar) c = lx === 0 || lx === 9 ? edge : body;
      else if (y > base) c = body;
      else {
        // l'ogive : un arc brisé au sommet de la fenêtre
        const cx = 10 + (span - 10) / 2, half = (span - 10) / 2 - 6, dx = Math.abs(lx - cx), top = base - 96 + (dx * dx) / (half * 0.9);
        if (dx < half && y > top && y < base - 16) {
          if (!windows) c = edge;
          else {
            // le plomb trace un losange tous les 4 px ; chaque losange a sa couleur
            const lead = (lx + y) % 6 === 0 || (lx - y + 600) % 6 === 0 || dx > half - 1 || y < top + 1;
            c = lead ? body : GLASS[Math.floor(rand(Math.floor((lx + y) / 6), Math.floor((lx - y + 600) / 6), seed) * GLASS.length)];
          }
        }
      }
      if (c) color[y * W + x] = c;
    }
  }
}

// une caverne : des stalactites qui pendent du haut et des amas de roche en bas
function cavern(frame, scroll, base, span, body, edge, seed) {
  const { w: W, h: H, color } = frame;
  for (let x = 0; x < W; x++) {
    const wx = x + Math.floor(scroll), i = Math.floor(wx / 9), r = rand(i, 0, seed);
    // le plafond : une dent de longueur variable tous les 9 px
    const tooth = Math.max(0, 1 - Math.abs((wx % 9) - 4) / 4.5) * (10 + r * (base - 90));
    const ceil = 8 + Math.sin(wx * 0.05 + seed) * 4 + tooth;
    for (let y = 0; y < Math.min(H, ceil); y++) color[y * W + x] = y === Math.floor(ceil) - 1 ? edge : body;
    const floor = base + 6 * Math.sin(wx * 0.04 + seed) + 8 * rand(Math.floor(wx / 23), 1, seed);
    for (let y = Math.max(0, Math.floor(floor)); y < H; y++) color[y * W + x] = y === Math.floor(floor) ? edge : body;
  }
}

// une lisière de sapins et d'arbres ronds, à la place des tours
function treeline(frame, scroll, base, span, body, edge, seed) {
  const { w: W, h: H, color } = frame;
  for (let x = 0; x < W; x++) {
    const wx = x + Math.floor(scroll);
    let top = base - 10 - 3 * Math.sin(wx * 0.07);
    // chaque arbre : un sapin (pointe) ou un feuillu (dôme), de hauteur variable
    for (let i = Math.floor(wx / (span / 3)) - 1; i <= Math.floor(wx / (span / 3)) + 1; i++) {
      const cx = i * (span / 3) + rand(i, 0, seed) * 12, h = 28 + rand(i, 1, seed) * 34, w = 9 + rand(i, 2, seed) * 8, d = Math.abs(wx - cx);
      if (d > w) continue;
      const pine = rand(i, 3, seed) > 0.45, y = pine ? base - h + (d / w) * h * 0.95 : base - h * 0.75 + (d * d) / (w * w) * h * 0.45;
      top = Math.min(top, y);
    }
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) color[y * W + x] = y === Math.floor(top) ? edge : body;
  }
}

function moon(frame, cam) {
  const { w: W, color } = frame;
  const mx = 250 - Math.floor(cam.x * 0.02), my = 34;
  for (let y = -11; y <= 11; y++)
    for (let x = -11; x <= 11; x++) {
      const px = mx + x, py = my + y;
      if (px < 0 || px >= W || x * x + y * y > 110) continue;
      const lit = (x + 4) * (x + 4) + (y - 3) * (y - 3) > 70 && x > 2;
      color[py * W + px] = lit || rand(x, y, 3) > 0.93 ? C.moonD : C.moon;
    }
}

// une rangée de tours crénelées ; les plus proches ont des fenêtres éclairées
function skyline(frame, scroll, base, span, body, edge, seed, windows) {
  const { w: W, h: H, color } = frame;
  for (let x = 0; x < W; x++) {
    const wx = x + Math.floor(scroll), i = Math.floor(wx / span), lx = wx - i * span, T = towerAt(i, seed);
    const tx0 = (span - T.w) >> 1, inTower = lx >= tx0 && lx < tx0 + T.w;
    // un mur bas entre les tours, crénelé tous les 6 px
    let top = base - 14 - ((Math.floor(wx / 6) & 1) ? 0 : 3);
    if (inTower) top = base - T.h - (((lx - tx0) >> 2) & 1 ? 0 : 4);
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
      let c = y === Math.floor(top) ? edge : body;
      if (inTower && windows && T.win) {
        const wy = Math.floor(base - T.h + 12), cx = tx0 + (T.w >> 1);
        if (Math.abs(lx - cx) <= 1 && y >= wy && y < wy + 6) c = y === wy ? C.windowD : C.window;
      }
      color[y * W + x] = c;
    }
  }
}

// ---- les tuiles, en coordonnées du monde
const stoneCache = new Map();
function stoneTile(level, tx, ty) {
  const C = colors(level.theme), open = (dx, dy) => !level.solid(tx + dx, ty + dy);
  const up = open(0, -1), left = open(-1, 0), right = open(1, 0), down = open(0, 1);
  const key = `${level.def.id}${up}${left}${right}${down}${(tx * 7 + ty * 3) & 3}`;
  let t = stoneCache.get(key);
  if (t) return t;
  t = new Uint32Array(TILE * TILE);
  const v = (tx * 7 + ty * 3) & 3;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const row = y >> 3, off = (row + v) & 1 ? 8 : 0, bx = (x + off) & 15, by = y & 7;
      let c = by === 7 || bx === 0 ? C.mortar : by === 0 || bx === 1 ? C.brickL : by >= 5 || bx >= 13 ? C.brickD : C.brick;
      if (rand(x + v * 16, y, 5) > 0.93 && c !== C.mortar) c = C.brickD;
      if (left && x === 0) c = C.shade;
      if (right && x === 15) c = C.mortar;
      if (down && y === 15) c = C.mortar;
      if (up && y === 0) c = C.edge;
      else if (up && y === 1) c = C.edgeD;
      else if (up && y === 2 && C.moss && rand(x, v, 9) > 0.55) c = C.moss[rand(x, v, 4) > 0.5 ? 0 : 1];
      t[y * TILE + x] = c;
    }
  stoneCache.set(key, t);
  return t;
}

function plank(x, y) {
  // une planche de 5 px de haut, avec deux taquets dessous
  if (y === 0) return C.woodL;
  if (y < 3) return x % 8 === 7 ? C.woodK : C.wood;
  if (y === 3) return C.woodD;
  if (y === 4) return C.woodK;
  if ((x === 3 || x === 12) && y < 9) return y === 8 ? C.woodK : C.woodD;
  return 0;
}

// une dalle fragile : une pierre plate de 6 px, fendue en trois
function slab(theme, x, y) {
  const T = colors(theme);
  if (y > 5) return 0;
  if (y === 5) return T.shade;
  if (x === 5 || x === 11) return T.mortar;
  return y === 0 ? T.edge : y === 1 ? T.edgeD : y < 4 ? T.brick : T.brickD;
}
// une barricade : deux planches en croix sur trois planches debout, des clous
function barricade(x, y) {
  if (Math.abs(x - y) <= 1 || Math.abs(x + y - 15) <= 1) return Math.abs(x - y) === 0 || x + y === 15 ? C.woodL : C.wood;
  if (x % 5 === 4) return C.woodK;
  if ((x === 2 || x === 7 || x === 12) && (y === 3 || y === 12)) return C.lightD;
  return x % 5 === 0 ? C.woodL : y % 7 === 0 ? C.woodD : C.wood;
}
// un mur fissuré : la pierre, zébrée d'une fente sombre
const CRACK = new Set(["7,0", "7,1", "8,2", "8,3", "7,4", "6,5", "6,6", "7,7", "9,7", "10,8", "8,8", "7,9", "6,10", "5,11", "6,12", "7,13", "7,14", "8,15", "9,9", "11,9"]);
const cracked = (c, x, y) => (CRACK.has(`${x},${y}`) ? C.crack : c);
// une plateforme de lumière : un trait doré quand elle porte, un pointillé pâle sinon
function lightPlank(x, y, on) {
  if (y > 2) return 0;
  if (!on) return y === 1 && x % 3 === 0 ? C.lightD : 0;
  return y === 0 ? C.lightA : y === 1 ? C.lightB : x % 2 ? C.lightD : 0;
}

export function drawTiles(frame, level) {
  const { w: W, h: H, color, ox, oy } = frame;
  const tx0 = Math.floor(ox / TILE), ty0 = Math.floor(oy / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(H / TILE); ty++)
    for (let tx = tx0; tx <= tx0 + Math.ceil(W / TILE); tx++) {
      const ch = level.at(tx, ty);
      if (!"#=%X~_".includes(ch) || level.broken.has(`${tx},${ty}`) || level.crumbled.has(`${tx},${ty}`)) continue;
      // une dalle qui va tomber tremble d'un pixel
      const sh = ch === "_" && level.shaking.has(`${tx},${ty}`) ? (Math.floor(level.shaking.get(`${tx},${ty}`) * 30) % 2 ? 1 : -1) : 0;
      if (ch === "~" && !level.lightOn && Math.floor((level.time ?? 0) * 2.5) % 3) continue; // éteinte, elle se devine à peine
      const tile = ch === "#" || ch === "X" ? stoneTile(level, tx, ty) : null;
      for (let y = 0; y < TILE; y++) {
        const py = ty * TILE + y - oy;
        if (py < 0 || py >= H) continue;
        for (let x = 0; x < TILE; x++) {
          const px = tx * TILE + x - ox + sh;
          if (px < 0 || px >= W) continue;
          const c = ch === "_" ? slab(level.theme, x, y) : ch === "%" ? barricade(x, y) : ch === "~" ? lightPlank(x, y, level.lightOn) : ch === "X" ? cracked(tile[y * TILE + x], x, y) : tile ? tile[y * TILE + x] : plank(x, y);
          if (c) color[py * W + px] = c;
        }
      }
    }
}
