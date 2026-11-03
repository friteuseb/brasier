# Brasier

Un petit jeu de plateforme médiéval fantastique, dans le navigateur. La Nuit a éteint les grands braseros du royaume :
un chevalier les rallume un à un, à l'épée et à la magie.

**[Jouer en ligne](https://friteuseb.github.io/brasier/)** · au clavier ou sur mobile en paysage

Tout ce qu'on voit est dessiné en code avec [pixelfx](https://github.com/patch-gg/pixelfx) : le chevalier, les monstres,
les flammes, la météo. Aucune image.

## Commandes

| Action | Clavier | Mobile |
|---|---|---|
| Courir | flèches, Q/D ou A/D | ◀ ▶ |
| Sauter | Espace, flèche haut, Z ou W | SAUT |
| Frapper (combo de 3 coups) | X ou J | ÉPÉE |
| Lancer le sort équipé, ouvrir l'échoppe | C ou K | SORT |
| Changer de sort | V ou L | ⟳ |
| Couper le son | M | SON |

## Le jeu

- **Les braseros** sont les points de reprise : ils soignent et sauvegardent.
- **Les braises** lâchées par les monstres s'échangent chez le mage contre des compétences. L'arbre a trois écoles :
  la Flamme, le Serment et l'Acier.
- **Les passages d'école** (barricades, murs fissurés, plateformes de lumière) cachent des éclats de brasier. Trois
  éclats donnent un cœur de plus.
- **Le Grand Brasier**, au bout de chaque niveau, ouvre la suite sur la carte du royaume.

Deux niveaux sont jouables : les Remparts et la Forêt des lucioles. Les autres arrivent.

## Développer

Node 18 ou plus récent.

```bash
npm install
npm run dev      # le jeu sur http://localhost:8077
npm run build    # www/main.js, prêt à publier
npm run reach    # vérifie que chaque niveau se traverse et que chaque éclat s'ouvre avec une école
npm run shot -- run 0.2   # joue un scénario de touches et écrit des captures dans shots/
```

Les niveaux sont des cartes de caractères dans `src/levels/`. La légende est en tête de `src/level.js`.

## Licence

MIT pour le code. Les crédits de pixelfx et des sons sont dans [NOTICE.md](NOTICE.md).
