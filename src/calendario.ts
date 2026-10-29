// Aba "Calendário": como funciona o calendário de Phantyr e a correlação entre o dia real e os dias de Phantyr.
import { esc, setTab } from "./ui";

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
  const meses = dados.meses.map((m, i) => `<tr><td>${esc(m.nome)}</td><td>${i * DIAS_MES + 1} a ${(i + 1) * DIAS_MES}</td><td>${esc(m.estacao)}</td></tr>`).join("");
  sec.innerHTML = `
    <h1>Calendário</h1>
    <div class="cal-abas" role="tablist">
      <button class="btn on" data-aba="como" role="tab">Como funciona</button>
      <button class="btn" data-aba="real" role="tab">Dia real × Phantyr</button>
    </div>

    <div data-painel="como">
      <p>O ano de Phantyr tem <strong>${DIAS_ANO} dias</strong>, divididos em <strong>${dados.meses.length} meses de ${DIAS_MES} dias</strong>. Cada mês tem <strong>${DIAS_MES / DIAS_SEMANA} semanas de ${DIAS_SEMANA} dias</strong>, e cada dia da semana tem um nome.</p>
      <h2 class="ribbon">Dias da semana</h2>
      <ol class="cal-semana-lista">${dados.dias_semana.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <h2 class="ribbon">Meses e estações</h2>
      <table class="viagem-tab"><thead><tr><th>Mês</th><th>Dias do ano</th><th>Estação</th></tr></thead><tbody>${meses}</tbody></table>
      <p class="muted">Cada estação dura três meses e começa no primeiro dia do primeiro mês dela. O ano começa na Primavera.</p>
    </div>

    <div data-painel="real" hidden>
      <p><strong>1 dia real = ${DIAS_POR_DIA_REAL} dias de Phantyr</strong> (horário de Brasília):</p>
      <ul class="cal-turnos"><li><strong>Dia 1:</strong> ${FAIXAS[0]}</li><li><strong>Dia 2:</strong> ${FAIXAS[1]}</li><li><strong>Dia 3:</strong> ${FAIXAS[2]}</li></ul>
      <h2 class="ribbon">Agora</h2>
      <div id="cal-agora"></div>
      <h2 class="ribbon">Consultar uma data</h2>
      <div class="viagem-campo"><label for="cal-data">Data real</label><div><input type="date" id="cal-data"></div></div>
      <div id="cal-consulta"></div>
      <h2 class="ribbon">Próximos dias</h2>
      <ul class="cal-lista" id="cal-proximos"></ul>
    </div>`;

  const q = <T extends HTMLElement>(s: string) => sec.querySelector<T>(s)!;
  function atualizarAgora() {
    const a = agora();
    q("#cal-agora").innerHTML = `<p class="muted">${esc(dataBr(a.diaReal))}, ${String(a.hora).padStart(2, "0")}h</p>${blocoDia(a.diaReal, a.turno)}`;
    q("#cal-proximos").innerHTML = Array.from({ length: 10 }, (_, i) => listaDia(a.diaReal + i + 1)).join("");
  }
  const data = q<HTMLInputElement>("#cal-data");
  function consultar() {
    q("#cal-consulta").innerHTML = data.value ? blocoDia(doIso(data.value), null) : "";
  }
  data.value = paraIso(agora().diaReal);
  data.addEventListener("input", consultar);
  atualizarAgora(); consultar();
  setInterval(atualizarAgora, 60_000);

  sec.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-aba]");
    if (!b) return;
    sec.querySelectorAll<HTMLElement>("[data-aba]").forEach((x) => x.classList.toggle("on", x === b));
    sec.querySelectorAll<HTMLElement>("[data-painel]").forEach((p) => (p.hidden = p.dataset.painel !== b.dataset.aba));
  });
  setTab("calendario", sec);
}
