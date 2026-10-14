# Escala da mídia

Página onde cada pessoa da mídia escolhe em quais tarefas do mês quer ficar. A página fica no GitHub Pages e os nomes ficam salvos numa planilha do Google.

## Como as partes se ligam

- **A página** (`index.html`, `estilo.css`, `app.js`, `config.js`) é o que as pessoas abrem no celular.
- **Os lembretes** (`lembretes.js`, `sw.js`, `manifest.webmanifest` e os ícones `.png`): a janela do sino e a parte que recebe as notificações com a página fechada.
- **A área do responsável** (`admin.html`, `admin.js`): criar, editar e apagar tarefas, tirar pessoas, cuidar dos nomes. Pede senha.
- **A planilha** guarda as tarefas, os nomes e os lembretes.
- **O script** (`apps-script/Codigo.gs`) fica dentro da planilha. Quando a página pergunta "quais são as tarefas?" ou pede "coloca a Maria no dia 8", é ele que lê e escreve na planilha. Ele também confere a senha do responsável e envia as notificações.

Enquanto o `config.js` estiver sem endereço, a página funciona em **modo demonstração**: ela salva só no próprio aparelho. Serve para testar.

## Parte 1 — Planilha e script (uns 10 minutos)

1. Crie uma planilha nova no Google Planilhas. Pode chamar de "Escala da mídia".
2. No menu, vá em **Extensões → Apps Script**. Abre uma aba nova com um editor de código.
3. Apague o que estiver no editor, cole todo o conteúdo de `apps-script/Codigo.gs` e salve (ícone de disquete).
4. Na barra de cima, escolha a função **configurar** e clique em **Executar**.
   - O Google vai pedir autorização. Escolha sua conta. Se aparecer "O Google não verificou este app", clique em **Avançado → Acessar (não seguro)**. O aviso aparece porque o script foi feito por você e não passou por revisão do Google. Ele só mexe nesta planilha.
   - Volte para a planilha: agora existe uma aba **Escala** com as 30 tarefas de outubro.
5. No editor do script, clique em **Implantar → Nova implantação**.
   - Em "Tipo", escolha **App da Web**.
   - **Executar como:** Eu.
   - **Quem pode acessar:** Qualquer pessoa.
   - Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).
6. Abra o arquivo `config.js` e cole esse endereço entre as aspas:

   ```js
   window.ESCALA_CONFIG = {
     urlPlanilha: 'https://script.google.com/macros/s/.../exec'
   };
   ```

Para testar, cole o endereço no navegador. Deve aparecer um texto começando com `{"ok":true,"tarefas":[`.

## Parte 2 — Publicar no GitHub Pages (uns 5 minutos)

1. No GitHub, crie um repositório novo e **público**, por exemplo `escala-midia`.
2. Clique em **Add file → Upload files** e arraste todos os arquivos da pasta (páginas, `.js`, `.css`, `.png`, `manifest.webmanifest` e `LEIA-ME.md`). A pasta `apps-script` não precisa subir, mas pode.
3. Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em "Branch", escolha **main** e a pasta **/ (root)**, e salve.
5. Em um ou dois minutos o endereço aparece no topo dessa tela: `https://SEU-USUARIO.github.io/escala-midia/`. É esse link que você manda no grupo.

## Parte 3 — Senha do responsável e lembretes (uma vez só)

Faça depois de colar a versão do `Codigo.gs` que tem administração e lembretes.

1. **Confira o projeto.** No Apps Script, abra **Configurações do projeto** (engrenagem, à esquerda):
   - "Ativar o ambiente de execução do Chrome V8" precisa estar **marcado**. Os lembretes usam contas que só existem nele.
   - O **fuso horário** precisa ser `(GMT-03:00) Horário de Brasília` (ou o da cidade). É por ele que o script sabe quando é "20:00".
2. **Cadastre a senha.** Ainda em Configurações do projeto, desça até **Propriedades do script → Adicionar propriedade**:
   - Propriedade: `SENHA_ADMIN`
   - Valor: a senha da área do responsável
   - Clique em **Salvar propriedades do script**.

   A senha fica só aí. Ela **não** vai no código nem no GitHub, porque o código é público e qualquer pessoa poderia ler. Para trocar a senha, é só editar esse valor (vale na hora, sem implantar de novo).
3. **Ligue os lembretes.** Volte ao editor, escolha a função **configurarLembretes** na barra de cima e clique em **Executar**. O Google vai pedir autorização de novo, porque agora o script envia notificações e roda sozinho a cada 5 minutos. Autorize do mesmo jeito da Parte 1.
4. **Implante a versão nova:** **Implantar → Gerenciar implantações → (lápis) → Versão: Nova versão → Implantar**.

Para conferir: abra a área do responsável, entre com a senha e veja a aba **Geral**. Ela deve dizer "Lembretes ligados".

## Área do responsável

No fim da página da escala tem o botão **Área do responsável**. Depois de entrar com a senha, dá para:

- **Tarefas:** criar, editar e excluir tarefas; mudar data, horário, tipo, detalhe e etiqueta da semana; escalar alguém escrevendo o nome; tirar a pessoa de uma tarefa.
- **Pessoas:** ver os nomes e quantos aparelhos cada um tem; **desligar os aparelhos** de um nome (o próximo aparelho que usar o nome fica com ele); excluir um nome.
- **Geral:** ver se os lembretes estão ligados; **tirar todos das tarefas** (as vagas ficam livres); **apagar todas as tarefas** (para começar um mês do zero, pede para digitar APAGAR).

A entrada vale por 6 horas, ou até fechar a aba. Depois de 8 senhas erradas seguidas, a entrada fica bloqueada por 15 minutos, para ninguém ficar chutando.

Quando o responsável escala alguém pelo nome, o primeiro aparelho que usar aquele nome na página fica ligado a ele e enxerga a tarefa como sua.

## Lembretes

Cada pessoa toca no **sino**, ao lado do botão de atualizar, escolhe quando quer ser avisada e toca em **Ativar lembretes**. Dá para ter até 5 lembretes, misturando:

- **Dias antes, num horário:** por exemplo, 1 dia antes às 20:00. Com 0, avisa no próprio dia.
- **Horas ou minutos antes do prazo:** por exemplo, 2 horas antes.
- **Toda semana, num dia fixo:** por exemplo, todo domingo às 18:00, com o resumo das tarefas dos próximos 7 dias.

O **prazo** de uma tarefa é o horário dela. Tarefa sem horário vale até as 09:00 (o primeiro horário de postagem). O horário de cada tarefa se ajusta na área do responsável.

O botão **Enviar teste** manda uma notificação na hora, para a pessoa conferir se está chegando.

O que a pessoa precisa saber (a janela do sino mostra tudo isso):

- O navegador precisa ter as notificações **permitidas** para o site.
- No **iPhone e iPad**, só funciona com a escala adicionada à **Tela de Início** (Compartilhar → Adicionar à Tela de Início) e aberta por esse ícone, no iOS 16.4 ou mais novo. É uma regra da Apple.
- O navegador de dentro do Instagram ou do WhatsApp não recebe notificações.
- Vale por aparelho: quem quiser no celular e no PC ativa nos dois.
- O aviso chega com até 5 minutos de diferença, porque o script confere a cada 5 minutos.

Como funciona por dentro: a planilha guarda as regras de cada aparelho na aba **Lembretes**. A cada 5 minutos, o script vê quais avisos caem naquele intervalo e "cutuca" o serviço de notificação do navegador (do Google, da Apple, da Mozilla ou da Microsoft). O celular acorda a parte da página que fica de plantão (`sw.js`), que busca o texto na planilha e mostra a notificação. Nenhum serviço de fora precisa de conta ou cadastro.

## Como usar no dia a dia

- **Ver quem pegou o quê:** abra a planilha. A coluna `nome` mostra quem está em cada tarefa, e `quando` mostra a hora em que a pessoa se escalou.
- **Tirar ou trocar alguém:** apague ou mude o nome direto na coluna `nome`. A página mostra a mudança na próxima atualização (ela atualiza sozinha a cada minuto e toda vez que a pessoa volta para a aba).
- **Quem pode sair de uma tarefa pela página:** só o aparelho ligado àquele nome (veja abaixo).

## Nomes e aparelhos

Cada navegador guarda um código aleatório, criado na primeira visita. Na primeira vez que alguém se escala com um nome, esse nome fica **ligado ao aparelho** que o usou. A partir daí:

- O campo "Seu nome" mostra uma lista com os nomes já salvos: primeiro os deste aparelho, depois os de outras pessoas (marcados "outro aparelho"), para ninguém criar um nome repetido.
- Outro aparelho não consegue se escalar com aquele nome sem o código de ligação (abaixo). Maiúsculas, acentos e espaços a mais não enganam: "ígor  FERRAZ" conta como "Igor Ferraz".
- Um aparelho pode ter mais de um nome (por exemplo, um casal que divide o celular).
- Se o aparelho tem um nome só, o campo já vem preenchido.

### Usar o mesmo nome em mais de um aparelho (celular e PC, por exemplo)

1. No aparelho que **já** usa o nome, escolha o nome e toque em **Usar este nome em outro aparelho**. Aparece um código de 6 números, que vale por 15 minutos.
2. No aparelho **novo**, escolha o mesmo nome. Aparece uma caixa pedindo o código: digite e toque em **Ligar**.

Pronto: os dois aparelhos usam o nome, veem as mesmas tarefas em "Minhas" e podem sair delas. Cada código serve uma vez só e deixa de valer depois de 5 tentativas erradas, para ninguém sair chutando números.

### O que fica na planilha

As ligações ficam na aba **Pessoas**, que o script cria sozinho na primeira vez que a página abrir depois da atualização. Quem já tinha se escalado antes entra nela automaticamente.

| coluna | o que é |
|---|---|
| `nome` | o nome da pessoa |
| `token` | os códigos dos aparelhos ligados ao nome, separados por espaço |
| `desde` | quando o nome foi usado pela primeira vez |
| `codigo`, `validade`, `tentativas` | o código de ligação em andamento. Ficam vazias quando não há nenhum |

**A pessoa perdeu o celular ou limpou o navegador e não tem outro aparelho ligado:** apague a célula `token` da linha dela. O próximo aparelho que usar esse nome fica com ele, e passa também a poder sair das tarefas antigas.

**Abrir pelo navegador de verdade:** o Instagram e alguns outros apps abrem links num navegador próprio, que guarda um código diferente do Chrome ou do Safari. Para não ter que liberar o nome toda vez, oriente o pessoal a abrir o link no navegador do celular (no menu ⋮ do app, "Abrir no navegador").

IP e MAC não servem para isso. O navegador nunca entrega o MAC para um site, e o script do Google não recebe o IP. Mesmo que recebesse, todo mundo no Wi-Fi da igreja sairia com o mesmo IP.

## Montar o próximo mês

O jeito mais fácil é pela **área do responsável**: em Geral, "Apagar todas as tarefas", e depois "+ Nova tarefa" para cada dia.

Também dá para fazer direto na planilha. Na aba **Escala**, apague as linhas do mês anterior (deixe a primeira linha, com os títulos) e preencha as novas tarefas:

| coluna | o que colocar |
|---|---|
| `id` | um número diferente para cada linha (1, 2, 3…) |
| `data` | no formato `2026-11-05` |
| `tipo` | `culto`, `resumo`, `musica`, `devocional`, `oracao`, `momento` ou `aviso`. Isso só muda a cor do pontinho |
| `tarefa` | o nome que aparece em destaque, como "Culto" |
| `detalhe` | a linha de baixo, como o tema e o versículo. Pode ficar vazia |
| `marca` | uma etiqueta para a semana, como "Saco cheio". Pode ficar vazia |
| `hora` | o horário do prazo, como `19:30`. Vazia vale 09:00 |
| `nome`, `token`, `quando` | deixe vazias. A página preenche |

A coluna `token` fica escondida. É um código aleatório que identifica o aparelho de quem se escalou e permite que essa pessoa saia da tarefa depois.

O mês que aparece no topo da página é calculado pela primeira data da lista, então não precisa mudar nada no código.

## Se mudar o código do script

### Automático (pelo GitHub)

Toda alteração em `apps-script/` que chega na `main` é enviada sozinha para o Apps Script e publicada como nova versão na mesma implantação (`.github/workflows/apps-script.yml`). O endereço `/exec` não muda. Para isso funcionar, uma vez só:

1. **Ligue a API:** abra https://script.google.com/home/usersettings e ative a **API do Google Apps Script**.
2. **Gere o login do clasp** no Google Cloud Shell (https://shell.cloud.google.com, já vem com Node):
   - Rode `npx @google/clasp@3.4.1 login --no-localhost` e abra o link que aparecer.
   - Autorize com a conta dona da planilha. No fim, o navegador vai para um endereço `http://localhost:8888/?code=...` que não abre. Copie esse endereço inteiro e cole no terminal.
   - Rode `cat ~/.clasprc.json` e copie tudo o que aparecer. Depois apague: `rm ~/.clasprc.json`.
3. **Guarde no GitHub:** no repositório, **Settings → Secrets and variables → Actions → New repository secret**. Nome `CLASPRC_JSON`, valor o que você copiou.
4. **ID do script:** no Apps Script, **Configurações do projeto → ID do script**. Ele vai no `.clasp.json`, no lugar de `COLE_AQUI_O_ID_DO_SCRIPT`.

Esse login dá acesso aos seus projetos do Apps Script e a arquivos do Drive criados por ele. Por isso fica só como segredo do GitHub, que ninguém lê depois de salvo. Para cortar o acesso: https://myaccount.google.com/permissions → clasp → Remover acesso.

O fuso (Brasília) e o V8 ficam no `apps-script/appsscript.json`, e vão junto a cada envio.

A senha (`SENHA_ADMIN`) e a autorização do `configurarLembretes` continuam manuais: o Google exige que o dono faça isso no editor.

### Manual

Depois de editar o `Codigo.gs`, cole o arquivo inteiro no editor do Apps Script, salve e vá em **Implantar → Gerenciar implantações → (lápis) → Versão: Nova versão → Implantar**. Assim o endereço continua o mesmo e o `config.js` não precisa mudar.

Só salvar o código **não** atualiza o site: sem a "Nova versão", o endereço `/exec` continua rodando o código antigo.
