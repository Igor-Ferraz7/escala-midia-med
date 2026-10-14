# Testes

Ferramentas para conferir o sistema sem mexer na planilha de verdade. Precisam do [Node.js](https://nodejs.org) 22 ou mais novo. Rode tudo a partir da pasta do projeto.

| comando | o que faz |
|---|---|
| `node testes/teste-gs.js` | Roda o `apps-script/Codigo.gs` numa planilha de mentira e confere escala, nomes, aparelhos, administração, assinatura das notificações e lembretes. Termina com "Tudo certo." ou com a lista do que falhou. |
| `node testes/servidor-falso.js` | Sobe a página em `http://localhost:8767` ligada a essa planilha de mentira, para testar no navegador. A senha da área do responsável aqui é `senha-de-teste-123` (só existe neste servidor). |
| `node testes/teste-push-chrome.js` | Com o servidor acima rodando, abre um Chrome separado e sem janela, ativa os lembretes pela página e confere se a notificação chega de verdade. |

O arquivo `ambiente-gs.js` imita as partes do Google que o script usa (planilha, propriedades, cache, gatilhos, assinaturas). Ele não precisa ser rodado sozinho.
