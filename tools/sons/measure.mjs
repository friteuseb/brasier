// Mesure les variantes brutes d'un son pour en proposer une sans l'écouter : saturation (part des échantillons au-dessus
// de 0,98), silence (part des fenêtres de 50 ms sous 2 % du pic), niveau moyen (RMS) et, pour une musique, la régularité
// du niveau (écart des RMS par fenêtre de 1 s). Écarte les saturées et les trop silencieuses, garde la plus forte
// (bruitage) ou la plus régulière (musique).
// node tools/sons/measure.mjs nom...   affiche le tableau et la proposition

import { readdirSync } from "node:fs";
import { read, sec, BRUT } from "./lib.mjs";

export function measure(name) {
  const s = read(name);
  let peak = 0, clip = 0, sum = 0;
  for (const v of s) { const a = Math.abs(v); peak = Math.max(peak, a); if (a > 0.98) clip++; sum += v * v; }
  const win = (len) => { const out = []; for (let i = 0; i + len <= s.length; i += len) { let e = 0; for (let j = i; j < i + len; j++) e += s[j] * s[j]; out.push(Math.sqrt(e / len)); } return out; };
  const w50 = win(sec(0.05)), quiet = w50.filter((v) => v < peak * 0.02).length / w50.length;
  const w1 = win(sec(1)), mean = w1.reduce((a, b) => a + b, 0) / w1.length;
  const spread = Math.sqrt(w1.reduce((a, b) => a + (b - mean) ** 2, 0) / w1.length) / (mean || 1);
  return { name, peak, clip: clip / s.length, quiet, rms: Math.sqrt(sum / s.length), spread };
}

export function pick(base, music) {
  const rows = readdirSync(BRUT).filter((f) => f.startsWith(base + "_") && f.endsWith(".flac")).sort().map((f) => measure(f.replace(".flac", "")));
  const ok = rows.filter((r) => r.clip < 0.001 && r.peak > 0.05 && (music ? r.quiet < 0.15 : r.quiet < 0.97));
  const pool = ok.length ? ok : rows;
  pool.sort((a, b) => (music ? a.spread - b.spread : b.rms - a.rms));
  return { rows, best: pool[0].name };
}

if (import.meta.url === `file://${process.argv[1]}`)
  for (const base of process.argv.slice(2)) {
    const { rows, best } = pick(base, base.startsWith("mus-"));
    for (const r of rows) console.log(`${r.name.padEnd(18)} pic ${r.peak.toFixed(2)}  saturé ${(r.clip * 100).toFixed(2)} %  silence ${(r.quiet * 100).toFixed(0).padStart(3)} %  rms ${r.rms.toFixed(3)}  écart ${r.spread.toFixed(2)}${r.name === best ? "   <- proposé" : ""}`);
  }
