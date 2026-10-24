// Page « Compo » : liste des rôles de la partie, ouverte en scannant le QR code du meneur.

(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = document.getElementById("compo");

  function rendre() {
    const { roles, metiers } = lireCompo(location.hash);
    if (!roles.length) {
      el.innerHTML = `<p class="muted">Aucune composition. Scannez le QR code affiché par le meneur de jeu.</p>`;
      return;
    }
    const total = roles.reduce((t, r) => t + r.n, 0);
    const parCamp = Object.keys(CAMPS).map((c) => [c, roles.filter((r) => ROLE_BY_ID[r.id].camp === c)]).filter(([, l]) => l.length);
    const ligne = (vis, nomTxt, n, resume) => `
      <div class="compo-ligne">
        ${vis}
        <div class="grow"><strong>${esc(nomTxt)}</strong>${n > 1 ? ` <span class="pastille">×${n}</span>` : ""}
          <div class="muted small">${esc(resume)}</div></div>
      </div>`;
    el.innerHTML = `
      <p class="muted">${total} carte${total > 1 ? "s" : ""} dans la composition.</p>
      ${parCamp.map(([c, l]) => `
        <div class="panel">
          <h3 style="margin-top:0"><span class="pastille camp-${c}">${esc(CAMPS[c].nom)} · ${l.reduce((t, r) => t + r.n, 0)}</span></h3>
          ${l.map((r) => ligne(visuelCarte(r.id, "ico"), ROLE_BY_ID[r.id].nom, r.n, ROLE_BY_ID[r.id].resume)).join("")}
        </div>`).join("")}
      ${metiers.length ? `
        <div class="panel">
          <h3 style="margin-top:0">Bâtiments du Village</h3>
          ${metiers.map((m) => ligne(`<span class="ico">${METIER_BY_ID[m.id].icone}</span>`, METIER_BY_ID[m.id].nom, m.n, METIER_BY_ID[m.id].effet)).join("")}
        </div>` : ""}
      <p class="muted small">Le détail de chaque carte est sur la page <a href="cartes.html">Cartes</a>.</p>`;
  }

  window.addEventListener("hashchange", rendre);
  rendre();
})();
