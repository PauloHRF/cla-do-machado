// Regras de viagem do clã (1 hex = 1 dia a pé; montaria dobra; terreno difícil divide por 2; estrada ignora o terreno difícil).
import { HEX_COLUNAS as NC, HEX_LINHAS as NL, distancia, hexDe, linhaHex, type Hex } from "./hex";

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

// ---- voo: em linha reta por qualquer terreno (e água), sem estradas, barcos ou teleportes ----
export type Voo = "montaria" | "spelljammer";
export const VOOS: Record<Voo, { nome: string; hexPorDia: number }> = {
  montaria: { nome: "Montaria voadora", hexPorDia: 2 },
  spelljammer: { nome: "Spelljammer", hexPorDia: 5 },
};

export interface Perfil { montaria: boolean; ignora: Terreno[]; estradas: boolean; barco?: boolean; teleporte?: boolean; barcoProprio?: boolean; voo?: Voo }

// ---- rotas aquáticas ----
// Passagem de barco: cada rota liga dois portos/docas e só vale entre eles (embarca numa ponta, desce na outra).
// Barco próprio: navega por qualquer hexágono de água.
/** Velocidade do barco, em hexágonos por dia; cada trecho de barco é arredondado para cima em dias inteiros. */
export const BARCO_HEX_POR_DIA = 4;
export interface RotaAquatica { nome: string; de: Hex; ate: Hex; hexes: Hex[]; /** menor trajeto de `de` até `ate` dentro da rota */ trajeto: Hex[] }
function trajetoDaRota(de: Hex, ate: Hex, hexes: Hex[]): Hex[] {
  const ok = new Set([...hexes, de, ate].map((h) => `${h.c},${h.l}`)), ant = new Map<string, Hex | null>([[`${de.c},${de.l}`, null]]), fila = [de];
  for (let i = 0; i < fila.length; i++) {
    const u = fila[i]; if (u.c === ate.c && u.l === ate.l) break;
    for (const v of vizinhos(u.c, u.l)) { const k = `${v.c},${v.l}`; if (ok.has(k) && !ant.has(k)) { ant.set(k, u); fila.push(v); } }
  }
  const t: Hex[] = []; let u: Hex | null | undefined = ate;
  while (u) { t.push(u); u = ant.get(`${u.c},${u.l}`); }
  return t.reverse();
}
export const rotasAquaticas: RotaAquatica[] = (dado("rotas-aquaticas")?.rotas ?? []).map((r: { nome: string; de: string; ate: string; hexes: string[] }) => {
  const de = lerHex(r.de)!, ate = lerHex(r.ate)!, hexes = r.hexes.map(lerHex).filter(Boolean) as Hex[];
  return { nome: r.nome, de, ate, hexes, trajeto: trajetoDaRota(de, ate, hexes) };
});
const naRota = new Set<string>(rotasAquaticas.flatMap((r) => r.hexes.map((h) => `${h.c},${h.l}`)));
export const estaEmRotaAquatica = (h: Hex) => naRota.has(`${h.c},${h.l}`);
const mesmo = (a: Hex, b: Hex) => a.c === b.c && a.l === b.l;
const diasBarco = (r: RotaAquatica) => Math.ceil((r.trajeto.length - 1) / BARCO_HEX_POR_DIA);
/** Rotas que saem do hexágono h (é um porto/doca de ponta), com o sentido já aplicado. */
const rotasDe = new Map<string, { rota: RotaAquatica; trajeto: Hex[] }[]>();
for (const r of rotasAquaticas) {
  if (r.trajeto.length < 2) continue;
  for (const [h, tr] of [[r.de, r.trajeto], [r.ate, [...r.trajeto].reverse()]] as [Hex, Hex[]][]) {
    const k = `${h.c},${h.l}`; (rotasDe.get(k) ?? rotasDe.set(k, []).get(k)!).push({ rota: r, trajeto: tr });
  }
}
const navegavel = (h: Hex) => terrenoDe(h) === "agua" || estaEmRotaAquatica(h);
/** Rotas que saem do hexágono h, já no sentido h → destino, com os dias de passagem. */
export function rotasDoHex(h: Hex): { rota: RotaAquatica; destino: Hex; trajeto: Hex[]; dias: number }[] {
  return (rotasDe.get(`${h.c},${h.l}`) ?? []).map(({ rota, trajeto }) => ({ rota, destino: trajeto[trajeto.length - 1], trajeto, dias: diasBarco(rota) }));
}
/** Passo livre de quem tem barco próprio: os dois hexágonos são de água (ou portos/docas das rotas). */
function viaBarcoProprio(a: Hex, b: Hex, p: Perfil): boolean {
  return !!p.barcoProprio && navegavel(a) && navegavel(b) && 1 / BARCO_HEX_POR_DIA <= custoTerra(a, b, p);
}
/** Trecho do caminho (a partir do índice i) feito por passagem de barco numa rota inteira; devolve o número de passos. */
function passagemEm(caminho: Hex[], i: number, p: Perfil): { passos: number; rota: RotaAquatica } | null {
  if (!p.barco) return null;
  for (const { rota, trajeto } of rotasDe.get(`${caminho[i].c},${caminho[i].l}`) ?? []) {
    const n = trajeto.length - 1;
    if (i + n < caminho.length && trajeto.every((h, k) => mesmo(h, caminho[i + k]))) return { passos: n, rota };
  }
  return null;
}
/** Para cada passo i (de caminho[i-1] a caminho[i]), se foi feito de barco e o custo. */
function passosDe(caminho: Hex[], p: Perfil): { barco: boolean; custo: number; teleporte: boolean; proprio?: boolean; voo?: boolean }[] {
  if (p.voo) return caminho.map((_, i) => ({ barco: false, custo: i ? 1 / VOOS[p.voo!].hexPorDia : 0, teleporte: false, voo: true }));
  const r: { barco: boolean; custo: number; teleporte: boolean; proprio?: boolean }[] = [{ barco: false, custo: 0, teleporte: false }];
  for (let i = 0; i < caminho.length - 1; i++) {
    const pass = passagemEm(caminho, i, p);
    if (pass) { for (let k = 0; k < pass.passos; k++) r.push({ barco: true, custo: diasBarco(pass.rota) / pass.passos, teleporte: false }); i += pass.passos - 1; continue; }
    const a = caminho[i], b = caminho[i + 1];
    if (viaTeleporte(a, b, p)) r.push({ barco: false, custo: TELEPORTE_DIAS, teleporte: true });
    else if (viaBarcoProprio(a, b, p)) r.push({ barco: true, custo: 1 / BARCO_HEX_POR_DIA, teleporte: false, proprio: true });
    else r.push({ barco: false, custo: custoTerra(a, b, p), teleporte: false });
  }
  // barco próprio: cada trecho contínuo é arredondado para cima em dias inteiros
  for (let i = 1; i < r.length; i++) {
    if (!r[i].proprio) continue;
    let j = i; while (j + 1 < r.length && r[j + 1].proprio) j++;
    const total = r.slice(i, j + 1).reduce((x, y) => x + y.custo, 0), alvo = Math.ceil(total - 1e-9);
    for (let k = i; k <= j; k++) r[k].custo *= alvo / total;
    i = j;
  }
  return r;
}

// ---- teleportes (rede entre os pontos de teleporte; todos se ligam entre si) ----
/** Dias gastos em um teleporte entre dois pontos da rede (a confirmar com a equipe; hoje instantâneo). */
export const TELEPORTE_DIAS = 0;
const pontosTp = import.meta.glob("./content/pontos/*.json", { eager: true, import: "default" }) as Record<string, any>;
export const hexesTeleporte: Hex[] = Object.values(pontosTp)
  .filter((d) => d.categoria === "teleporte").map((d) => hexDe(d.x, d.y)).filter(Boolean) as Hex[];
const noTp = new Set<string>(hexesTeleporte.map((h) => `${h.c},${h.l}`));
export const eTeleporte = (h: Hex) => noTp.has(`${h.c},${h.l}`);
const mesmoHex = (a: Hex, b: Hex) => a.c === b.c && a.l === b.l;
/** Passo de teleporte: dois pontos distintos da rede que não são vizinhos. */
function viaTeleporte(a: Hex, b: Hex, p: Perfil): boolean {
  return !!p.teleporte && !mesmoHex(a, b) && eTeleporte(a) && eTeleporte(b) && distancia(a, b) > 1;
}

/** Dias para entrar no hexágono b vindo do vizinho a. */
export function custoPasso(a: Hex, b: Hex, p: Perfil): number {
  if (viaTeleporte(a, b, p)) return TELEPORTE_DIAS;
  return viaBarcoProprio(a, b, p) ? 1 / BARCO_HEX_POR_DIA : custoTerra(a, b, p);
}

function custoTerra(a: Hex, b: Hex, p: Perfil): number {
  const t = terrenoDe(b);
  // água não se atravessa, exceto: onde há estrada (ponte ou vau, vale como terreno normal) ou quando é só 1 hexágono
  // de água entre terra e terra (sem barco; não pode vir de outro hexágono de água)
  if (t === "agua") return (p.estradas && temEstrada(a, b)) || terrenoDe(a) !== "agua" ? 1 / (p.montaria ? 2 : 1) : Infinity;
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
  const passos = passosDe(caminho, p);
  for (let i = 1; i < caminho.length; i++) {
    const t = terrenoDe(caminho[i]), st = passos[i];
    if (st.voo) {
      const rot = VOOS[p.voo!].nome, e = mapa.get(rot) ?? { rotulo: rot, hexes: 0, dias: 0 };
      e.hexes++; e.dias += st.custo; mapa.set(rot, e); continue;
    }
    const noEstrada = p.estradas && temEstrada(caminho[i - 1], caminho[i]);
    if (!isFinite(st.custo)) continue; // 2 ou mais hexágonos de água seguidos, sem estrada nem barco: fora da conta (ver aviso na tela)
    const rotulo = st.teleporte ? "Teleporte" : st.barco ? (st.proprio ? "Barco próprio" : "Rota aquática (barco)") : t === "agua" ? (noEstrada ? "Ponte/vau (estrada sobre água)" : "Travessia de 1 hex de água") : `${TERRENOS[t].nome}${noEstrada ? " (estrada)" : ""}`;
    const e = mapa.get(rotulo) ?? { rotulo, hexes: 0, dias: 0 };
    e.hexes++; e.dias += st.custo; mapa.set(rotulo, e);
  }
  return [...mapa.values()].sort((a, b) => b.dias - a.dias);
}

/** Tempo de um caminho desenhado à mão (sequência de hexágonos vizinhos). `agua` = hexágonos de água no trajeto. */
export function avaliarCaminho(caminho: Hex[], p: Perfil): { dias: number; passos: number; detalhe: Rota["detalhe"]; agua: Hex[] } {
  let dias = 0; const agua: Hex[] = [], passos = passosDe(caminho, p);
  for (let i = 1; i < caminho.length; i++) {
    const c = passos[i].custo;
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
  if (p.voo) { // em linha reta
    const caminho = linhaHex(de, ate), direta = distancia(de, ate);
    return { caminho, dias: direta / VOOS[p.voo].hexPorDia, passos: caminho.length - 1, direta, detalhe: resumirCaminho(caminho, p) };
  }
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
    if (p.barco) for (const { rota, trajeto } of rotasDe.get(`${hu.c},${hu.l}`) ?? []) {
      const v = trajeto[trajeto.length - 1], nd = d + diasBarco(rota);
      if (nd < dist[id(v)]) { dist[id(v)] = nd; ant[id(v)] = u; heap.push(nd, id(v)); }
    }
    if (p.teleporte && eTeleporte(hu)) for (const v of hexesTeleporte) {
      const nd = d + TELEPORTE_DIAS;
      if (!mesmoHex(hu, v) && nd < dist[id(v)]) { dist[id(v)] = nd; ant[id(v)] = u; heap.push(nd, id(v)); }
    }
  }
  if (!isFinite(dist[id(ate)])) return null;
  const caminho: Hex[] = []; let u = id(ate);
  while (u !== -1) { caminho.push({ c: (u % NC) + 1, l: Math.floor(u / NC) + 1 }); u = ant[u]; }
  caminho.reverse();
  // passos que não são entre vizinhos: passagem de barco (insere o trajeto da rota) ou teleporte (fica direto)
  for (let i = caminho.length - 2; i >= 0; i--) {
    const a = caminho[i], b = caminho[i + 1];
    if (distancia(a, b) <= 1) continue;
    const r = p.barco ? (rotasDe.get(`${a.c},${a.l}`) ?? []).filter((x) => mesmo(x.trajeto[x.trajeto.length - 1], b)).sort((x, y) => diasBarco(x.rota) - diasBarco(y.rota))[0] : undefined;
    if (r && !(p.teleporte && eTeleporte(a) && eTeleporte(b) && TELEPORTE_DIAS <= diasBarco(r.rota))) caminho.splice(i, 2, ...r.trajeto);
  }
  const detalhe = resumirCaminho(caminho, p);
  return { caminho, dias: passosDe(caminho, p).reduce((x, y) => x + (isFinite(y.custo) ? y.custo : 0), 0), passos: caminho.length - 1, direta: distancia(de, ate), detalhe };
}
