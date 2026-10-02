# Nœuds marins

Bibliothèque de nœuds marins en 3D : chaque nœud se suit étape par étape, se tourne et se zoome.
Application web installable, utilisable hors ligne une fois ouverte.

## Organisation

| Chemin | Rôle |
|---|---|
| `noeud-de-chaise.html` | Source de l'application : interface, données des nœuds, rendu 3D. C'est le seul fichier à modifier. |
| `outils/construire-pwa.js` | Construit l'application installable dans `pwa/` à partir de la source. |
| `outils/serveur-local.js` | Sert l'application sur le réseau local, pour l'essayer sur ordinateur ou téléphone. |
| `outils/verifier-geometrie.js` | Vérifie qu'aucun brin n'en traverse un autre, pour chaque nœud et chaque étape. |
| `outils/creer-icones.js` | Redessine les icônes de l'application. |
| `pwa/vendor`, `pwa/fonts`, `pwa/icons` | Dépendances embarquées : three.js, polices, icônes. |

`pwa/index.html`, `pwa/sw.js` et `pwa/manifest.webmanifest` sont générés : ils ne sont pas dans le dépôt.

## Commandes

Aucune installation n'est nécessaire, seulement Node.js.

```bash
node outils/serveur-local.js          # essayer en local (adresse affichée au démarrage)
node outils/verifier-geometrie.js noeud-de-chaise.html   # contrôler les nœuds
node outils/construire-pwa.js         # construire pwa/
```

## Mise en ligne

Le dépôt est prévu pour Vercel : à chaque envoi sur la branche principale, Vercel lance
`node outils/construire-pwa.js` et publie le dossier `pwa/` (réglages dans `vercel.json`).

Avant chaque envoi, lancer le contrôle des nœuds : il doit se terminer par `all clear`.

## Ajouter ou corriger un nœud

Les nœuds sont décrits dans `noeud-de-chaise.html`, entre les repères `KNOT-CORE-START` et
`KNOT-CORE-END` : pour chaque cordage, une suite de points de passage à l'état lâche et à l'état
serré, et le point atteint à la fin de chaque étape. Le contrôle géométrique ne garantit pas
qu'un nœud tient : chaque nœud doit aussi être essayé avec un vrai cordage.

## Dépendances embarquées

- [three.js](https://threejs.org) r128, licence MIT.
- Polices Albert Sans et Libre Caslon Text, licence SIL Open Font License.
