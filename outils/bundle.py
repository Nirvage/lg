"""Assemble l'appli en un seul fichier HTML (aperçu Claude / usage hors ligne sans serveur).

Usage : python3 outils/bundle.py <dossier-de-sortie>
Les images img/cartes/*.jpg ne sont pas incluses : publiez-les à côté du fichier.
"""
import os
import re
import sys

racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lire = lambda f: open(os.path.join(racine, f), encoding="utf-8").read()

css = lire("css/style.css")
main_cartes = re.search(r"<main>(.*?)</main>", lire("cartes.html"), re.S).group(1)
scripts = "".join(f"<script>\n{lire(f)}\n</script>\n" for f in
                  ["js/vendor/qrcode.js", "js/data.js", "js/engine.js", "js/app.js", "js/cartes.js"])
html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Meneur Loup-Garou</title>
<style>
{css}
</style>
</head>
<body>
<header class="top">
  <h1>🐺 Meneur de jeu</h1>
  <nav>
    <a href="#partie" id="nav-partie" class="actif">Partie</a>
    <a href="#cartes" id="nav-cartes">Cartes</a>
  </nav>
</header>
<main id="app"></main>
<main id="page-cartes" hidden>{main_cartes}</main>
{scripts}<script>
(() => {{
  const montrer = (cartes) => {{
    document.getElementById("app").hidden = cartes;
    document.getElementById("page-cartes").hidden = !cartes;
    document.getElementById("nav-partie").classList.toggle("actif", !cartes);
    document.getElementById("nav-cartes").classList.toggle("actif", cartes);
    window.scrollTo(0, 0);
  }};
  document.getElementById("nav-partie").addEventListener("click", (e) => {{ e.preventDefault(); montrer(false); }});
  document.getElementById("nav-cartes").addEventListener("click", (e) => {{ e.preventDefault(); montrer(true); }});
}})();
</script>
</body>
</html>
"""
sortie = sys.argv[1] if len(sys.argv) > 1 else racine
open(os.path.join(sortie, "loup-garou-mj.html"), "w", encoding="utf-8").write(html)
print(os.path.join(sortie, "loup-garou-mj.html"))
