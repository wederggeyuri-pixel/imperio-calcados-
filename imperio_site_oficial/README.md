# Império Calçados — loja online com checkout e painel administrativo

Este pacote prepara a loja para publicação no Vercel, catálogo online no Supabase, painel protegido por Supabase Auth e pagamento por cartão dentro da própria página usando o Card Payment Brick do Mercado Pago. **O pacote não contém suas credenciais e não está ativado para pagamentos reais até você configurar suas contas.**

## O que está incluído

- `index.html`: loja, catálogo, sacola e formulário de entrega.
- `admin.html`: login do administrador, cadastro/edição/exclusão de produtos, acompanhamento de pedidos e alteração de senha.
- `checkout-result.html`: tela que consulta o status do pedido após o processamento do pagamento.
- `privacidade.html` e `termos.html`: modelos iniciais para você revisar e completar.
- `setup.sql`: catálogo, regras de acesso, tabelas de pedidos e itens.
- `api/create-order.js`: valida produtos e preços no servidor e registra o pedido antes do pagamento.
- `api/process-payment.js`: recebe apenas o token do cartão gerado pelo formulário seguro, consulta o total do pedido no servidor e envia a cobrança ao Mercado Pago.
- `api/payment-webhook.js`: valida assinatura do webhook e sincroniza o status do pagamento.
- `api/order-status.js`: retorna somente status/total do pedido, sem expor dados pessoais.
- `lib/server.js`: funções de servidor.
- `config.js`: URL/chave pública do Supabase e Public Key pública do Mercado Pago.
- `.env.example`: nomes das variáveis privadas exigidas no Vercel.

## 1. Configure o Supabase

1. Abra https://supabase.com/ e crie um projeto.
2. No SQL Editor, execute todo o conteúdo de `setup.sql`. O script cria o catálogo inicial, administradores, fotos e tabelas para pedidos.
3. Em **Authentication → Users**, crie o usuário administrador com um e-mail seu e uma senha forte e exclusiva (recomenda-se 12+ caracteres). Desative cadastro público se não precisar dele.
4. No SQL Editor, substitua `SEU_EMAIL_AQUI` pelo e-mail criado e execute:

```sql
insert into public.admin_users (user_id, role)
select id, 'admin' from auth.users where lower(email) = lower('SEU_EMAIL_AQUI')
on conflict (user_id) do update set role = excluded.role;
```

5. Em Project Settings → API / API Keys, copie **Project URL** e a chave pública (`publishable` ou `anon`). No painel de desenvolvedor do Mercado Pago, copie também a **Public Key**. Abra `config.js` e preencha estes três valores públicos:

```js
window.STORE_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_PUBLICA_DO_SUPABASE",
  mercadoPagoPublicKey: "SUA_PUBLIC_KEY_DO_MERCADO_PAGO"
};
```

**Não coloque a `service_role`/secret key nem o token do Mercado Pago no `config.js`.** O usuário administrador pode trocar a senha depois entrando em `admin.html` e clicando em “Alterar senha”.

## 2. Configure o Mercado Pago (Card Payment Brick dentro do site)

1. Crie uma conta de vendedor e uma aplicação em https://www.mercadopago.com.br/developers/panel/app .
2. Em credenciais de teste, copie a **Public Key** e preencha `mercadoPagoPublicKey` em `config.js`. Essa chave pode ficar no frontend; não use nela o Access Token.
3. Copie o **Access Token privado** para a variável de ambiente `MP_ACCESS_TOKEN` no Vercel. Não o coloque no GitHub nem no HTML/JavaScript público.
4. No painel do Mercado Pago, configure um **Webhook** para o evento **Payments** em modo de teste. URL: `https://SEU-DOMINIO.vercel.app/api/payment-webhook`. Copie a chave secreta de assinatura do webhook para `MP_WEBHOOK_SECRET`.
5. O checkout usa o **Card Payment Brick**: o formulário visual aparece dentro da loja, mas os campos sensíveis são tratados pelo componente seguro do Mercado Pago. O backend da loja recebe o token de pagamento e os metadados necessários; nunca recebe o número completo do cartão nem o CVV.
6. Teste o fluxo completo usando credenciais e cartões de teste. Só depois troque para credenciais de produção e configure o webhook de produção.

## 3. Configure as variáveis no Vercel

No Vercel, abra o projeto → **Settings → Environment Variables** e crie estas variáveis para **Production**, **Preview** (opcional) e **Development** (opcional).

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave privada/secret do backend Supabase, guardada apenas no servidor |
| `MP_ACCESS_TOKEN` | Access Token privado do Mercado Pago |
| `MP_WEBHOOK_SECRET` | assinatura secreta dos Webhooks do Mercado Pago |
| `PUBLIC_SITE_URL` | URL HTTPS final, sem barra no fim (ex. `https://imperio-calçados.vercel.app`) |

Use nomes de variáveis idênticos aos acima. **Nunca publique essas variáveis em arquivo, conversa pública, print ou repositório.** Depois de adicioná-las, faça um novo deploy.

## 4. Publique pelo GitHub + Vercel

1. Extraia o ZIP.
2. Envie todos os arquivos e pastas ao repositório GitHub, com `index.html`, `config.js`, `admin.html`, `api/`, `lib/` e `setup.sql` na raiz do projeto.
3. No Vercel, importe esse repositório. Como o projeto usa funções serverless, deixe o framework como Other e use a raiz do repositório. O `package.json` define ES modules/Node.
4. Configure as variáveis de ambiente acima.
5. Faça deploy e visite a URL gerada. Para administrar, abra `https://SEU-DOMINIO/admin.html`.
6. Teste: entrar no painel, editar um produto, abrir a loja publicada, montar a sacola, finalizar pedido, pagar com credenciais/cartão de teste e conferir o status em `admin.html`.

## 5. Como o cartão fica protegido

O formulário seguro do Card Payment Brick solicita o número, a validade, o CVV, o nome e o documento do titular para autorizar a transação. Os dados sensíveis são capturados pelo componente do Mercado Pago e tokenizados; o site envia ao backend somente o token, bandeira/meio de pagamento, parcelas e identificação necessária. O banco da Império Calçados guarda apenas pedido, total, status, identificador da transação e dados de entrega. **Não grave número completo, validade ou CVV nos logs, no Supabase, no navegador ou no painel administrativo.** O CVV não pode ser armazenado após autorização, nem criptografado.

## 6. Antes de vender oficialmente

- Complete e revise `privacidade.html` e `termos.html` com identificação empresarial, contato, regras de frete, troca e devolução. Os textos inclusos são modelos, não aconselhamento jurídico.
- Confira preços, variantes, estoque, numeração e cada imagem; parte do catálogo inicial usa URLs de terceiros e deve ser revisada.
- Configure um domínio HTTPS próprio, atendimento oficial e dados comerciais verdadeiros.
- Teste webhook tanto em ambiente de teste quanto em produção. Verifique no painel do Mercado Pago e no admin que os pagamentos aprovados atualizam o status.
- O pedido guarda dados pessoais e endereço de entrega; restrinja acessos e mantenha a política de privacidade em dia.

## Documentação oficial

- Mercado Pago — Card Payment Brick: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/introduction
- Mercado Pago — envio de pagamento por cartão: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/payment-submission
- PCI Security Standards Council — CVV não pode ser armazenado após autorização: https://www.pcisecuritystandards.org/faqs/are-merchants-allowed-to-request-card-verification-codes-values-from-cardholders/
- Supabase — login por senha: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Vercel — funções serverless: https://vercel.com/docs/functions
