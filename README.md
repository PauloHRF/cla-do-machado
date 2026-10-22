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
