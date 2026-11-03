# Crédits et licences

Le code de Brasier est sous licence MIT (voir `LICENSE`). Il s'appuie sur des travaux tiers, chacun sous sa propre licence.

## Images et animations : pixelfx

Tous les effets, les créatures et le squelette du chevalier viennent de **pixelfx**
(https://github.com/patch-gg/pixelfx), Copyright (c) 2026 Patch, licence MIT. pixelfx crédite lui-même :

- **Hugo Duprez** : `src/core/sim.js` et plusieurs effets adaptent les effets pixel art open source de Sprite Fusion
  (https://www.spritefusion.com/pixel-art-vfx), Copyright (c) 2026 Hugo Duprez, licence MIT.
- **Hollow Crown** : la façon de jouer les coups (poses tenues à 12 images par seconde, gel à l'impact) vient de
  https://github.com/rehan-remade/hollow-crown, Copyright (c) 2026 rehan-remade, licence MIT.

Brasier n'utilise pas la police Patch Pixel de pixelfx.

## Sons

- Les fichiers `www/sons/cloth*`, `footstep_*` et `impact*` viennent des packs « RPG Audio » et « Impact Sounds » de
  **Kenney** (https://kenney.nl), licence Creative Commons Zero (CC0).
- Les fichiers `swing_*`, `splat_*`, `ember_*`, `ignite`, `fire-loop`, les sons des sorts et des gardiens
  (`cast-*`, `boom-fire`, `smite`, `heal`, `shield`, `dash`, `quake`, `ice`, `boss-*`) et les musiques (`mus-*`) ont été générés avec **Stable Audio Open 1.0**
  de Stability AI (licence Stability AI Community), puis découpés par `tools/sons/finish.mjs`.

Le détail est aussi dans `www/sons/LICENCE.md`.
