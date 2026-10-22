// Domínios por hexágono: cada hexágono pertence a no máximo um domínio (src/content/viagem/dominios.json).
import L from "leaflet";
import { HEX_COLUNAS as NC, HEX_LINHAS as NL, HEX_LADO, MAPA_ALTURA, centroTopo, centroLatLng, hexDe, verticesTopo, type Hex } from "./hex";
import { vizinhos } from "./viagem";
import { esc } from "./ui";

export interface Dominio { id: string; letra: string; nome: string; cor: string }
const arquivo = Object.values(import.meta.glob("./content/viagem/dominios.json", { eager: true, import: "default" }))[0] as { dominios: Dominio[]; linhas: string[] };
export const DOMINIOS = arquivo.dominios;
const porLetra = new Map(DOMINIOS.map((d) => [d.letra, d]));

/** Deslocamento da camada de domínios em hexágonos (colunas, linhas), para acertar o encaixe com o mapa.
 *  Positivo = domínios andam para a direita / para baixo. O arquivo já está registrado em +4 colunas, +1 linha. */
export const DESLOCA = { c: 0, l: 0 };
export const dominioDeHex = (h: Hex): Dominio | null => {
  const c = h.c - DESLOCA.c, l = h.l - DESLOCA.l;
  return porLetra.get(arquivo.linhas[l - 1]?.[c - 1] ?? ".") ?? null;
};
/** Domínio de um ponto do mapa (x, y como nos cadastros). */
export function dominioDe(x: number, y: number): Dominio | null {
  const h = hexDe(x, y); return h ? dominioDeHex(h) : null;
}

/** Camada: hexágonos preenchidos por domínio, fronteiras traçadas e nome de cada domínio. */
export function camadaDominios(): L.LayerGroup {
  const Preenchimento = L.GridLayer.extend({
    createTile(this: L.GridLayer, coords: L.Coords) {
      const t = this.getTileSize(), tile = L.DomUtil.create("canvas") as HTMLCanvasElement;
      const dpr = window.devicePixelRatio || 1;
      tile.width = t.x * dpr; tile.height = t.y * dpr;
      const ctx = tile.getContext("2d")!; ctx.scale(dpr, dpr);
      const esc = 2 ** coords.z;
      const nw = (this as unknown as { _map: L.Map })._map.unproject(coords.scaleBy(t), coords.z);
      const x0 = nw.lng, y0 = MAPA_ALTURA - nw.lat, larg = t.x / esc, alt = t.y / esc;
      const px = ([vx, vy]: [number, number]) => [(vx - x0) * esc, (vy - y0) * esc] as const;
      const trilha = (c: number, l: number) => { ctx.beginPath(); verticesTopo(c, l).forEach((v, i) => { const [a, b] = px(v); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.closePath(); };
      const visivel = (c: number, l: number) => { const [cx, cy] = centroTopo(c, l); return cx > x0 - HEX_LADO && cx < x0 + larg + HEX_LADO && cy > y0 - HEX_LADO && cy < y0 + alt + HEX_LADO; };
      for (let c = 1; c <= NC; c++) for (let l = 1; l <= NL; l++) {
        if (!visivel(c, l)) continue;
        const d = dominioDeHex({ c, l }); if (!d) continue;
        ctx.globalAlpha = 0.42; ctx.fillStyle = d.cor; trilha(c, l); ctx.fill();
        ctx.globalAlpha = 0.42; ctx.strokeStyle = d.cor; ctx.lineWidth = 0.7; ctx.stroke(); // fecha as frestas entre hexágonos
      }
      // fronteiras: aresta entre hexágonos de domínios diferentes (ou domínio e vazio)
      ctx.globalAlpha = 0.95; ctx.lineWidth = coords.z >= 1 ? 2.4 : 1.6; ctx.lineCap = "round";
      for (let c = 1; c <= NC; c++) for (let l = 1; l <= NL; l++) {
        if (!visivel(c, l)) continue;
        const d = dominioDeHex({ c, l }); if (!d) continue;
        const v = verticesTopo(c, l);
        const lado = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
        const dir = c & 1
          ? [{ c: c + 1, l: l + 1 }, { c, l: l + 1 }, { c: c - 1, l: l + 1 }, { c: c - 1, l }, { c, l: l - 1 }, { c: c + 1, l }]
          : [{ c: c + 1, l }, { c, l: l + 1 }, { c: c - 1, l }, { c: c - 1, l: l - 1 }, { c, l: l - 1 }, { c: c + 1, l: l - 1 }];
        lado.forEach(([a, b], i) => {
          const n = dir[i]; const outro = n.c >= 1 && n.c <= NC && n.l >= 1 && n.l <= NL ? dominioDeHex(n) : null;
          if (outro?.id === d.id) return;
          ctx.strokeStyle = d.cor; const [ax, ay] = px(v[a]), [bx, by] = px(v[b]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        });
      }
      return tile;
    },
  });
  const grupo = L.layerGroup();
  grupo.addLayer(new (Preenchimento as unknown as new (o: L.GridLayerOptions) => L.GridLayer)({ tileSize: 256, minZoom: -2, maxZoom: 2, zIndex: 2 }));
  // rótulo no hexágono do domínio mais próximo do centro do maior bloco
  for (const d of DOMINIOS) {
    const hs: Hex[] = [];
    for (let c = 1; c <= NC; c++) for (let l = 1; l <= NL; l++) if (dominioDeHex({ c, l })?.id === d.id) hs.push({ c, l });
    if (!hs.length) continue;
    // maior componente conexa
    const chave = (h: Hex) => h.l * 1000 + h.c, pertence = new Map(hs.map((h) => [chave(h), h]));
    const visto = new Set<number>(); let melhor: Hex[] = [];
    for (const h of hs) {
      if (visto.has(chave(h))) continue;
      const comp: Hex[] = [], pilha = [h]; visto.add(chave(h));
      while (pilha.length) { const u = pilha.pop()!; comp.push(u); for (const v of vizinhos(u.c, u.l)) if (pertence.has(chave(v)) && !visto.has(chave(v))) { visto.add(chave(v)); pilha.push(v); } }
      if (comp.length > melhor.length) melhor = comp;
    }
    // hexágono mais "interior" (mais longe da borda do bloco), desempatando pela proximidade do centro de massa
    const dist = new Map<number, number>(), fila: Hex[] = [];
    for (const h of melhor) if (vizinhos(h.c, h.l).some((v) => !melhor.some((m) => m.c === v.c && m.l === v.l))) { dist.set(chave(h), 0); fila.push(h); }
    const noBloco = new Set(melhor.map(chave));
    for (let i = 0; i < fila.length; i++) { const u = fila[i]; for (const v of vizinhos(u.c, u.l)) if (noBloco.has(chave(v)) && !dist.has(chave(v))) { dist.set(chave(v), dist.get(chave(u))! + 1); fila.push(v); } }
    const mx = melhor.reduce((s, h) => s + centroTopo(h.c, h.l)[0], 0) / melhor.length, my = melhor.reduce((s, h) => s + centroTopo(h.c, h.l)[1], 0) / melhor.length;
    const maxD = Math.max(...melhor.map((h) => dist.get(chave(h)) ?? 0));
    const ancora = melhor.filter((h) => (dist.get(chave(h)) ?? 0) >= maxD - 1)
      .reduce((a, b) => { const [ax, ay] = centroTopo(a.c, a.l), [bx, by] = centroTopo(b.c, b.l); return Math.hypot(ax - mx, ay - my) <= Math.hypot(bx - mx, by - my) ? a : b; });
    L.marker(centroLatLng(ancora.c, ancora.l), {
      icon: L.divIcon({ className: "rotulo-dominio", html: `<span style="--c:${d.cor}">${esc(d.nome)}</span>`, iconSize: [0, 0] }), interactive: false, keyboard: false,
    }).addTo(grupo);
  }
  return grupo;
}
