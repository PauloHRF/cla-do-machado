// Aba "Calendário": como funciona o calendário de Phantyr e a correlação entre o dia real e os dias de Phantyr.
import { esc, setTab } from "./ui";
import { asset } from "./data";
import { abrirLeitor } from "./jornais";

interface Mensagem { mensagem: string; imagem?: string }
interface Dados {
  dias_semana: string[];
  meses: { nome: string; estacao: string }[];
  ancora: { data_real: string; mes: string; dia: number; ano: number };
  estacoes: { nome: string; inicio: Mensagem; meio: Mensagem }[];
}
const dados = Object.values(import.meta.glob("./content/calendario/calendario.json", { eager: true, import: "default" }))[0] as Dados;

const DIAS_MES = 30, DIAS_ANO = DIAS_MES * dados.meses.length, DIAS_SEMANA = dados.dias_semana.length;
/** Um dia real tem 3 dias de Phantyr: até 8h = dia 1, até 16h = dia 2, até 0h = dia 3 (horário de Brasília). */
export const DIAS_POR_DIA_REAL = 3;
const FUSO = "America/Sao_Paulo";
const turnoDaHora = (h: number) => Math.min(DIAS_POR_DIA_REAL - 1, Math.floor(h / (24 / DIAS_POR_DIA_REAL)));
const FAIXAS = ["até as 8h", "até as 16h", "até as 0h"];

export interface DiaPhantyr {
  ano: number; mes: string; dia: number; semana: string; numSemana: number; estacao: string; especial?: Mensagem;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Dias desde 1970 do dia civil (y, m, d). */
const diaCivil = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86400000;
const [ay, am, ad] = dados.ancora.data_real.split("-").map(Number);
const ancoraReal = diaCivil(ay, am, ad);
const ancoraAbs = dados.ancora.ano * DIAS_ANO + dados.meses.findIndex((m) => m.nome === dados.ancora.mes) * DIAS_MES + (dados.ancora.dia - 1);

/** Dia de Phantyr de um dia real (contado em dias civis) e de um dos 3 turnos (0, 1 ou 2). */
export function phantyrDe(diaReal: number, turno: number): DiaPhantyr {
  const abs = ancoraAbs + (diaReal - ancoraReal) * DIAS_POR_DIA_REAL + turno;
  const ano = Math.floor(abs / DIAS_ANO), noAno = mod(abs, DIAS_ANO);
  const iMes = Math.floor(noAno / DIAS_MES), dia = (noAno % DIAS_MES) + 1;
  const mes = dados.meses[iMes], est = dados.estacoes.find((e) => e.nome === mes.estacao);
  // 1º dia da estação (1º dia do 1º mês) e meio da estação (dia 15 do 2º mês)
  const primeiroMes = dados.meses.findIndex((m) => m.estacao === mes.estacao);
  const especial = !est ? undefined : iMes === primeiroMes && dia === 1 ? est.inicio : iMes === primeiroMes + 1 && dia === 15 ? est.meio : undefined;
  return { ano, mes: mes.nome, dia, semana: dados.dias_semana[(dia - 1) % DIAS_SEMANA], numSemana: Math.floor((dia - 1) / DIAS_SEMANA) + 1, estacao: mes.estacao, especial };
}

/** Data e turno atuais no fuso de Brasília. */
function agora(): { diaReal: number; turno: number; hora: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  const hora = +p.hour;
  return { diaReal: diaCivil(+p.year, +p.month, +p.day), turno: turnoDaHora(hora), hora };
}

/** Posição absoluta (dias desde o ano 0) de um dia de Phantyr, e o caminho inverso: dia real e turno em que ele cai. */
const absDe = (ano: number, iMes: number, dia: number) => ano * DIAS_ANO + iMes * DIAS_MES + (dia - 1);
const absAtual = (a: { diaReal: number; turno: number }) => ancoraAbs + (a.diaReal - ancoraReal) * DIAS_POR_DIA_REAL + a.turno;
const realDe = (abs: number) => { const n = abs - ancoraAbs; return { diaReal: ancoraReal + Math.floor(n / DIAS_POR_DIA_REAL), turno: mod(n, DIAS_POR_DIA_REAL) }; };
const dataBr = (diaReal: number) => new Date(diaReal * 86400000).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
const paraIso = (diaReal: number) => new Date(diaReal * 86400000).toISOString().slice(0, 10);
const doIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return diaCivil(y, m, d); };
const semTitulo = (t: string) => t.replace(/^#+\s*/, "");

function cartao(i: number, d: DiaPhantyr, atual: boolean) {
  return `<div class="cal-cartao${atual ? " atual" : ""}">
    <span class="cal-faixa">Dia ${i + 1} · ${FAIXAS[i]}</span>
    <strong class="cal-dia-n">${d.dia}</strong>
    <span class="cal-semana">${esc(d.semana)}</span>
    <span class="cal-mes">${esc(d.mes)}</span>
    <span class="cal-est">${esc(d.estacao)} · ${d.ano}</span>
  </div>`;
}
function especialHtml(d: DiaPhantyr) {
  if (!d.especial) return "";
  return `<div class="cal-especial"><p>${esc(semTitulo(d.especial.mensagem))}</p>${d.especial.imagem ? `<img src="${esc(d.especial.imagem)}" alt="" loading="lazy">` : ""}</div>`;
}
function blocoDia(diaReal: number, turnoAtual: number | null) {
  const ds = [0, 1, 2].map((t) => phantyrDe(diaReal, t));
  return `<div class="cal-cartoes">${ds.map((d, i) => cartao(i, d, turnoAtual === i)).join("")}</div>${ds.map(especialHtml).join("")}`;
}
/** Uma linha por dia de Phantyr, para a lista dos próximos dias. */
function listaDia(diaReal: number) {
  const ds = [0, 1, 2].map((t) => phantyrDe(diaReal, t));
  const mudou = (d: DiaPhantyr) => d.estacao !== ds[0].estacao || d.ano !== ds[0].ano;
  return `<li class="cal-lista-dia"><h3>${esc(dataBr(diaReal))} <small>${esc(ds[0].estacao)} · ${ds[0].ano}</small></h3><ul>${ds.map((d, i) =>
    `<li><span class="muted">Dia ${i + 1}</span> ${esc(d.semana)}, ${d.dia} de ${esc(d.mes)}${mudou(d) ? ` <small>(${esc(d.estacao)} · ${d.ano})</small>` : ""}${d.especial ? ` <em>${esc(semTitulo(d.especial.mensagem))}</em>` : ""}</li>`).join("")}</ul></li>`;
}

export function montarCalendario() {
  const sec = document.createElement("section");
  sec.innerHTML = `
    <h1>Calendário</h1>
    <div class="cal-abas" role="tablist">
      <button class="btn on" data-aba="real" role="tab">Dia real × Phantyr</button>
      <button class="btn" data-aba="estrutura" role="tab">Estrutura</button>
    </div>

    <div data-painel="real">
      <h2 class="ribbon">Agora</h2>
      <div id="cal-agora"></div>
      <div class="cal-calendario" id="cal-mes"></div>
      <h2 class="ribbon">Consultar uma data</h2>
      <div class="viagem-campo"><label for="cal-data">Data real</label><div><input type="date" id="cal-data"></div></div>
      <div id="cal-consulta"></div>
      <h2 class="ribbon">Próximos dias</h2>
      <ul class="cal-lista" id="cal-proximos"></ul>
    </div>

    <div data-painel="estrutura" hidden>
      <p>O ano de Phantyr tem ${DIAS_ANO} dias, divididos em ${dados.meses.length} meses de ${DIAS_MES} dias, cada mês tem ${DIAS_MES / DIAS_SEMANA} semanas de ${DIAS_SEMANA} dias e as estações têm duração de 3 meses.</p>
      <button class="cal-imagem" data-ampliar title="Ampliar"><img src="${asset("/img/calendario.webp")}" alt="Calendário de Phantyr: 12 meses, 3 semanas de 10 dias cada" loading="lazy"></button>
    </div>`;

  const q = <T extends HTMLElement>(s: string) => sec.querySelector<T>(s)!;
  function atualizarAgora() {
    const a = agora();
    q("#cal-agora").innerHTML = `<p class="muted">${esc(dataBr(a.diaReal))}, ${String(a.hora).padStart(2, "0")}h</p><p class="cal-regra">1 dia real = ${DIAS_POR_DIA_REAL} dias de Phantyr</p>${blocoDia(a.diaReal, a.turno)}`;
    q("#cal-proximos").innerHTML = Array.from({ length: 10 }, (_, i) => listaDia(a.diaReal + i + 1)).join("");
  }
  // ----- calendário do mês de Phantyr (3 semanas de 10 dias) -----
  let ver = { ano: 0, mes: 0 }, seletor = false, anoSel = 0, escolhido: number | null = null, vistoHoje = -1;
  function desenharMes() {
    const a = agora(), hoje = absAtual(a), hojeInicio = hoje - a.turno, hd = phantyrDe(a.diaReal, a.turno);
    const m = dados.meses[ver.mes], base = absDe(ver.ano, ver.mes, 1);
    const cab = dados.dias_semana.map((d) => `<span class="cal-cab" title="${esc(d)}">${esc(d[0])}</span>`).join("");
    const cel = Array.from({ length: DIAS_MES }, (_, i) => {
      const abs = base + i, d = phantyrDe(a.diaReal + Math.floor((abs - hoje) / DIAS_POR_DIA_REAL), mod(abs - hoje + a.turno, DIAS_POR_DIA_REAL));
      const cls = abs === hoje ? " hoje" : abs >= hojeInicio && abs < hojeInicio + DIAS_POR_DIA_REAL ? " hoje-dia" : "";
      return `<button class="cal-cel${cls}${abs === escolhido ? " sel" : ""}${d.especial ? " especial" : ""}" data-abs="${abs}" aria-label="${i + 1} de ${esc(m.nome)}">${i + 1}</button>`;
    }).join("");
    let info = "";
    if (escolhido !== null) {
      const r = realDe(escolhido), d = phantyrDe(r.diaReal, r.turno);
      info = `<p class="cal-info"><strong>${esc(d.semana)}, ${d.dia} de ${esc(d.mes)} de ${d.ano}</strong><br>Dia real: ${esc(dataBr(r.diaReal))} · Dia ${r.turno + 1} (${FAIXAS[r.turno]})${d.especial ? `<br><em>${esc(semTitulo(d.especial.mensagem))}</em>` : ""}</p>`;
    }
    const meses = dados.meses.map((x, i) => `<button class="cal-mes-op${anoSel === ver.ano && i === ver.mes ? " sel" : ""}" data-mes="${i}">${esc(x.nome)}</button>`).join("");
    q("#cal-mes").innerHTML = `
      <div class="cal-mes-cab">
        <div><div class="cal-mes-titulo">${esc(m.nome)} • ${ver.ano}</div>
        <button class="cal-hoje-link" data-hoje title="Voltar para hoje">Hoje: ${hd.dia} de ${esc(hd.mes)} · ${esc(hd.estacao)}</button></div>
        <button class="btn cal-chevron" data-seletor aria-expanded="${seletor}" aria-label="Escolher mês e ano"><i class="fa-solid fa-chevron-${seletor ? "up" : "down"}"></i></button>
      </div>
      ${seletor ? `<div class="cal-seletor"><div class="cal-seletor-ano"><button class="btn" data-ano="-1" aria-label="Ano anterior"><i class="fa-solid fa-chevron-left"></i></button><strong>${anoSel}</strong><button class="btn" data-ano="1" aria-label="Próximo ano"><i class="fa-solid fa-chevron-right"></i></button></div><div class="cal-seletor-meses">${meses}</div></div>` : ""}
      <div class="cal-grade">${cab}${cel}</div>${info}`;
  }
  function irParaHoje() {
    const a = agora(), d = phantyrDe(a.diaReal, a.turno);
    ver = { ano: d.ano, mes: dados.meses.findIndex((x) => x.nome === d.mes) }; anoSel = ver.ano; escolhido = null; seletor = false; desenharMes();
  }
  q("#cal-mes").addEventListener("click", (e) => {
    const t = e.target as HTMLElement, c = t.closest<HTMLElement>("[data-abs]");
    if (c) { escolhido = escolhido === +c.dataset.abs! ? null : +c.dataset.abs!; desenharMes(); return; }
    if (t.closest("[data-hoje]")) { irParaHoje(); return; }
    if (t.closest("[data-seletor]")) { seletor = !seletor; anoSel = ver.ano; desenharMes(); return; }
    const an = t.closest<HTMLElement>("[data-ano]");
    if (an) { anoSel += +an.dataset.ano!; desenharMes(); return; }
    const ms = t.closest<HTMLElement>("[data-mes]");
    if (ms) { ver = { ano: anoSel, mes: +ms.dataset.mes! }; seletor = false; escolhido = null; desenharMes(); }
  });
  irParaHoje();

  const data = q<HTMLInputElement>("#cal-data");
  function consultar() {
    q("#cal-consulta").innerHTML = data.value ? blocoDia(doIso(data.value), null) : "";
  }
  data.value = paraIso(agora().diaReal);
  data.addEventListener("input", consultar);
  atualizarAgora(); consultar();
  setInterval(() => { atualizarAgora(); const h = absAtual(agora()); if (h !== vistoHoje) { vistoHoje = h; desenharMes(); } }, 60_000);

  sec.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-ampliar]")) { abrirLeitor(asset("/img/calendario.webp"), "Calendário de Phantyr"); return; }
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-aba]");
    if (!b) return;
    sec.querySelectorAll<HTMLElement>("[data-aba]").forEach((x) => x.classList.toggle("on", x === b));
    sec.querySelectorAll<HTMLElement>("[data-painel]").forEach((p) => (p.hidden = p.dataset.painel !== b.dataset.aba));
  });
  setTab("calendario", sec);
}
