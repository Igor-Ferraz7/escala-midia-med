# Escala da mídia

Página onde cada pessoa da mídia escolhe em quais tarefas do mês quer ficar. A página fica no GitHub Pages e os nomes ficam salvos numa planilha do Google.

## Como as partes se ligam

- **A página** (`index.html`, `estilo.css`, `app.js`, `config.js`) é o que as pessoas abrem no celular.
- **A planilha** guarda as tarefas e quem pegou cada uma.
- **O script** (`apps-script/Codigo.gs`) fica dentro da planilha. Quando a página pergunta "quais são as tarefas?" ou pede "coloca a Maria no dia 8", é ele que lê e escreve na planilha.

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
2. Clique em **Add file → Upload files** e arraste `index.html`, `estilo.css`, `app.js`, `config.js` e `LEIA-ME.md`. A pasta `apps-script` não precisa subir, mas pode.
3. Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em "Branch", escolha **main** e a pasta **/ (root)**, e salve.
5. Em um ou dois minutos o endereço aparece no topo dessa tela: `https://SEU-USUARIO.github.io/escala-midia/`. É esse link que você manda no grupo.

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

Na aba **Escala**, apague as linhas de outubro (deixe a primeira linha, com os títulos) e preencha as novas tarefas:

| coluna | o que colocar |
|---|---|
| `id` | um número diferente para cada linha (1, 2, 3…) |
| `data` | no formato `2026-11-05` |
| `tipo` | `culto`, `resumo`, `musica`, `devocional`, `oracao`, `momento` ou `aviso`. Isso só muda a cor do pontinho |
| `tarefa` | o nome que aparece em destaque, como "Culto" |
| `detalhe` | a linha de baixo, como o tema e o versículo. Pode ficar vazia |
| `marca` | uma etiqueta para a semana, como "Saco cheio". Pode ficar vazia |
| `nome`, `token`, `quando` | deixe vazias. A página preenche |

A coluna `token` fica escondida. É um código aleatório que identifica o aparelho de quem se escalou e permite que essa pessoa saia da tarefa depois.

O mês que aparece no topo da página é calculado pela primeira data da lista, então não precisa mudar nada no código.

## Se mudar o código do script

Depois de editar o `Codigo.gs`, cole o arquivo inteiro no editor do Apps Script, salve e vá em **Implantar → Gerenciar implantações → (lápis) → Versão: Nova versão → Implantar**. Assim o endereço continua o mesmo e o `config.js` não precisa mudar.

Só salvar o código **não** atualiza o site: sem a "Nova versão", o endereço `/exec` continua rodando o código antigo.
