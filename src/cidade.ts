import L from "leaflet";
import { asset, mapasCidade, cidades } from "./data";
import { disco } from "./icons";
import { esc, md, setTab, openTab, hideTab, panelWidth, showCoords, isMobile, closeEvents } from "./ui";
import { fichaCidade } from "./mapa";
import { dominioDe } from "./dominios";

export function mountCidade(slug: string) {
  const m = mapasCidade.find((x) => x.slug === slug);
  if (!m) return null;
  const cidade = cidades.find((c) => c.pagina === slug || c.slug === slug);
  const regiao = cidade ? dominioDe(cidade.x, cidade.y) : null;

  const bounds: L.LatLngBoundsExpression = [[0, 0], [m.altura, m.largura]];
  const map = L.map("map", {
    crs: L.CRS.Simple, minZoom: m.zoomMin ?? -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5,
    zoomControl: false, attributionControl: false,
    // folga grande em volta da imagem (uma imagem inteira de cada lado), para poder arrastar mesmo com o painel aberto e em qualquer zoom
    maxBounds: [[-m.altura, -m.largura], [m.altura * 2, m.largura * 2]], maxBoundsViscosity: 0.3,
  });
  L.imageOverlay(asset(m.imagem), bounds, { interactive: false }).addTo(map);
  L.control.zoom({ position: "topright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(map);
  showCoords(map);
  document.querySelector<HTMLElement>('#rail [data-tab="filtros"]')!.title = "Locais";
  document.title = `${m.nome} — Clã do Machado`;

  // ----- início: descrição da cidade -----
  const inicio = document.createElement("section");
  inicio.innerHTML = `
    <a class="btn voltar" href="#/${cidade ? "local/" + cidade.slug : ""}"><i class="fa-solid fa-arrow-left"></i> Mapa de Phantyr</a>
    <h1>${esc(m.nome)}</h1>
    ${regiao ? `<p class="tags"><span class="tag ghost">Região: ${esc(regiao.nome)}</span></p>` : ""}
    ${cidade ? fichaCidade(cidade) : ""}
    <div class="prose">${md(m.texto)}</div>`;
  setTab("inicio", inicio);

  // ----- locais -----
  const detalhe = document.createElement("section");
  const lista = document.createElement("section");
  lista.innerHTML = `<h1>${esc(m.nome)}</h1><h2 class="ribbon">Estabelecimentos</h2><ul class="locais">${m.pois
    .map((p, i) => `<li><button data-i="${i}"><span class="ic" style="background:${p.cor}"><i class="fa-solid fa-${p.icone}"></i></span>${esc(p.nome)}</button></li>`)
    .join("")}</ul>`;
  setTab("filtros", lista);

  const marcadores = m.pois.map((p, i) => {
    const mk = L.marker([p.y, p.x], { icon: disco(p.icone, p.cor, 34), alt: p.nome })
      .addTo(map)
      .bindTooltip(esc(p.nome), { direction: "top", className: "tip", opacity: 1 });
    mk.on("click", () => selecionar(i));
    return mk;
  });

  function selecionar(i: number) {
    const p = m!.pois[i];
    marcadores.forEach((k, j) => k.getElement()?.classList.toggle("sel", j === i));
    closeEvents();
    detalhe.innerHTML = `<h1>${esc(p.nome)}</h1>
      ${p.descricao ? `<div class="prose">${md(p.descricao)}</div>` : ""}
      ${p.detalhe ? `<div class="prose npcs">${md(p.detalhe)}</div>` : ""}
      ${!p.descricao && !p.detalhe ? `<p class="muted">Sem mais detalhes por enquanto.</p>` : ""}`;
    setTab("detalhe", detalhe);
    openTab("detalhe");
    map.fitBounds(L.latLngBounds([p.y, p.x], [p.y, p.x]), {
      maxZoom: 1, paddingTopLeft: [panelWidth(), 0], paddingBottomRight: [0, isMobile() ? window.innerHeight * 0.5 : 0],
    });
  }
  lista.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (b) selecionar(+b.dataset.i!);
  });

  // botão sempre visível para voltar ao mapa de Phantyr (além do que fica dentro do painel)
  const voltar = document.createElement("a");
  voltar.id = "voltar-mapa"; voltar.className = "btn";
  voltar.href = `#/${cidade ? "local/" + cidade.slug : ""}`;
  voltar.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Mapa de Phantyr`;
  document.body.append(voltar);

  openTab("inicio");
  map.fitBounds(bounds, { paddingTopLeft: [panelWidth(), isMobile() ? 60 : 0], paddingBottomRight: [0, isMobile() ? window.innerHeight * 0.5 : 0] });
  return {
    destroy() {
      voltar.remove();
      map.remove();
      ["inicio", "filtros", "detalhe"].forEach(hideTab);
      document.title = "Clã do Machado — Mapa de Phantyr";
    },
  };
}
