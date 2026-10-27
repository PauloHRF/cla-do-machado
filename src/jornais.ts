// Aba "Jornais": edições do jornal do mundo (imagens), da mais recente para a mais antiga.
import { jornais, asset } from "./data";
import { esc, setTab } from "./ui";

export function montarJornais() {
  const sec = document.createElement("section");
  sec.innerHTML = `
    <h1>O Koboldiário</h1>
    <p class="muted">As notícias de Phantyr, edição por edição. Clique para ler em tela cheia, com zoom.</p>
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
    abrirLeitor(j);
  });
  setTab("jornais", sec);
}

/** Leitor em tela cheia: zoom (roda do mouse, botões, duplo clique, pinça) e arrastar, sem sair do site. */
function abrirLeitor(j: (typeof jornais)[number]) {
  const el = document.createElement("div");
  el.className = "leitor";
  el.innerHTML = `
    <div class="leitor-barra">
      <span class="leitor-titulo"></span>
      <button class="btn" data-z="-" aria-label="Diminuir"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
      <button class="btn" data-z="0" aria-label="Ajustar à tela"><i class="fa-solid fa-expand"></i></button>
      <button class="btn" data-z="+" aria-label="Aumentar"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
      <button class="btn" data-z="x" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="leitor-area"><img src="${asset(j.imagem)}" alt="${esc(j.manchete ?? j.nome)}" draggable="false"></div>`;
  document.body.append(el);
  const area = el.querySelector<HTMLElement>(".leitor-area")!, img = el.querySelector<HTMLImageElement>("img")!;
  let k = 1, tx = 0, ty = 0, base = 1;
  const aplicar = () => { img.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`; };
  function ajustar() {
    const W = area.clientWidth, H = area.clientHeight, w = img.naturalWidth || W, h = img.naturalHeight || H;
    base = Math.min(W / w, H / h);
    img.style.width = `${w * base}px`; img.style.height = `${h * base}px`;
    k = 1; tx = (W - w * base) / 2; ty = (H - h * base) / 2; aplicar();
  }
  /** Zoom mantendo o ponto (cx, cy) da área parado. */
  function zoom(f: number, cx = area.clientWidth / 2, cy = area.clientHeight / 2) {
    const n = Math.min(8, Math.max(1, k * f)), r = n / k;
    tx = cx - (cx - tx) * r; ty = cy - (cy - ty) * r; k = n;
    if (k === 1) { ajustar(); return; }
    aplicar();
  }
  img.addEventListener("load", ajustar); if (img.complete) ajustar();
  const fechar = () => { el.remove(); removeEventListener("keydown", tecla); removeEventListener("resize", ajustar); };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") fechar();
    else if (e.key === "+" || e.key === "=") zoom(1.4);
    else if (e.key === "-") zoom(1 / 1.4);
    else if (e.key === "0") ajustar();
  };
  addEventListener("keydown", tecla); addEventListener("resize", ajustar);
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-z]"); if (!b) return;
    const z = b.dataset.z; if (z === "x") fechar(); else if (z === "0") ajustar(); else zoom(z === "+" ? 1.5 : 1 / 1.5);
  });
  area.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = area.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  area.addEventListener("dblclick", (e) => {
    const r = area.getBoundingClientRect();
    if (k > 1) ajustar(); else zoom(2.5, e.clientX - r.left, e.clientY - r.top);
  });
  // arrastar (1 dedo/mouse) e pinça (2 dedos)
  const toques = new Map<number, { x: number; y: number }>();
  let dist0 = 0;
  area.addEventListener("pointerdown", (e) => { area.setPointerCapture(e.pointerId); toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); dist0 = 0; });
  area.addEventListener("pointermove", (e) => {
    const ant = toques.get(e.pointerId); if (!ant) return;
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) {
      const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = area.getBoundingClientRect();
      if (dist0) zoom(d / dist0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      dist0 = d;
    } else if (k > 1) { tx += e.clientX - ant.x; ty += e.clientY - ant.y; aplicar(); }
  });
  const solta = (e: PointerEvent) => { toques.delete(e.pointerId); dist0 = 0; };
  area.addEventListener("pointerup", solta); area.addEventListener("pointercancel", solta);
}
