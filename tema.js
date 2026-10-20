// Tema claro ou escuro. Carregado no <head>, antes de a página aparecer, para não piscar branco.
// Sem escolha salva, segue o aparelho. O botão [data-alternar-tema] troca o tema; se a troca
// cair no mesmo tema do aparelho, a escolha é apagada e a página volta a seguir o aparelho.
(function () {
  const CHAVE = 'escala-tema';
  const raiz = document.documentElement;
  const aparelho = window.matchMedia('(prefers-color-scheme: dark)');

  function ler() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravar(valor) {
    // Aba anônima ou armazenamento bloqueado: a escolha vale só até fechar a página.
    try { if (valor) localStorage.setItem(CHAVE, valor); else localStorage.removeItem(CHAVE); } catch (e) { /* segue sem salvar */ }
  }

  let escolhido = ler();
  const doAparelho = () => (aparelho.matches ? 'escuro' : 'claro');

  function aplicar() {
    const tema = escolhido === 'claro' || escolhido === 'escuro' ? escolhido : doAparelho();
    raiz.dataset.tema = tema;
    const cor = document.querySelector('meta[name="theme-color"]');
    if (cor) cor.content = tema === 'escuro' ? '#121418' : '#ffffff';
    const rotulo = tema === 'escuro' ? 'Usar o modo claro' : 'Usar o modo escuro';
    document.querySelectorAll('[data-alternar-tema]').forEach((b) => {
      b.setAttribute('aria-label', rotulo);
      b.title = rotulo;
    });
  }

  aplicar();
  if (aparelho.addEventListener) aparelho.addEventListener('change', aplicar);
  else if (aparelho.addListener) aparelho.addListener(aplicar); // Safari antigo
  // Outra aba trocou o tema: acompanha.
  window.addEventListener('storage', (ev) => {
    if (ev.key === CHAVE) { escolhido = ev.newValue; aplicar(); }
  });
  document.addEventListener('DOMContentLoaded', aplicar);
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-alternar-tema]')) return;
    const novo = raiz.dataset.tema === 'escuro' ? 'claro' : 'escuro';
    escolhido = novo === doAparelho() ? null : novo;
    gravar(escolhido);
    aplicar();
  });
})();
