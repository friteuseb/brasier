// Les outils communs aux scripts de sons : lire un son en échantillons, le découper, l'écrire en .ogg (ffmpeg requis).

import { execFileSync } from "node:child_process";

export const RATE = 44100, BRUT = "tools/sons/brut", OUT = "www/sons";

export const read = (f) => {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", `${BRUT}/${f}.flac`, "-ac", "1", "-ar", RATE, "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
};
export const write = (name, s, dir = OUT) => {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", RATE, "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "5", `${dir}/${name}.ogg`], { input: Buffer.from(s.buffer) });
  console.log(`${name}.ogg  ${(s.length / RATE).toFixed(2)} s`);
};
export const sec = (t) => Math.round(t * RATE);

// le premier échantillon au-dessus d'une part rel du pic du son, un peu avant : un bruit de fond ne le déclenche pas
export function onset(s, rel = 0.3, pre = 0.01) {
  let m = 0;
  for (const v of s) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > m * rel) return Math.max(0, i - sec(pre));
  return 0;
}
export function shape(s, { from = 0, len, fadeIn = 0.003, fadeOut = 0.08, peak = 0.8 }) {
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
export function loop(s, x) {
  const n = sec(x), out = s.slice(0, s.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = s[i] * Math.sqrt(k) + s[s.length - n + i] * Math.sqrt(1 - k);
  }
  return out;
}
// les instants des craquements les plus forts, séparés d'au moins gap secondes
export function pops(s, count, gap = 0.3) {
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

// la fin utile d'un son : là où l'enveloppe retombe sous rel de son pic pour de bon, au plus max secondes après from
export function end(s, from, rel = 0.05, max = 0.6) {
  let m = 0;
  for (let i = from; i < s.length; i++) m = Math.max(m, Math.abs(s[i]));
  const hop = sec(0.01), stop = Math.min(s.length, from + sec(max));
  let last = from + hop;
  for (let i = from; i < stop; i += hop) {
    let v = 0;
    for (let j = i; j < i + hop && j < s.length; j++) v = Math.max(v, Math.abs(s[j]));
    if (v > m * rel) last = i + hop;
  }
  return last;
}
