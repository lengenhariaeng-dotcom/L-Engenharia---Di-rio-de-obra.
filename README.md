# Diário de Obra — L Engenharia

Aplicativo PWA para GitHub Pages com:

- Firebase Authentication para login por e-mail e senha;
- Cloud Firestore para obras e registros diários;
- Cloudinary para fotos, usando upload preset não assinado;
- cadastro de várias obras;
- botão `+` para adicionar vários serviços no mesmo dia;
- até 20 fotos por atualização;
- acesso do cliente em modo somente leitura;
- relatório final com serviços e fotos;
- impressão / salvamento em PDF;
- instalação no celular como PWA.

## Configuração já inserida neste pacote

### Firebase
Projeto: `l-engenharia---diario-de-obra`

O arquivo `firebase-config.js` já contém os dados públicos de configuração do aplicativo Web.

### Cloudinary
- Cloud name: `loan1csk`
- Upload preset: `diario_obra_lengenharia`

O aplicativo **não utiliza Firebase Storage**. As fotos são enviadas ao Cloudinary.

## Publicar no GitHub Pages

1. Abra o repositório do Diário de Obra no GitHub.
2. Faça upload de **todos os arquivos e da pasta `icons`** desta pasta para a raiz do repositório.
3. Se já houver arquivos antigos, substitua-os pelos desta versão.
4. Faça o commit.
5. Entre em **Settings > Pages**.
6. Em **Build and deployment**, escolha **Deploy from a branch**.
7. Selecione `main` e `/ (root)` e salve.

O domínio `lengenhariaeng-dotcom.github.io` já deve estar cadastrado em **Firebase Authentication > Settings > Authorized domains**.

## Primeiro acesso

Na tela inicial do aplicativo, escolha **Criar conta** para cadastrar a conta da L Engenharia. Depois entre normalmente com e-mail e senha.

Ao criar uma obra, informe o e-mail do cliente. O cliente cria a própria conta usando **exatamente o mesmo e-mail** informado na obra. Pelas regras do Firestore, ele poderá visualizar a obra, diário, fotos e relatório, mas não editar.

## Observação sobre fotos

O preset do Cloudinary é `Unsigned`, porque o site é estático no GitHub Pages. Não coloque `API Secret` em nenhum arquivo do GitHub.

Para reduzir uso indevido do preset, mantenha no Cloudinary limites de formato/tamanho compatíveis com fotos e acompanhe o consumo do plano gratuito.


## Controle de acesso — versão administrada

Conta administradora configurada: `lengenharia.eng@gmail.com`.

- somente a conta administradora pode criar, editar ou excluir obras e registros;
- clientes entram somente para visualizar as obras vinculadas ao e-mail deles;
- o botão público **Criar conta** foi removido;
- crie contas de clientes no Firebase Console em **Authentication > Usuários > Adicionar usuário**;
- no Firebase Authentication, desative a criação de contas por usuários em **Configurações > Ações do usuário**;
- publique também as regras atualizadas do arquivo `firestore.rules`.

## Senha inicial do cliente

Ao criar uma obra, o aplicativo gera uma senha inicial forte para o cliente. Essa senha é exibida para cópia, mas **não é armazenada no Firestore nem na obra**.

Fluxo recomendado:
1. Cadastre a obra com o e-mail do cliente.
2. Copie o acesso gerado pelo aplicativo.
3. Abra **Firebase > Authentication > Usuários > Adicionar usuário**.
4. Crie o usuário usando exatamente o mesmo e-mail e a senha inicial gerada.
5. Envie o acesso ao cliente.
6. O cliente pode trocar a senha depois usando **Esqueci minha senha**.
