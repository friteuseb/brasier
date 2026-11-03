// Le royaume : les niveaux et ce qui les relie. Un niveau s'ouvre quand tous ceux qu'il demande sont terminés.
// x, y : sa place sur la carte (écran de 320 x 180). def : le niveau, ou null tant qu'il n'est pas construit.

import remparts from "./remparts.js";

export const WORLD = [
  { id: "remparts", name: "Les Remparts", x: 42, y: 126, requires: [], def: remparts },
  { id: "foret", name: "La Forêt des lucioles", x: 104, y: 92, requires: ["remparts"], def: null },
  { id: "mines", name: "Les Mines de cristal", x: 172, y: 56, requires: ["foret"], def: null },
  { id: "marais", name: "Le Marais noir", x: 172, y: 136, requires: ["foret"], def: null },
  { id: "cathedrale", name: "La Cathédrale engloutie", x: 238, y: 96, requires: ["mines", "marais"], def: null },
  { id: "citadelle", name: "La Citadelle de l'Éclipse", x: 290, y: 44, requires: ["cathedrale"], def: null },
];
export const FIRST = "remparts";
export const place = (id) => WORLD.find((n) => n.id === id);
