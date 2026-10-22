import { marked } from "marked";
import { panteao, asset, type Evento } from "./data";
import { hexDe, rotulo } from "./hex";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// O conteúdo é Markdown (o CMS grava assim), mas HTML simples também passa.
export const md = (s?: string) => (s ? asset(marked.parse(s, { async: false }) as string) : "");

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ---------- painel lateral ----------
const panel = $("panel");
const body = $("panel-body");
const rail = $("rail");
const tabs: Record<string, HTMLElement> = {};
let current = "";

export const isMobile = () => matchMedia("(max-width: 720px)").matches;
export const panelWidth = () => (isMobile() || panel.classList.contains("closed") ? 0 : panel.offsetWidth + 48);

export function setTab(name: string, node: HTMLElement) {
  node.dataset.tab = name;
  node.hidden = name !== current;
  tabs[name]?.remove();
  tabs[name] = node;
  body.append(node);
  rail.querySelector<HTMLElement>(`[data-tab="${name}"]`)!.hidden = false;
}

export function hideTab(name: string) {
  tabs[name]?.remove();
  delete tabs[name];
  rail.querySelector<HTMLElement>(`[data-tab="${name}"]`)!.hidden = name === "detalhe";
  if (current === name) closePanel();
}

export function openTab(name: string) {
  current = name;
  for (const [k, n] of Object.entries(tabs)) n.hidden = k !== name;
  rail.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  panel.classList.remove("closed");
  body.scrollTop = 0;
}

export function closePanel() {
  panel.classList.add("closed");
  rail.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("active"));
  current = "";
}

rail.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-tab]");
  if (!b) return;
  if (current === b.dataset.tab && !panel.classList.contains("closed")) closePanel();
  else openTab(b.dataset.tab!);
});
$("panel-close").addEventListener("click", closePanel);

// ---------- modal (história e deuses) ----------
const modal = $("modal");
const modalBody = $("modal-body");
export function openModal(html: string) {
  modalBody.innerHTML = html;
  // fichas com texto + imagem lado a lado: o CSS empilha (texto primeiro, imagem abaixo)
  modalBody.querySelectorAll<HTMLElement>('div[style*="flex"]').forEach((d) => {
    if (Array.from(d.children).some((c) => !c.querySelector("img"))) d.classList.add("texto-imagem");
  });
  modal.hidden = false;
  modal.querySelector<HTMLElement>(".box")!.scrollTop = 0;
}
const closeModal = () => (modal.hidden = true);
modal.addEventListener("click", (e) => {
  if (e.target === modal || (e.target as HTMLElement).closest(".x")) closeModal();
});

export function lore(slug: string) {
  const p = panteao.find((x) => x.slug === slug);
  if (!p) return;
  openModal(`<h1>${esc(p.nome)}</h1>${p.subtitulo ? `<h2 class="sub">${esc(p.subtitulo)}</h2>` : ""}${md(p.corpo)}`);
}

export function loreButtons() {
  const wrap = document.createElement("div");
  const grupo = (titulo: string, tipo: "historia" | "deus") =>
    `<h2 class="ribbon">${titulo}</h2><div class="chips grid">${panteao
      .filter((p) => p.tipo === tipo)
      .map((p) => `<button class="btn" data-lore="${p.slug}">${esc(p.nome)}</button>`)
      .join("")}</div>`;
  wrap.innerHTML = grupo("História", "historia") + grupo("Deuses e Religiões", "deus");
  wrap.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-lore]");
    if (b) lore(b.dataset.lore!);
  });
  return wrap;
}

// ---------- linha do tempo ----------
const events = $("events");
export function openEvents(titulo: string, lista: Evento[]) {
  $("events-body").innerHTML =
    `<h1>${esc(titulo)}</h1><ol class="timeline">` +
    lista.map((e) => `<li><h3>${esc(e.data)}</h3>${md(e.texto)}</li>`).join("") +
    `</ol>`;
  events.hidden = false;
}
events.querySelector(".x")!.addEventListener("click", () => (events.hidden = true));
export const closeEvents = () => (events.hidden = true);

// ---------- avisos ----------
const toastEl = $("toast");
let toastTimer = 0;
export function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), 2200);
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!modal.hidden) closeModal();
  else if (!events.hidden) closeEvents();
  else closePanel();
});

// ---------- coordenadas (útil para quem cadastra locais) ----------
const coords = $("coords");
export function showCoords(map: L.Map) {
  map.on("mousemove", (e: L.LeafletMouseEvent) => {
    coords.hidden = false;
    const h = hexDe(e.latlng.lng, e.latlng.lat);
    coords.textContent = `${h ? rotulo(h) + "  ·  " : ""}x: ${Math.round(e.latlng.lng)}  y: ${Math.round(e.latlng.lat)}`;
  });
  map.on("mouseout", () => (coords.hidden = true));
  map.on("click", (e: L.LeafletMouseEvent) => {
    // TEMPORÁRIO (remover depois): clique simples copia o código do hexágono (ex.: C72-L41) para a área de transferência
    if (!(e.originalEvent as MouseEvent).shiftKey) {
      const hx = hexDe(e.latlng.lng, e.latlng.lat);
      if (hx) { const cod = rotulo(hx); navigator.clipboard?.writeText(cod).then(() => toast(`${cod} copiado`), () => toast(cod)); }
      return;
    }
    const t = `${Math.round(e.latlng.lng)}, ${Math.round(e.latlng.lat)}`;
    const h = hexDe(e.latlng.lng, e.latlng.lat);
    navigator.clipboard?.writeText(t).then(() => toast(`Coordenadas copiadas: ${t}${h ? " (" + rotulo(h) + ")" : ""}`));
  });
}
