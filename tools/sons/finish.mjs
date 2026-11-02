// Finit les sons générés (tools/sons/brut) et les écrit dans www/sons en .ogg : on coupe le silence de tête, on garde la
// partie utile, on ajoute des fondus, on normalise le crête à -2 dB. Le crépitement devient une boucle sans raccord ;
// les braises sont des craquements isolés pris dans un crépitement. Les choix viennent de la lecture des spectrogrammes.
// node tools/sons/finish.mjs   (ffmpeg requis)

import { read, write, sec, onset, shape, loop, pops } from "./lib.mjs";

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
