// Finit les sons générés (tools/sons/brut) et les écrit dans www/sons en .ogg : on coupe le silence de tête, on garde la
// partie utile, on ajoute des fondus, on normalise le crête à -2 dB. Le crépitement devient une boucle sans raccord ;
// les braises sont des craquements isolés pris dans un crépitement. Les choix viennent de la lecture des spectrogrammes.
// node tools/sons/finish.mjs   (ffmpeg requis)

import { execFileSync } from "node:child_process";

const RATE = 44100, BRUT = "tools/sons/brut", OUT = "www/sons";

const read = (f) => {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", `${BRUT}/${f}.flac`, "-ac", "1", "-ar", RATE, "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
};
const write = (name, s) => {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", RATE, "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "5", `${OUT}/${name}.ogg`], { input: Buffer.from(s.buffer) });
  console.log(`${name}.ogg  ${(s.length / RATE).toFixed(2)} s`);
};
const sec = (t) => Math.round(t * RATE);

// le premier échantillon au-dessus d'une part rel du pic du son, un peu avant : un bruit de fond ne le déclenche pas
function onset(s, rel = 0.3, pre = 0.01) {
  let m = 0;
  for (const v of s) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > m * rel) return Math.max(0, i - sec(pre));
  return 0;
}
function shape(s, { from = 0, len, fadeIn = 0.003, fadeOut = 0.08, peak = 0.8 }) {
  const out = s.slice(from, len ? from + sec(len) : undefined);
  const fi = sec(fadeIn), fo = sec(fadeOut);
  for (let i = 0; i < fi && i < out.length; i++) out[i] *= i / fi;
  for (let i = 0; i < fo && i < out.length; i++) out[out.length - 1 - i] *= i / fo;
  let m = 0;
  for (const v of out) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / m;
  return out;
}
// une boucle : la fin se fond dans le début sur x secondes, la longueur raccourcit d'autant
function loop(s, x) {
  const n = sec(x), out = s.slice(0, s.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = s[i] * Math.sqrt(k) + s[s.length - n + i] * Math.sqrt(1 - k);
  }
  return out;
}
// les instants des craquements les plus forts, séparés d'au moins gap secondes
function pops(s, count, gap = 0.3) {
  const hop = sec(0.005), env = [];
  for (let i = 0; i < s.length; i += hop) {
    let m = 0;
    for (let j = i; j < i + hop && j < s.length; j++) m = Math.max(m, Math.abs(s[j]));
    env.push([m, i]);
  }
  const picked = [];
  for (const [, i] of env.sort((a, b) => b[0] - a[0])) {
    if (picked.every((p) => Math.abs(p - i) > sec(gap))) picked.push(i);
    if (picked.length === count) break;
  }
  return picked;
}

// le souffle de l'épée : trois variantes courtes (la quatrième sature)
[0, 1, 2].forEach((v, i) => {
  const s = read(`swing_${v}`);
  write(`swing_${i}`, shape(s, { from: onset(s), len: 0.32, fadeOut: 0.12, peak: 0.7 }));
});
// l'éclaboussure d'un slime : trois variantes
[1, 2, 3].forEach((v, i) => {
  const s = read(`splat_${v}`);
  write(`splat_${i}`, shape(s, { from: onset(s, 0.35), len: 0.5, fadeOut: 0.2 }));
});
// le brasero s'allume : la seule bonne variante, depuis son souffle
{
  const s = read("ignite_0");
  write("ignite", shape(s, { from: onset(s, 0.3, 0.05), len: 2.2, fadeIn: 0.02, fadeOut: 0.9 }));
}
// le crépitement en boucle
{
  const s = read("fire-loop_2");
  write("fire-loop", shape(loop(s.slice(sec(0.5), sec(11.5)), 1.5), { fadeIn: 0, fadeOut: 0, peak: 0.6 }));
}
// les braises : quatre craquements isolés
{
  const s = read("fire-loop_3");
  pops(s, 4).forEach((i, k) => write(`ember_${k}`, shape(s, { from: Math.max(0, i - sec(0.01)), len: 0.12, fadeOut: 0.06, peak: 0.6 })));
}
