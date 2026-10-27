# Clã do Machado — mapa de Phantyr

Site estático (Vite + TypeScript + Leaflet). Todo o conteúdo fica em `src/content/**.json` e é editável em `/admin`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # gera dist/
```

## Onde fica cada coisa
- `src/content/cidades` – cidades do mapa-múndi (posição `x`/`y`, ficha, texto, linha do tempo)
- `src/content/pontos` – assentamentos, covis, dungeons e pontos de interesse
- `src/content/panteao` – história e deuses (abrem em janela)
- `src/content/mapas-cidade` – mapas internos de cidade (`#/cidade/komora`), com NPCs
- `public/img` – imagens (use WebP)
- `public/img/mapa` – mapa do mundo em ladrilhos (não editar à mão). Para trocar o mapa, gere de novo a partir da imagem em alta resolução (proporção 2000:1697):
  `node scripts/gerar-tiles.mjs "caminho/do/mapa.webp"` (usa o `sharp`, já instalado com `npm install`).

Links: `#/local/<arquivo-da-cidade>` abre um local; `#/cidade/<mapa>` abre o mapa da cidade.
Para descobrir coordenadas: segure **Shift** e clique no mapa (copia `x, y`).

## Publicar (Netlify)
1. Suba esta pasta para um repositório no GitHub (a pasta do projeto deve ser a raiz do repositório).
2. No Netlify: *Add new site → Import from Git*. O `netlify.toml` já define build e publicação.

## CMS (/admin)
1. Em `public/admin/config.yml`, troque `SEU-USUARIO/cla-do-machado` pelo repositório.
2. Acesse `/admin`, entre com GitHub (quem edita precisa de acesso de escrita ao repositório). Cada “Salvar” vira um commit e o Netlify republica.
3. Em desenvolvimento, `local_backend: true` edita os arquivos locais.

## Hexágonos (coordenadas do mapa)
O mapa do mundo tem uma grade de hexágonos de topo plano. `src/hex.ts` descreve essa grade (medida sobre a arte de 8192 px) e converte entre pontos do mapa e hexágonos.

- Numeração: colunas **C01–C114** (esquerda → direita) e linhas **L01–L83** (de cima para baixo). Colunas ímpares ficam meio hexágono mais abaixo. Exemplo: `C72-L41`.
- Aparece ao passar o mouse (canto inferior direito), no **Shift+clique**, na etiqueta "Hex ..." da página de cada local, e a grade pode ser ligada em *Mapas → Grade de hexágonos* (números no zoom máximo).
- `distancia(a, b)` dá a distância em hexágonos (base para o cálculo de tempo de viagem).
- A grade tem erro de poucos pixels no pior caso (≈7% de um hexágono). Para empurrar a grade inteira, ajuste `AJUSTE_Y` em `src/hex.ts` (positivo = desce).

## Viagem (tempo entre dois pontos)
Aba **Viagem** no menu: escolha origem e destino (nome do local, `C45-L32` ou clicando no mapa), diga se o grupo tem montaria e o que ela ignora, e o site calcula o menor tempo pela regra do clã:
- 1 hex = 1 dia a pé; todo o grupo montado = 2 hex por dia.
- Terreno difícil (floresta, montanha, deserto, neve) divide a velocidade por 2; água não se atravessa, exceto onde há estrada (ponte ou vau): a estrada sobre a água vale como terreno normal.
- A montaria pode ignorar um terreno difícil (ex.: camelo no deserto, bode na montanha); a estrada ignora o terreno difícil.

Os dados ficam em `src/content/viagem/`:
- `terreno.json`: o terreno de cada hexágono (uma linha de texto por linha da grade). **Foi lido automaticamente da cor do mapa e pode ter erros.**
- `estradas.json`: ligações de estrada entre hexágonos vizinhos, detectadas pelo desenho pontilhado do mapa. **Incompleto e com alguns falsos traços.**
- `ajustes.json`: correções feitas pela equipe (terreno de um hexágono, estradas acrescentadas ou removidas). Editável em `/admin → Viagem`. Para conferir, ligue *Mapas → Terreno (conferência)* e *Estradas (conferência)* e use a grade de hexágonos e o rótulo do mouse para saber a coordenada.

## Domínios
Os domínios são definidos por hexágono em `src/content/viagem/dominios.json` (mesma grade do terreno: uma linha de texto por linha L01–L83, uma letra por coluna; `.` = sem domínio; as letras ligam à lista de domínios com nome e cor). Foi lido do desenho dos domínios por registro de imagem: o desenho foi encaixado sobre a imagem de referência (domínios sobre o mapa) e o centro de cada hexágono do mapa lê a cor do desenho naquele ponto (os hexágonos do desenho são ~3% maiores que os do mapa, então não há correspondência 1 para 1).
- Ligue *Filtros → Regiões* para ver o preenchimento, as fronteiras e os nomes.
- A etiqueta "Região: ..." da página de cada cidade e ponto agora é calculada pelo hexágono onde ele está (o campo antigo `dominio` dos cadastros não é mais usado).
- Para mudar um domínio, edite a letra do hexágono no arquivo (a coluna é a posição na linha).

## Alcance do Clã
Camada *Filtros → Alcance do Clã (temporada 4)*: todos os hexágonos a até **10 passos** do hexágono de Sheidrost (`src/alcance.ts`: `RAIO` e `CENTRO_SLUG`). É calculada pela grade de hexágonos, sem imagem.

## Jornais
Aba **Jornais** no menu: lista as edições (`src/content/jornais`, mais recentes primeiro). Cada edição é um arquivo JSON com `nome`, `edicao`, `data`, `manchete` e `imagem` (em `public/img/jornais/`). Clicar na miniatura abre a imagem em tamanho grande. Também dá para cadastrar pelo `/admin → Jornais`. Use imagens grandes (ex.: 1200 px de largura, WebP) para o texto ficar legível.

## Botão do link de um local
Cidades e pontos podem ter um **link externo** (vira um botão na página do local). O campo **"Texto do botão do link"** (`link_texto`, no `/admin`) personaliza o texto (ex.: "Ouvir a música"); vazio = "Abrir link". Em cidades que têm mapa de cidade, o botão "Mapa" externo não aparece (só o "Mapa da cidade", em verde).

## Rotas aquáticas
Em `src/content/viagem/rotas-aquaticas.json`: 39 rotas, cada uma ligando **dois** portos/docas (`de` → `ate`) pelos hexágonos listados. Na aba **Viagem**: **"Usar passagens de barco"** só deixa embarcar numa ponta e descer na outra, pelo trajeto da rota, a `BARCO_HEX_POR_DIA` (4, arredondando cada trecho para cima em dias inteiros) hexágonos por dia (`src/viagem.ts`); rotas se encadeiam pelos portos em comum. **"Tenho barco próprio"** navega por qualquer hexágono de água (portos e docas incluídos). Nos dois casos o tempo de cada trecho de barco é arredondado para cima em dias inteiros. Ao clicar num porto ou doca no mapa, o painel lista as rotas que saem dele (destino, hexágonos e dias) e desenha as rotas no mapa. A passagem paga não entra na conta. *Filtros → Rotas aquáticas* mostra as rotas no mapa.

**Voo:** o seletor **Transporte** troca para *Montaria voadora* (2 hex/dia) ou *Spelljammer* (5 hex/dia): voa em linha reta até qualquer ponto, sem depender de terreno, água, estradas, barcos ou teleportes (`VOOS` em `src/viagem.ts`).

**Teleportes:** a caixa **"Usar teleportes"** liga os 15 pontos de teleporte entre si (todos com todos), a `TELEPORTE_DIAS` (0) dias por salto (`src/viagem.ts`, valor a confirmar). O cálculo escolhe sozinho se compensa teleportar; no desenho à mão, clique num ponto de teleporte e depois em outro para fazer o salto.

