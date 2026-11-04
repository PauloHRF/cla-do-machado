# Notas para quem for mexer neste projeto (Claude ou pessoas)

Site do Clã do Machado: mapa interativo de Phantyr (Vite + TypeScript + Leaflet). A documentação do site está no `README.md`; aqui ficam o fluxo de trabalho, as convenções dos dados e as decisões tomadas.

## Fluxo de trabalho
- `npm run build` roda `tsc --noEmit` e o Vite; rode antes de commitar. O YAML do CMS (`public/admin/config.yml`) deve ser validado com `yaml.safe_load`.
- Trabalhe em branch e abra PR; **quem faz o merge é o dono**, salvo se ele pedir ("faça o merge"). PRs costumam ser mergeados antes de um commit de acompanhamento: nesse caso, recrie a branch a partir da `main` atual e abra um PR novo.
- Conflitos quase sempre estão no fim de `src/style.css` (cada PR acrescenta CSS lá): mantenha os dois lados.
- Neste ambiente: `gh pr create` falha (GraphQL); use `gh api repos/.../pulls -f ... -F body=@arquivo` e `-X PUT .../merge`. Pushes e chamadas do `gh` falham de vez em quando: repita com espera. Escreva o corpo do PR num arquivo (heredoc), não com `printf`. Não use `pkill -f` (mata o shell). Push forçado e exclusão em massa de branches são bloqueados.
- Espere permissão explícita antes de apagar conteúdo ou arquivos antigos.

## Repositórios e publicação
- Dois repositórios espelhados: `PauloHRF/cla-do-machado` e `TIteamcla/cla-do-machado`. O Netlify publica o segundo. O workflow `.github/workflows/espelho.yml` mantém os dois iguais (variável `ESPELHO_REPO`, segredo `ESPELHO_TOKEN` com *Contents* e *Workflows*). Mudanças em `.github/workflows` precisam ser feitas nos dois lados.
- O CMS (`/admin`, Sveltia) grava no repositório de `backend.repo` e entra por token do GitHub.

## Convenções dos dados
- Quando o dono manda listas (hexágonos, terreno, estradas): **a última lista enviada vale**.
- Hexágonos: `C01–C114`, `L01–L83`, topo plano, colunas ímpares meio hexágono abaixo (`src/hex.ts`). Nos cadastros `y` é medido de baixo para cima (`y = 1697 - y_do_topo`). `hexDe(x, y)` converte ponto em hexágono.
- `src/content/viagem/terreno.json`: uma string por linha da grade (`a p f m d n`); correções em `ajustes.json`.
- `estradas.json` guarda ligações entre hexágonos vizinhos. As listas do dono seguem este padrão: **adicionar** (o hexágono liga aos vizinhos da lista ou que já têm estrada), **remover** (apaga todas as ligações que tocam o hexágono), **conectar** e **desconectar** (uma ligação entre dois vizinhos).
- `dominios.json`: uma letra por hexágono; a região de um local é calculada pelo hexágono (o campo antigo `dominio` das cidades não é mais usado).
- `rotas-aquaticas.json`: cada rota liga dois portos/docas (`de`, `ate`) pelos hexágonos listados. Portos e docas são pontos (`categoria: porto|doca`).
- Mapa do mundo: ladrilhos em `public/img/mapa` (gerados por `scripts/gerar-tiles.mjs`, não editar à mão).

## Regras de viagem (resumo; detalhes no README e em `src/viagem.ts`)
1 hex = 1 dia a pé, montaria 2; terreno difícil divide por 2; estrada ignora o terreno difícil; 1 hex de água entre terras se atravessa a pé; barco 4 hex/dia (passagem só entre os dois portos da rota; barco próprio por qualquer água); voo 2 (montaria) ou 5 (Spelljammer) hex/dia em linha reta; teleporte entre os 15 pontos. Soma-se tudo e só o total é arredondado para cima, mínimo 1 dia.

## Decisões a confirmar e pendências
- Tempo do teleporte: `TELEPORTE_DIAS = 0` foi suposição (o dono ainda não passou a regra).
- A rota de Sallek a Zur'Baldar termina em Verdisar na lista original; está cadastrada como Verdisar–Zur'Baldar até o dono corrigir.
- A imagem do calendário (`public/img/calendario.webp`) tem o dia 24 faltando (mesmo erro da planilha original); a conta no site está certa. Os jornais têm 1024×1536 px; se houver versão maior, trocar.
- As imagens das estações do calendário são links do Imgur (não verificados): se caírem, subir para `public/img`.
- Há `netlify.toml` e o deploy no GitHub Pages foi removido de propósito (só Netlify).
