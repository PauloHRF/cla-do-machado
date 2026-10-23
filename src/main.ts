import "leaflet/dist/leaflet.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/400-italic.css";
import "@fontsource/alegreya/700.css";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "@fortawesome/fontawesome-free/css/brands.min.css";
import "./style.css";

import { locais, norm, TIPOS } from "./data";
import { mountMapa } from "./mapa";
import { mountCidade } from "./cidade";
import { openTab, isMobile } from "./ui";
import { montarJornais } from "./jornais";

// aba de jornais: vale para o mapa e para os mapas de cidade
montarJornais();

// ---------- rotas: #/  ·  #/local/<slug>  ·  #/cidade/<slug> ----------
type View = { destroy(): void; selecionar?(slug: string | null): void };
let view: View | null = null;
let atual = "";

function rota() {
  const [a, b] = location.hash.replace(/^#\/?/, "").split("/");
  if (a === "cidade" && b) {
    if (atual !== `cidade:${b}`) {
      view?.destroy();
      view = mountCidade(b);
      atual = `cidade:${b}`;
      if (!view) location.hash = "#/";
    }
    return;
  }
  if (atual !== "mapa") {
    view?.destroy();
    view = mountMapa();
    atual = "mapa";
    if (!a && !isMobile()) openTab("inicio");
  }
  view!.selecionar?.(a === "local" ? decodeURIComponent(b ?? "") : null);
}
addEventListener("hashchange", rota);
rota();

// ---------- pesquisa ----------
const input = document.getElementById("search-input") as HTMLInputElement;
const lista = document.getElementById("search-results")!;
const indice = [...locais.values()].map((l) => ({
  slug: l.slug, nome: l.nome, n: norm(l.nome),
  sub: l.kind === "cidade" ? TIPOS[l.tipo].nome : "Ponto de interesse",
}));
let achados: typeof indice = [];
let ativo = -1;

function desenhar() {
  lista.hidden = !achados.length;
  lista.innerHTML = achados
    .map((a, i) => `<li role="option" data-slug="${a.slug}" class="${i === ativo ? "on" : ""}">${a.nome}<small>${a.sub}</small></li>`)
    .join("");
}
function ir(slug: string) {
  location.hash = `#/local/${slug}`;
  input.value = "";
  achados = [];
  desenhar();
  input.blur();
}
input.addEventListener("input", () => {
  const q = norm(input.value.trim());
  achados = q ? indice.filter((x) => x.n.includes(q)).sort((a, b) => +b.n.startsWith(q) - +a.n.startsWith(q)).slice(0, 8) : [];
  ativo = achados.length ? 0 : -1;
  desenhar();
});
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + achados.length) % (achados.length || 1);
    desenhar();
  } else if (e.key === "Enter" && achados[ativo]) ir(achados[ativo].slug);
  else if (e.key === "Escape") { input.value = ""; achados = []; desenhar(); }
});
lista.addEventListener("mousedown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("li");
  if (li) ir(li.dataset.slug!);
});
input.addEventListener("blur", () => setTimeout(() => (lista.hidden = true), 120));
input.addEventListener("focus", desenhar);
