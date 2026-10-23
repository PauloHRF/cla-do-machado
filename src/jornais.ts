// Aba "Jornais": edições do jornal do mundo (imagens), da mais recente para a mais antiga.
import { jornais, asset } from "./data";
import { esc, setTab, openModal } from "./ui";

export function montarJornais() {
  const sec = document.createElement("section");
  sec.innerHTML = `
    <h1>Jornais</h1>
    <p class="muted">As notícias de Phantyr, edição por edição. Clique para ler em tamanho grande.</p>
    ${jornais.length
      ? `<div class="jornais">${jornais.map((j, i) => `
        <button class="jornal" data-i="${i}" aria-label="Abrir ${esc(j.nome)}, edição ${j.edicao}">
          <img src="${asset(j.imagem)}" alt="${esc(j.manchete ?? j.nome)}" loading="lazy">
          <span class="jornal-nome">${esc(j.nome)}</span>
          <span class="jornal-ed">Edição ${j.edicao}${j.data ? ` · ${esc(j.data)}` : ""}</span>
        </button>`).join("")}</div>`
      : `<p class="muted">Ainda não há edições.</p>`}`;
  sec.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (!b) return;
    const j = jornais[+b.dataset.i!];
    openModal(`<h1>${esc(j.nome)}</h1><h2 class="sub">Edição ${j.edicao}${j.data ? ` · ${esc(j.data)}` : ""}</h2>
      <a href="${asset(j.imagem)}" target="_blank" rel="noopener" title="Abrir a imagem em outra aba"><img class="jornal-grande" src="${asset(j.imagem)}" alt="${esc(j.manchete ?? j.nome)}"></a>`);
  });
  setTab("jornais", sec);
}
