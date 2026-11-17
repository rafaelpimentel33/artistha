# ArtisTha na Vercel e no Supabase

[Loja ArtisTha](https://artistha-loja.vercel.app/)

O catálogo começa vazio. O painel permite cadastrar produtos, editar a vitrine, configurar o WhatsApp e acompanhar o status dos pedidos.

## Conta e pedidos

Acesse `/conta` para criar uma conta com e-mail e senha. Depois de confirmar o e-mail pelo link recebido, preencha o nome e, se quiser, informe CPF, celular e CEP. O CPF é validado e armazenado como um identificador protegido com os dois últimos dígitos. Contas antigas entram com o usuário e a senha de sempre. Os pedidos ficam em **Meus pedidos**.

No Supabase, em **Authentication → URL Configuration**, defina o domínio público da loja como **Site URL** e cadastre a URL completa `https://artistha-loja.vercel.app/auth/confirm` em **Redirect URLs**. Mantenha **Confirm email** ativado e configure um remetente transacional em **Authentication → SMTP Settings** para enviar confirmações e links de redefinição para clientes. O SMTP padrão do Supabase envia somente aos endereços autorizados da equipe do projeto.

Nas mensagens geradas pelo Auth, use o link de confirmação padrão ou um link para `/auth/confirm` com `token_hash` e `type=email` ou `type=recovery`, conforme a mensagem. Um link de recuperação padrão deve ser aberto no navegador que o pediu.

Para ativar o painel pela primeira vez, crie a conta que será administradora e abra `/admin`. No Vault do projeto Supabase, copie o valor do segredo `loja_codigo_ativacao` e use-o no painel. O código vincula uma única conta. Cadastre os produtos em **Produtos** e o telefone comercial em **Checkout**.

## Instalar em outro projeto

1. Execute `supabase/setup.sql`, `supabase/plaque-references.sql` e `supabase/store-purchases.sql`, nessa ordem, no SQL Editor de um projeto Supabase dedicado à loja. Para incluir a Placa Personalizável no catálogo, execute em seguida `supabase/placa-personalizavel.sql`.
2. Gere uma chave aleatória de 32 bytes em hexadecimal. Guarde-a em `SHOP_REGISTRATION_KEY` e grave apenas seu SHA-256 hexadecimal em `shop_private.registration_config.secret_hash` na linha com `singleton = true`.
3. Publique a função em `supabase/functions/shop-registration/index.ts` como `shop-registration`. A função valida a chave da aplicação, por isso usa a configuração `verify_jwt = false`. Faça uma chamada POST com `{"action":"initialize"}` e o cabeçalho `x-shop-registration-key` para preparar o bucket de fotos.
4. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SHOP_REGISTRATION_KEY` no projeto Vercel. A terceira variável é sensível. Use `STORE_URL` para indicar o domínio HTTPS público se ele mudar. Para desenvolvimento, preencha uma cópia de `.env.example` em `.env.local`.
5. Instale as dependências com `npm ci` e rode `npm run build`. A Vercel usa o framework Next.js definido em `vercel.json`.
6. Aplique os arquivos em `supabase/migrations/` na ordem dos nomes e configure o Auth e o SMTP como descrito acima.

## Privacidade e indexação

- Em **Páginas e contato → Privacidade**, informe o nome ou a razão social do responsável pelos dados e o e-mail de privacidade. O site publica esses campos em `/privacidade` e usa os canais públicos da loja como alternativa de contato.
- A loja usa cookies de autenticação quando o cliente entra. O carrinho e o identificador temporário do pedido são mantidos no navegador para dar continuidade à compra. Revise a política e a necessidade de consentimento antes de adicionar ferramentas de análise ou publicidade.
- O mapa em `/sitemap.xml` usa o catálogo ativo. Produtos com slug iniciado por `teste-` ficam fora do mapa e recebem `noindex`, assim como buscas internas, conta e painel.

## Atualizar uma instalação existente

Aplique `supabase/plaque-references.sql` e `supabase/store-purchases.sql` antes de publicar o código atualizado. Esses scripts atualizam as regras de envio e uso da imagem de referência conforme a opção **Placa personalizável**.

Para ativar o cadastro por e-mail e CPF, aplique também a migração `20261115172450_conta_email_e_cpf.sql` antes de publicar. Confirme as URLs de autenticação e o SMTP.

Para habilitar a exclusão de pedidos no painel, aplique `supabase/migrations/20261117144339_permitir_exclusao_de_pedidos.sql` antes de publicar.
