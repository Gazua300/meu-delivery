# Meu Delivery

Uma aplicação web para que os clientes descubram lojas, naveguem pelos produtos e façam pedidos. Os clientes escolhem uma loja, adicionam itens ao carrinho e gerenciam seus pedidos utilizando serviços disponibilizados pelo Meu Delivery Server.

## O ecossistema Meu Delivery

O aplicativo do cliente faz parte de um conjunto integrado:

- **Meu Delivery** — O aplicativo voltado ao cliente para navegar por lojas e fazer pedidos.
- **Meu Delivery Provedor** — O painel voltado para a loja, destinado ao recebimento e gerenciamento de pedidos e à manutenção do catálogo de produtos.
- **SaaS Dashboard** — o painel de gerenciamento e monitoramento do ecossistema.
- **My Delivery Server** — a API central que conecta as aplicações, autentica os usuários e disponibiliza dados e serviços compartilhados.

Os clientes navegam por lojas e produtos por meio da API. Os pedidos são registrados pelo servidor e disponibilizados ao Meu Delivery Provedor. O painel de controle (Dashboard) complementa o ecossistema com funcionalidades de gestão e monitoramento.

## Funcionalidades

- Navegue por lojas e visualize seus produtos.
- Cadastre-se, faça login, redefina senhas e acesse páginas restritas.
- Gerencie um carrinho com itens agrupados por loja, incluindo a possibilidade de alterar quantidades e remover produtos.
- Realize o checkout utilizando o fluxo de pagamento via Pix ou o formulário de cartão, processado pelo SDK do Mercado Pago.
- Acompanhe a confirmação do pagamento, recupere um Pix pendente após atualizar a página e cancele o pagamento quando a opção estiver disponível.
- Enquanto houver um Pix pendente, altere quantidades ou remova itens somente depois de cancelar o pagamento; o carrinho avisa quando essa ação ainda não está liberada.
- Visualize e edite dados do perfil, endereço de entrega e informações de contato.
- Preencha automaticamente endereços no Brasil a partir do CEP, utilizando o ViaCEP.
- Acesse notificações relacionadas à sua conta e aos seus pedidos.
- Compartilhe detalhes do pedido com a loja via WhatsApp.

## Tecnologias utilizadas

- React 19, TypeScript, and Vite
- React Router
- Styled Components
- Axios
- Mercado Pago SDK for React

## Executar localmente

Requer Node.js e npm. A partir do diretório deste projeto:

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto e defina a URL base para Meu Delivery Server. A chave pública do Mercado Pago é usada pelo formulário de cartão:

```env
VITE_BASE_URL=http://localhost:3003
VITE_PUBLIC_KEY_TP=your_public_key
```

Inicie o aplicativo:

```bash
npm run dev
```

Outros comandos disponíveis:

```bash
npm run build
npm run preview
npm run lint
```

## Integrações

`VITE_BASE_URL` deve apontar para a raiz da API — por exemplo, `http://localhost:3003` durante o desenvolvimento local. A API disponibiliza recursos de usuário, loja, pedido e notificação. O Pix e o cartão são processados pelo servidor com as credenciais do Mercado Pago configuradas no backend; `VITE_PUBLIC_KEY_TP` é somente a chave pública usada pelo SDK de cartão no navegador. Nunca coloque o token privado `ACCESS_TOKEN` no frontend. Use credenciais de teste correspondentes ao testar em sandbox.

## Aplicações relacionadas

- [Meu Delivery — Aplicativo para o cliente](https://meu-delivery-eight.vercel.app/)
- [Meu Delivery Provedor — Painel da loja](https://meu-delivery-provedor.vercel.app/)
- [SaaS Dashboard — Painel SaaS](https://saa-s-dashboard-eta.vercel.app/)
- [Meu Delivery Server — Documentação da API](https://meu-delivery-server-tau.vercel.app/api-docs/)
- [Portfolio](https://meu-porfolio-two.vercel.app/)
