// Prépare les candidats d'un son pour l'écoute : chaque variante brute <nom>_<n>.flac est coupée autour de son souffle
// principal et écrite dans www/sons/candidats. La page www/ecoute.html les fait jouer ; l'oreille choisit.
// node tools/sons/candidates.mjs swing-a swing-b ...

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { read, write, onset, end, shape, BRUT } from "./lib.mjs";

const DIR = "www/sons/candidats";
mkdirSync(DIR, { recursive: true });
const list = [];
for (const base of process.argv.slice(2))
  for (const f of readdirSync(BRUT).filter((f) => f.startsWith(base + "_") && f.endsWith(".flac")).sort()) {
    const name = f.replace(".flac", ""), s = read(name), music = base.startsWith("mus-");
    const from = music ? 0 : onset(s, 0.15, 0.02), to = music ? s.length : end(s, from, 0.04, base.startsWith("boss") ? 3.5 : 2);
    write(name, shape(s, { from, len: (to - from) / 44100, fadeIn: 0.01, fadeOut: Math.min(0.15, (to - from) / 44100 / 3), peak: 0.8 }), DIR);
    list.push(name);
  }
writeFileSync(`${DIR}/liste.json`, JSON.stringify(list));
// les variantes que le jeu utilise, marquées ★ sur la page
const { pick } = await import("./measure.mjs"), { CHOICES } = await import("./choix.mjs");
const bases = [...new Set(list.map((n) => n.split("_")[0]))];
writeFileSync(`${DIR}/choix.json`, JSON.stringify(bases.map((b) => CHOICES[b] ?? (b.startsWith("swing-") ? (b === "swing-c" ? "swing-c_0" : null) : pick(b, b.startsWith("mus-")).best)).filter(Boolean)));
