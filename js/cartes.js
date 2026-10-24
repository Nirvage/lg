// Page « Cartes » : liste filtrable de toutes les cartes et de leurs effets.

(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const etat = { ext: "tout", camp: "tout", q: "" };

  const sansAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function boutons(el, options, cle) {
    el.innerHTML = options.map(([v, l]) => `<button data-v="${v}" class="${etat[cle] === v ? "actif" : ""}">${esc(l)}</button>`).join("");
    el.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      etat[cle] = b.dataset.v;
      rendre();
    };
  }

  function carte(r) {
    return `<article class="carte camp-${r.camp}">
      <div class="tete">${visuelCarte(r.id, "grand")}<h3>${esc(r.nom)}</h3></div>
      <div class="meta">
        <span class="pastille camp-${r.camp}">${esc(CAMPS[r.camp].nom)}</span>
        <span class="pastille ext">${esc(EXTENSIONS[r.ext].nom)}</span>
      </div>
      <p><strong>${esc(r.resume)}</strong></p>
      <p>${esc(r.effet)}</p>
      <p class="reveil">🌙 ${esc(r.nuit)}</p>
      <div class="photo-actions">
        <label class="btn small">📷 ${PHOTOS[r.id] ? "Changer la photo" : "Photo de ma carte"}
          <input type="file" accept="image/*" data-photo="${r.id}" hidden>
        </label>
        ${PHOTOS[r.id] ? `<button class="small ghost" data-retirer="${r.id}">Retirer</button>` : ""}
      </div>
    </article>`;
  }

  function rendre() {
    boutons(document.getElementById("filtre-ext"), [["tout", "Toutes"], ...Object.entries(EXTENSIONS).map(([id, e]) => [id, e.court])], "ext");
    boutons(document.getElementById("filtre-camp"), [["tout", "Tous camps"], ...Object.entries(CAMPS).map(([id, c]) => [id, c.nom])], "camp");
    const q = sansAccents(etat.q);
    const liste = ROLES.filter((r) =>
      (etat.ext === "tout" || r.ext === etat.ext) &&
      (etat.camp === "tout" || r.camp === etat.camp) &&
      (!q || sansAccents(r.nom + " " + r.resume + " " + r.effet).includes(q)));
    document.getElementById("cartes").innerHTML = liste.map(carte).join("") || `<p class="muted">Aucune carte ne correspond.</p>`;
    document.getElementById("compte").classList.remove("erreur");
    document.getElementById("compte").textContent = liste.length + " carte" + (liste.length > 1 ? "s" : "");

    const metiers = METIERS.filter((m) => !q || sansAccents(m.nom + " " + m.effet).includes(q));
    const voirMetiers = (etat.ext === "tout" || etat.ext === "village") && etat.camp === "tout" && metiers.length > 0;
    ["titre-metiers", "intro-metiers", "metiers"].forEach((id) => document.getElementById(id).classList.toggle("hidden", !voirMetiers));
    document.getElementById("metiers").innerHTML = metiers.map((m) => `<article class="carte camp-variable">
      <div class="tete"><span class="ico">${m.icone}</span><h3>${esc(m.nom)}</h3></div>
      <div class="meta"><span class="pastille ext">Le Village</span><span class="pastille camp-variable">${m.usage === "unique" ? "Usage unique" : "Permanent"}</span></div>
      <p>${esc(m.effet)}</p>
    </article>`).join("");
  }

  // Réduit la photo (côté le plus long : 480 px) pour qu'elle tienne dans le navigateur.
  function reduire(fichier) {
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
      img.src = url;
    });
  }

  const zone = document.getElementById("cartes");
  zone.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-photo]");
    if (!input || !input.files[0]) return;
    let erreur = null;
    try {
      const data = await reduire(input.files[0]);
      if (!enregistrerPhoto(input.dataset.photo, data)) erreur = "La photo n'a pas pu être enregistrée : la mémoire du navigateur est pleine ou bloquée.";
    } catch (err) {
      erreur = "Cette image n'a pas pu être lue. Essayez une photo JPEG ou PNG.";
    }
    rendre();
    if (erreur) alerte(erreur);
  });
  zone.addEventListener("click", (e) => {
    const b = e.target.closest("[data-retirer]");
    if (!b) return;
    enregistrerPhoto(b.dataset.retirer, null);
    rendre();
  });
  function alerte(txt) {
    const p = document.getElementById("compte");
    p.textContent = txt;
    p.classList.add("erreur");
  }

  document.getElementById("recherche").addEventListener("input", (e) => { etat.q = e.target.value; rendre(); });
  rendre();
})();
