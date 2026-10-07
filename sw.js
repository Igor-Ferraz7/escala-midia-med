// Service worker da escala: só cuida das notificações. Não guarda a página em cache,
// então uma versão nova do site aparece assim que é publicada.

// O config.js escreve em window.ESCALA_CONFIG; aqui não existe window, então apontamos para self.
self.window = self;
importScripts('config.js');
const API = ((self.ESCALA_CONFIG && self.ESCALA_CONFIG.urlPlanilha) || '').trim();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

// O push chega vazio (a planilha só "cutuca"). O texto é buscado na planilha pelo endereço desta inscrição.
self.addEventListener('push', (evento) => {
  evento.waitUntil(mostrarPendentes());
});

async function mostrarPendentes() {
  let mensagens = [];
  try {
    const inscricao = await self.registration.pushManager.getSubscription();
    if (inscricao && API) {
      const resposta = await fetch(API + '?pendentes=' + encodeURIComponent(inscricao.endpoint), { cache: 'no-store' });
      mensagens = (await resposta.json()).mensagens || [];
    }
  } catch (e) { /* sem internet: cai no aviso genérico abaixo */ }

  // Todo push precisa mostrar alguma notificação; sem isso o navegador pode cancelar a inscrição.
  if (!mensagens.length) {
    mensagens = [{ titulo: 'Escala da mídia', corpo: 'Você tem um lembrete. Abra a escala para ver.', tag: 'escala-lembrete' }];
  }
  await Promise.all(mensagens.map((m) => self.registration.showNotification(m.titulo, {
    body: m.corpo,
    tag: m.tag,
    icon: 'icone-192.png',
    badge: 'icone-192.png',
    lang: 'pt-BR'
  })));
}

// Tocar na notificação abre a escala (ou traz para frente, se já estiver aberta).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const escala = janelas.find((j) => j.url.startsWith(self.registration.scope) && !j.url.includes('admin'));
    if (escala) return escala.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
