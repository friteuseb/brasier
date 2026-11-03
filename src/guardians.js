// Les fiches des gardiens (src/boss.js). armor : les tons du mannequin repeints (A à D les plaques du clair au sombre,
// E à G les jointures, J les coutures, m la marque de poitrine) ; cape : quatre tons du sombre au clair ; slash : la teinte
// de leurs coups et de leurs sorts. near : l'attaque rapprochée ; far : les attaques à distance ; angry : celles qui
// s'ajoutent sous la moitié de leur vie. moves : les réglages de chaque attaque.

import { PAL } from "pixelfx";
import * as smite from "pixelfx/fx/holy/smite";
import * as earthSpike from "pixelfx/fx/nature/earth-spike";
import * as frostNova from "pixelfx/fx/ice/frost-nova";
import * as iceLance from "pixelfx/fx/ice/ice-lance";
import * as fireball from "pixelfx/fx/fire/fireball";
import * as slam from "pixelfx/fx/impacts/ground-slam";

export const GUARDIANS = {
  // la Forêt : la Sorcière des ronces, faux à la main ; ses ronces jaillissent sous vos pieds
  sorciere: {
    name: "LA SORCIÈRE DES RONCES", hp: 26, loot: 25, weapon: "scythe",
    armor: { A: "#b8d890", B: "#7aa850", C: "#4e7a30", D: "#2e4e1c", E: "#8a5a32", F: "#5a3820", G: "#3a2414", J: "#14200c", m: "#e0ff70" },
    cape: ["#0e1a0a", "#1e3414", "#30521e", "#4a7a2c"], aura: "#7ad040", slash: PAL.poison,
    near: ["combo"], far: ["ball", "barrage"], angry: ["barrage"],
    moves: {
      ball: { count: 3, speed: 150, palette: PAL.poison, fx: fireball },
      barrage: { fx: earthSpike, palette: PAL.leaf, count: 3, gap: 0.6, delay: 0.42, r: 22, sound: "boom" },
    },
  },
  // les Mines : le Gardien de givre, épée à deux mains ; ses lances de glace, et une onde de gel à bout portant
  givre: {
    name: "LE GARDIEN DE GIVRE", hp: 34, loot: 30, weapon: "greatsword", two: true,
    armor: { A: "#f0fbff", B: "#a6dcf4", C: "#5e9ac8", D: "#2e5a8a", E: "#cfe8ff", F: "#7aa8d8", G: "#3a5a8a", J: "#10203a", m: "#ffffff" },
    cape: ["#0a1830", "#14305a", "#2c58aa", "#62c8f4"], aura: "#8ad8ff", slash: PAL.ice,
    near: ["combo", "nova"], far: ["ball", "dash"], angry: ["nova", "ball"],
    moves: {
      ball: { count: 2, speed: 230, palette: PAL.ice, fx: iceLance },
      nova: { fx: frostNova, palette: PAL.ice, delay: 0.35, r: 70 },
    },
  },
  // le Marais : le Roi-crapaud, marteau à la main ; il bondit et écrase le sol (il faut sauter), crache du poison
  crapaud: {
    name: "LE ROI-CRAPAUD", hp: 34, loot: 30, weapon: "hammer",
    armor: { A: "#d8e070", B: "#9ab040", C: "#6a8028", D: "#3e5018", E: "#ffd84a", F: "#c8962a", G: "#6a4a10", J: "#1a200a", m: "#ff6040" },
    cape: ["#1a1406", "#3a2e0c", "#6a5418", "#a8862a"], aura: "#c8d050", slash: PAL.poison,
    near: ["combo", "leap"], far: ["leap", "ball"], angry: ["leap"],
    moves: {
      leap: { fx: slam, palette: ["#1e2a12", "#3e4a20", "#6a7a3a", "#9aa858", "#d0d890", "#f4f8d0", "#ffffff"], r: 80 },
      ball: { count: 3, speed: 170, palette: PAL.poison, fx: fireball },
    },
  },
  // la Cathédrale : l'Abbé déchu, lance à la main ; la lumière qu'il servait tombe du ciel sur vous
  abbe: {
    name: "L'ABBÉ DÉCHU", hp: 40, loot: 35, weapon: "spear",
    armor: { A: "#fff4d8", B: "#d8c8a0", C: "#a08a60", D: "#5e4e34", E: "#ffd84a", F: "#c8962a", G: "#6a4a10", J: "#24180c", m: "#ff3060" },
    cape: ["#1c1408", "#3a2a10", "#6a5420", "#c8a84a"], aura: "#ffe08a", slash: PAL.holy,
    near: ["combo"], far: ["barrage", "dash", "ball"], angry: ["barrage"],
    moves: {
      barrage: { fx: smite, palette: PAL.holy, count: 3, gap: 0.4, delay: 0.47, r: 24 },
      ball: { count: 1, speed: 210, palette: PAL.holy, fx: fireball },
    },
  },
  // la Citadelle : le Chevalier noir, votre reflet ; l'Éclipse fait tomber trois éclairs d'ombre
  noir: {
    name: "LE CHEVALIER NOIR", hp: 50, loot: 40, weapon: "sword",
    armor: { A: "#a8a2d0", B: "#726c9c", C: "#4a4468", D: "#2e2944", E: "#7a3aa8", F: "#52267a", G: "#341648", J: "#120c1c", m: "#ff3060" },
    cape: ["#0a0612", "#1c0e2e", "#2e1848", "#4a2a6e"], aura: "#a970e0", slash: PAL.shadow,
    near: ["combo"], far: ["dash", "ball"], angry: ["barrage"],
    moves: {
      ball: { count: 1, speed: 190, palette: PAL.shadow, fx: fireball },
      barrage: { fx: smite, palette: PAL.shadow, count: 3, gap: 0.45, delay: 0.47, r: 24 },
    },
  },
};
