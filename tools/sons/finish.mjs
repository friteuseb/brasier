// Finit les sons générés (tools/sons/brut) et les écrit dans www/sons en .ogg : on coupe le silence de tête, on garde la
// partie utile, on ajoute des fondus, on normalise le crête à -2 dB. Le crépitement devient une boucle sans raccord ;
// les braises sont des craquements isolés pris dans un crépitement. Les choix viennent de la lecture des spectrogrammes.
// node tools/sons/finish.mjs   (ffmpeg requis)

import { read, write, sec, onset, end, shape, loop, pops } from "./lib.mjs";

// node tools/sons/finish.mjs [swing splat ignite fire-loop ember] : seulement ces sons (tous sans argument)
const only = process.argv.slice(2), want = (n) => !only.length || only.includes(n);

// le souffle de l'épée : l'épée longue au souffle grave (swing-c), choisie à l'oreille ; la variante 1 est trop courte
if (want("swing"))
  [0, 2, 3].forEach((v, i) => {
    const s = read(`swing-c_${v}`), from = onset(s, 0.15, 0.02), to = end(s, from, 0.04, 0.7);
    write(`swing_${i}`, shape(s, { from, len: (to - from) / 44100, fadeIn: 0.01, fadeOut: Math.min(0.15, (to - from) / 44100 / 3), peak: 0.8 }));
  });
// l'éclaboussure d'un slime : trois variantes
if (want("splat"))
[1, 2, 3].forEach((v, i) => {
  const s = read(`splat_${v}`);
  write(`splat_${i}`, shape(s, { from: onset(s, 0.35), len: 0.5, fadeOut: 0.2 }));
});
// le brasero s'allume : la seule bonne variante, depuis son souffle
if (want("ignite")) {
  const s = read("ignite_0");
  write("ignite", shape(s, { from: onset(s, 0.3, 0.05), len: 2.2, fadeIn: 0.02, fadeOut: 0.9 }));
}
// le crépitement en boucle
if (want("fire-loop")) {
  const s = read("fire-loop_2");
  write("fire-loop", shape(loop(s.slice(sec(0.5), sec(11.5)), 1.5), { fadeIn: 0, fadeOut: 0, peak: 0.6 }));
}
// les braises : quatre craquements isolés
if (want("ember")) {
  const s = read("fire-loop_3");
  pops(s, 4).forEach((i, k) => write(`ember_${k}`, shape(s, { from: Math.max(0, i - sec(0.01)), len: 0.12, fadeOut: 0.06, peak: 0.6 })));
}
