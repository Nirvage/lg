# Loup-Garou — Meneur de jeu

Application web pour le meneur de jeu (MJ) des **Loups-Garous de Thiercelieux**.
Elle fonctionne sur téléphone, sans serveur ni installation : ouvrez simplement `index.html`.

## Ce qu'elle fait

- **Préparation** : nombre de joueurs et composition (jeu de base, Nouvelle Lune,
  Le Village, Personnages). Pas de noms à saisir : chaque joueur est désigné par sa carte
  (« Loup-Garou 2 », « Voyante »…). S'il y a plus de cartes que de joueurs (Voleur, Comédien),
  l'appli demande d'abord quelles cartes sont restées au centre.
- **Déroulé pas à pas** : l'appli appelle les personnages dans l'ordre de la nuit, indique
  la phrase à dire, demande les choix (victime des loups, protection, potions…), puis gère
  le matin, l'élection du Capitaine, le vote et toutes les conséquences : amoureux, Chasseur,
  Ancien, Idiot, Bouc Émissaire, Infect, Enfant Sauvage, Chevalier, Servante, Juge Bègue,
  Montreur d'Ours, Renard, Joueur de Flûte, conditions de victoire…
- **Outils du MJ** : retour arrière, mort manuelle (Petite Fille surprise…), retour d'un joueur,
  notes / cartes Événement dans le journal. La partie est sauvegardée dans le navigateur.
- **Page Cartes** (`cartes.html`) : toutes les cartes et leurs effets, avec recherche et filtres.
- **Images des cartes** : déposez vos propres images dans `img/cartes/` (voir
  [la liste des noms de fichier](img/cartes/README.md)) ; sinon une icône est affichée.

## Tests

```sh
node tests/regles.js        # scénarios de règles
node tests/simulation.js    # 500 parties aléatoires
```

## Publier

Le site est statique : activez GitHub Pages sur la branche principale (dossier racine)
pour l'utiliser directement depuis un téléphone.
