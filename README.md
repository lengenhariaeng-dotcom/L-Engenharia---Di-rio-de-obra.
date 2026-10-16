# Diário de Obra — L Engenharia

Aplicativo PWA para GitHub Pages, com painel intuitivo para a equipe da L Engenharia e acesso de leitura para o cliente.

- cadastro de várias obras pelo cartão/botão `+ Adicionar obra`;
- serviços diários com botão `+` para adicionar várias linhas;
- várias fotos por atualização, podendo selecionar em mais de uma etapa e remover antes de publicar;
- histórico cronológico;
- área do cliente em modo somente leitura;
- percentual de andamento;
- relatório final com informações, serviços e fotos;
- impressão / salvamento em PDF pelo navegador;
- instalação no celular como aplicativo;
- modo demonstração local quando o Firebase ainda não está configurado.

## 1. Publicar no GitHub Pages

1. Crie um repositório novo, por exemplo: `diario-de-obra`.
2. Envie **todos os arquivos e a pasta `icons`** deste pacote para a raiz do repositório.
3. No GitHub, entre em **Settings > Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/ (root)`.
6. Salve e aguarde o link do GitHub Pages.

Sem Firebase, o aplicativo abre em **Modo demonstração** e salva os dados somente no navegador usado.

## 2. Ativar o compartilhamento entre você e o cliente

Para o cliente abrir no celular dele e visualizar os registros publicados, configure o Firebase.

### Firebase Authentication

1. Acesse o Firebase Console e crie um projeto.
2. Entre em **Authentication > Sign-in method**.
3. Ative **Email/Password**.

### Firestore Database

1. Entre em **Firestore Database** e crie o banco.
2. Abra a aba **Rules**.
3. Copie o conteúdo do arquivo `firestore.rules` deste pacote e publique.

### Firebase Storage

1. Entre em **Storage** e habilite o armazenamento.
2. Abra **Rules**.
3. Copie o conteúdo de `storage.rules` e publique.

### Configuração Web

1. Em **Project settings > Your apps**, crie um aplicativo Web.
2. O Firebase exibirá um objeto parecido com:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

3. Abra `firebase-config.js` e substitua os campos `COLE_AQUI` pelos valores fornecidos.
4. Faça novo commit no GitHub.

Depois disso, o selo **Modo demonstração** desaparece e o aplicativo passa a usar Firebase.

## 3. Fluxo de uso da equipe

1. Entre com a conta da equipe.
2. No painel **Obras**, toque no cartão **+ Adicionar nova obra**.
3. Cadastre cliente, e-mail e local.
4. Após criar, o aplicativo abre diretamente a tela **Nova atualização**.
5. Digite o primeiro serviço. Use o botão **+ Adicionar outro serviço** ou pressione Enter para criar outra linha.
6. Toque em **Adicionar fotos**. É possível escolher várias imagens de uma vez e repetir a seleção até o limite de 20 por atualização.
7. Revise as miniaturas, remova alguma pelo botão `×` se necessário e publique.
8. No painel, cada obra também possui o atalho **+ Registrar hoje**, para chegar direto na publicação diária.

## 4. Como funciona o acesso do cliente

- Você cria sua conta com e-mail e senha.
- Ao criar a obra, informa o **e-mail do cliente**.
- O cliente acessa o mesmo site e escolhe **Criar conta** usando exatamente esse e-mail.
- Ao entrar, ele verá automaticamente as obras compartilhadas com ele.
- O cliente consegue visualizar o diário, fotos e relatório, mas não consegue editar a obra.

## 5. Relatório final

Na obra, abra **Relatório final**.

O documento inclui:

- capa L Engenharia;
- obra, cliente, local e período;
- responsável técnico e CREA;
- resumo de dias, serviços e fotos;
- diário completo por data;
- registros fotográficos;
- conclusão final;
- assinatura do responsável técnico.

Clique em **Gerar / salvar em PDF** e, na janela de impressão do navegador, selecione **Salvar como PDF**.

## 6. Observação

O GitHub Pages hospeda o site. Firebase é usado para login, banco de dados e fotos compartilhadas entre dispositivos.
