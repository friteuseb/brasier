// Le navigateur : clavier, boucle d'animation, affichage agrandi au pixel près.

import { composite } from "pixelfx";
import { createGame, W, H } from "./game.js";
import * as audio from "./audio.js";
import { setupTouch, isTouch } from "./touch.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = W;
canvas.height = H;
const img = new ImageData(W, H);

// QWERTY et AZERTY : flèches, WASD ou ZQSD ; « Touch:… » sont les boutons tactiles (src/touch.js)
const KEYS = {
  left: ["ArrowLeft", "KeyA", "KeyQ", "Touch:left"],
  right: ["ArrowRight", "KeyD", "Touch:right"],
  jump: ["Space", "ArrowUp", "KeyW", "KeyZ", "Touch:jump"],
  attack: ["KeyX", "KeyJ", "Touch:attack"],
  special: ["KeyC", "KeyK", "Touch:special"],
  cycle: ["KeyV", "KeyL", "Touch:cycle"],
  up: ["ArrowUp", "KeyW", "KeyZ", "Touch:up"],
  down: ["ArrowDown", "KeyS", "Touch:down"],
  confirm: ["Enter"],
  back: ["Escape"],
  help: ["KeyH", "Touch:help"],
};
// une touche tapée plus vite qu'une image compte quand même : on la garde jusqu'à la fin de l'image suivante
const down = new Set(), tapped = new Set();
const keys = {};
const sync = () => { for (const [k, codes] of Object.entries(KEYS)) keys[k] = codes.some((c) => down.has(c) || tapped.has(c)); };
addEventListener("keydown", (e) => {
  // le navigateur n'ouvre le son qu'après un geste ; M coupe et rend le son
  audio.unlock();
  if (e.code === "KeyM" && !e.repeat) game.say(audio.toggleMute() ? "SON COUPÉ" : "SON RÉTABLI");
  if (e.code === "KeyN" && !e.repeat) game.say(audio.toggleMusic() ? "MUSIQUE COUPÉE" : "MUSIQUE RÉTABLIE");
  if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
  down.add(e.code);
  tapped.add(e.code);
  sync();
});
addEventListener("keyup", (e) => { down.delete(e.code); sync(); });
setupTouch({
  press: (code) => { down.add(code); tapped.add(code); sync(); },
  release: (code) => { down.delete(code); sync(); },
  onFirst: () => audio.unlock(),
  onMute: () => game.say(audio.toggleMute() ? "SON COUPÉ" : "SON RÉTABLI"),
});
addEventListener("blur", () => { down.clear(); sync(); });

// agrandi au pixel près ; sur un petit écran (moins de 2 fois), on remplit quand même l'espace
function fit() {
  const free = Math.min(innerWidth / W, innerHeight / H), k = free >= 2 ? Math.floor(free) : Math.max(1, free);
  canvas.style.width = `${W * k}px`;
  canvas.style.height = `${H * k}px`;
}
addEventListener("resize", fit);
fit();

const game = createGame();
game.touch = isTouch();
// la partie se garde dans le navigateur à chaque brasero ; un stockage refusé n'empêche pas de jouer
const SAVE = "brasier.save";
try { game.load(JSON.parse(localStorage.getItem(SAVE))); } catch {}
// l'accueil et le rappel des touches, à chaque lancement
game.showHelp(true);
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(game.save())); } catch {} };
game.onSave = store;
addEventListener("visibilitychange", () => document.hidden && store());
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.step(dt, keys);
  audio.play(game.events, game.cam, W);
  audio.fireLevel(game.fireNear());
  audio.music(game.music);
  tapped.clear();
  sync();
  composite(game.draw(), img.data, null);
  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
