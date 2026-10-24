// Service worker : rend l'appli utilisable hors ligne.
// Les fichiers sont servis depuis le cache puis mis à jour en arrière-plan,
// donc une nouvelle version est prise en compte au lancement suivant.
const CACHE = "lg-mj-v3";
const FICHIERS = [
  "./",
  "index.html",
  "cartes.html",
  "css/style.css",
  "js/data.js",
  "js/engine.js",
  "js/app.js",
  "js/cartes.js",
  "js/compo.js",
  "js/vendor/qrcode.js",
  "compo.html",
  "manifest.webmanifest",
  "img/icones/icone-192.png",
  "img/icones/icone-512.png",
  "img/cartes/abominable-sectaire.jpg",
  "img/cartes/ancien.jpg",
  "img/cartes/ange.jpg",
  "img/cartes/bouc-emissaire.jpg",
  "img/cartes/chasseur.jpg",
  "img/cartes/chevalier.jpg",
  "img/cartes/chien-loup.jpg",
  "img/cartes/comedien.jpg",
  "img/cartes/corbeau.jpg",
  "img/cartes/cupidon.jpg",
  "img/cartes/deux-soeurs.jpg",
  "img/cartes/enfant-sauvage.jpg",
  "img/cartes/gitane.jpg",
  "img/cartes/grand-mechant-loup.jpg",
  "img/cartes/idiot.jpg",
  "img/cartes/infect.jpg",
  "img/cartes/joueur-de-flute.jpg",
  "img/cartes/juge-begue.jpg",
  "img/cartes/loup-blanc.jpg",
  "img/cartes/loup-garou.jpg",
  "img/cartes/montreur-ours.jpg",
  "img/cartes/petite-fille.jpg",
  "img/cartes/pyromane.jpg",
  "img/cartes/renard.jpg",
  "img/cartes/salvateur.jpg",
  "img/cartes/servante.jpg",
  "img/cartes/sorciere.jpg",
  "img/cartes/trois-freres.jpg",
  "img/cartes/villageois.jpg",
  "img/cartes/voleur.jpg",
  "img/cartes/voyante.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const enCache = await c.match(e.request, { ignoreSearch: true });
      const reseau = fetch(e.request)
        .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })
        .catch(() => null);
      if (enCache) { e.waitUntil(reseau); return enCache; }
      // Pas en cache (ex. photo de carte absente) : réseau, sinon 404 silencieux.
      return (await reseau) || new Response("", { status: 404 });
    })
  );
});
