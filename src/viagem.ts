// Regras de viagem do clã (1 hex = 1 dia a pé; montaria dobra; terreno difícil divide por 2; estrada ignora o terreno difícil).
import { HEX_COLUNAS as NC, HEX_LINHAS as NL, distancia, type Hex } from "./hex";

export type Terreno = "agua" | "planicie" | "floresta" | "montanha" | "deserto" | "neve";
export const TERRENOS: Record<Terreno, { nome: string; cor: string; dificil: boolean }> = {
  agua: { nome: "Água", cor: "#2a6fd6", dificil: false },
  planicie: { nome: "Planície", cor: "#8fd14f", dificil: false },
  floresta: { nome: "Floresta", cor: "#1f7a2e", dificil: true },
  montanha: { nome: "Montanha", cor: "#8a5a36", dificil: true },
  deserto: { nome: "Deserto", cor: "#f0c93c", dificil: true },
  neve: { nome: "Neve", cor: "#f2f2ff", dificil: true },
};
const COD: Record<string, Terreno> = { a: "agua", p: "planicie", f: "floresta", m: "montanha", d: "deserto", n: "neve" };

interface Ajustes {
  terreno?: { hex: string; terreno: Terreno }[];
  estradas?: { nome?: string; hexes: { hex: string }[] | string[] }[];
  remover?: { de: string; ate: string }[];
}
const arquivos = import.meta.glob("./content/viagem/*.json", { eager: true, import: "default" }) as Record<string, any>;
const dado = (nome: string) => arquivos[`./content/viagem/${nome}.json`];

/** "C45-L32", "c45 l32" ou "45-32" → { c: 45, l: 32 } */
export function lerHex(s: string): Hex | null {
  const m = /(\d+)\D+(\d+)/.exec(s);
  return m ? { c: +m[1], l: +m[2] } : null;
}
const dentro = (c: number, l: number) => c >= 1 && c <= NC && l >= 1 && l <= NL;

/** Vizinhos (colunas ímpares ficam meio hexágono mais abaixo). */
export function vizinhos(c: number, l: number): Hex[] {
  const v: [number, number][] = c & 1
    ? [[c, l - 1], [c, l + 1], [c + 1, l], [c + 1, l + 1], [c - 1, l], [c - 1, l + 1]]
    : [[c, l - 1], [c, l + 1], [c + 1, l - 1], [c + 1, l], [c - 1, l - 1], [c - 1, l]];
  return v.filter(([a, b]) => dentro(a, b)).map(([a, b]) => ({ c: a, l: b }));
}

const terr: Terreno[][] = (dado("terreno").linhas as string[]).map((r) => [...r].map((ch) => COD[ch] ?? "agua"));
const aresta = (a: Hex, b: Hex) => (a.c < b.c || (a.c === b.c && a.l < b.l) ? `${a.c},${a.l}-${b.c},${b.l}` : `${b.c},${b.l}-${a.c},${a.l}`);
const estradas = new Set<string>();

(function aplicar() {
  for (const [a, b, c, d] of dado("estradas").arestas as number[][]) estradas.add(aresta({ c: a, l: b }, { c, l: d }));
  const aj = (dado("ajustes") ?? {}) as Ajustes;
  for (const t of aj.terreno ?? []) { const h = lerHex(t.hex); if (h && dentro(h.c, h.l) && TERRENOS[t.terreno]) terr[h.l - 1][h.c - 1] = t.terreno; }
  for (const e of aj.estradas ?? []) {
    const hs = (e.hexes as (string | { hex: string })[]).map((x) => lerHex(typeof x === "string" ? x : x.hex)).filter(Boolean) as Hex[];
    for (let i = 1; i < hs.length; i++) {
      if (vizinhos(hs[i - 1].c, hs[i - 1].l).some((n) => n.c === hs[i].c && n.l === hs[i].l)) estradas.add(aresta(hs[i - 1], hs[i]));
      else console.warn("Estrada: hexágonos não vizinhos", hs[i - 1], hs[i]);
    }
  }
  for (const r of aj.remover ?? []) { const a = lerHex(r.de), b = lerHex(r.ate); if (a && b) estradas.delete(aresta(a, b)); }
})();

export const terrenoDe = (h: Hex): Terreno => terr[h.l - 1]?.[h.c - 1] ?? "agua";
export const temEstrada = (a: Hex, b: Hex) => estradas.has(aresta(a, b));
export const todasEstradas = (): [Hex, Hex][] =>
  [...estradas].map((k) => { const [a, b] = k.split("-").map((p) => p.split(",").map(Number)); return [{ c: a[0], l: a[1] }, { c: b[0], l: b[1] }]; });

export interface Perfil { montaria: boolean; ignora: Terreno[]; estradas: boolean; barco?: boolean }

// ---- rotas aquáticas (passagem de barco entre portos e docas) ----
/** Velocidade de quem viaja por rota aquática, em hexágonos por dia (a confirmar com a equipe; hoje igual à montaria). */
export const BARCO_HEX_POR_DIA = 2;
export interface RotaAquatica { nome: string; hexes: Hex[] }
export const rotasAquaticas: RotaAquatica[] = (dado("rotas-aquaticas")?.rotas ?? []).map((r: { nome: string; hexes: string[] }) => ({
  nome: r.nome, hexes: r.hexes.map(lerHex).filter(Boolean) as Hex[],
}));
const naRota = new Set<string>(rotasAquaticas.flatMap((r) => r.hexes.map((h) => `${h.c},${h.l}`)));
export const estaEmRotaAquatica = (h: Hex) => naRota.has(`${h.c},${h.l}`);
/** Passo feito pela rota aquática: os dois hexágonos fazem parte das rotas e o barco é pelo menos tão rápido quanto a pé. */
function viaBarco(a: Hex, b: Hex, p: Perfil): boolean {
  return !!p.barco && estaEmRotaAquatica(a) && estaEmRotaAquatica(b) && 1 / BARCO_HEX_POR_DIA <= custoTerra(a, b, p);
}

/** Dias para entrar no hexágono b vindo do vizinho a. */
export function custoPasso(a: Hex, b: Hex, p: Perfil): number {
  return viaBarco(a, b, p) ? 1 / BARCO_HEX_POR_DIA : custoTerra(a, b, p);
}

function custoTerra(a: Hex, b: Hex, p: Perfil): number {
  const t = terrenoDe(b);
  // água não se atravessa, exceto onde há estrada (ponte ou vau): a estrada que cruza um rio vale como terreno normal
  if (t === "agua") return p.estradas && temEstrada(a, b) ? 1 / (p.montaria ? 2 : 1) : Infinity;
  let vel = p.montaria ? 2 : 1;
  if (TERRENOS[t].dificil && !(p.montaria && p.ignora.includes(t)) && !(p.estradas && temEstrada(a, b))) vel /= 2;
  return 1 / vel;
}

export interface Rota {
  caminho: Hex[]; dias: number; passos: number; direta: number;
  /** hexágonos e dias por tipo: cada terreno, com ou sem estrada */
  detalhe: { rotulo: string; hexes: number; dias: number }[];
}

function resumirCaminho(caminho: Hex[], p: Perfil): Rota["detalhe"] {
  const mapa = new Map<string, { rotulo: string; hexes: number; dias: number }>();
  for (let i = 1; i < caminho.length; i++) {
    const t = terrenoDe(caminho[i]);
    const noEstrada = p.estradas && temEstrada(caminho[i - 1], caminho[i]);
    const barco = viaBarco(caminho[i - 1], caminho[i], p);
    if (t === "agua" && !noEstrada && !barco) continue; // água sem estrada nem rota não tem custo definido (ver aviso na tela)
    const rotulo = barco ? "Rota aquática (barco)" : t === "agua" ? "Ponte/vau (estrada sobre água)" : `${TERRENOS[t].nome}${noEstrada ? " (estrada)" : ""}`;
    const e = mapa.get(rotulo) ?? { rotulo, hexes: 0, dias: 0 };
    e.hexes++; e.dias += custoPasso(caminho[i - 1], caminho[i], p); mapa.set(rotulo, e);
  }
  return [...mapa.values()].sort((a, b) => b.dias - a.dias);
}

/** Tempo de um caminho desenhado à mão (sequência de hexágonos vizinhos). `agua` = hexágonos de água no trajeto. */
export function avaliarCaminho(caminho: Hex[], p: Perfil): { dias: number; passos: number; detalhe: Rota["detalhe"]; agua: Hex[] } {
  let dias = 0; const agua: Hex[] = [];
  for (let i = 1; i < caminho.length; i++) {
    const c = custoPasso(caminho[i - 1], caminho[i], p);
    if (!isFinite(c)) { agua.push(caminho[i]); continue; }   // água sem estrada: fora da conta
    dias += c;
  }
  return { dias, passos: caminho.length - 1, detalhe: resumirCaminho(caminho, p), agua };
}

class Heap {
  private a: [number, number][] = [];
  get tamanho() { return this.a.length; }
  push(p: number, v: number) {
    const a = this.a; a.push([p, v]); let i = a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
  }
  pop(): [number, number] {
    const a = this.a, topo = a[0], fim = a.pop()!;
    if (a.length) {
      a[0] = fim; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; }
    }
    return topo;
  }
}

/** Menor tempo entre dois hexágonos (Dijkstra). Retorna null se não houver caminho por terra. */
export function calcularRota(de: Hex, ate: Hex, p: Perfil): Rota | null {
  const id = (h: Hex) => (h.l - 1) * NC + (h.c - 1);
  const dist = new Float64Array(NC * NL).fill(Infinity), ant = new Int32Array(NC * NL).fill(-1);
  const heap = new Heap(); dist[id(de)] = 0; heap.push(0, id(de));
  while (heap.tamanho) {
    const [d, u] = heap.pop(); if (d > dist[u]) continue;
    const hu = { c: (u % NC) + 1, l: Math.floor(u / NC) + 1 };
    if (u === id(ate)) break;
    for (const v of vizinhos(hu.c, hu.l)) {
      const w = custoPasso(hu, v, p), nd = d + w;
      if (nd < dist[id(v)]) { dist[id(v)] = nd; ant[id(v)] = u; heap.push(nd, id(v)); }
    }
  }
  if (!isFinite(dist[id(ate)])) return null;
  const caminho: Hex[] = []; let u = id(ate);
  while (u !== -1) { caminho.push({ c: (u % NC) + 1, l: Math.floor(u / NC) + 1 }); u = ant[u]; }
  caminho.reverse();
  const detalhe = resumirCaminho(caminho, p);
  return { caminho, dias: dist[id(ate)], passos: caminho.length - 1, direta: distancia(de, ate), detalhe };
}
