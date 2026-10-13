# Loup-Garou — Meneur de jeu

Application web pour le meneur de jeu (MJ) des **Loups-Garous de Thiercelieux**.
Elle fonctionne sur téléphone, sans serveur ni installation : ouvrez simplement `index.html`.

## Ce qu'elle fait

- **Préparation** : saisie des joueurs dans l'ordre de la table, choix de la composition
  (jeu de base, Nouvelle Lune, Le Village, Personnages, bâtiments du Village),
  puis attribution des rôles (manuelle ou tirage au sort, avec un mode « passer le téléphone »
  pour montrer son rôle à chaque joueur).
- **Déroulé pas à pas** : l'appli appelle les personnages dans l'ordre de la nuit, indique
  la phrase à dire, demande les choix (victime des loups, protection, potions…), puis gère
  le matin, l'élection du Capitaine, le vote et toutes les conséquences : amoureux, Chasseur,
  Ancien, Idiot, Bouc Émissaire, Infect, Enfant Sauvage, Chevalier, Servante, Juge Bègue,
  Montreur d'Ours, Renard, Joueur de Flûte, métiers du Village, conditions de victoire…
- **Outils du MJ** : retour arrière, mort manuelle (Petite Fille surprise…), retour d'un joueur,
  notes / cartes Événement dans le journal. La partie est sauvegardée dans le navigateur.
- **Page Cartes** (`cartes.html`) : toutes les cartes et leurs effets, avec recherche et filtres.

## Tests

```sh
node tests/regles.js        # scénarios de règles
node tests/simulation.js    # 500 parties aléatoires
```

## Publier

Le site est statique : activez GitHub Pages sur la branche principale (dossier racine)
pour l'utiliser directement depuis un téléphone.
