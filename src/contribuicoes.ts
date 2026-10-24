// Aba "Contribuições": texto + botão para o formulário. Vale também nos mapas de cidade.
import { setTab } from "./ui";

// Formulário de contribuições (Google Forms).
const FORM_CONTRIBUICAO = "https://docs.google.com/forms/d/e/1FAIpQLScDq7qH77lk4I6lwNW2wzyADpi5Il3siH3i_UqCB7jpfem08w/viewform";

export function montarContribuicoes() {
  const contrib = document.createElement("section");
  contrib.innerHTML = `
    <h1>Aventurando-se no Clã do Machado</h1>
    <p class="destaque">Phantyr é feito das histórias de quem o explora.</p>
    <p>Cada aventura deixa marcas, revela segredos e dá vida a novos lugares. E quem melhor para contar essas histórias do que aqueles que as vivenciaram?</p>
    <p>Compartilhe suas descobertas, relate acontecimentos marcantes e registre localidades que merecem ser conhecidas. Seja uma vila visitada, um personagem importante, um evento memorável ou um mistério desvendado.</p>
    <p>Sua aventura também faz parte da história do mundo. Registre suas experiências e ajude a construir o legado do Clã do Machado.</p>
    <div class="actions"><a class="btn primary" href="${FORM_CONTRIBUICAO}" target="_blank" rel="noopener"><i class="fa-solid fa-feather-pointed"></i> Adicionar contribuição</a></div>`;
  setTab("contribuicoes", contrib);
}
