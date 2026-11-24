# Checkout Ágora

Administração segura para links de pagamento Bitcart da Parallel Society.

## Princípios da primeira versão

- O checkout público continua hospedado pelo Bitcart; o Ágora cria e acompanha links.
- Credenciais do Bitcart ficam exclusivamente no runtime server-side.
- Frases de recuperação e chaves de gasto não são enviadas nem armazenadas pelo Ágora. Na criação BTC/BCH, a frase é gerada no navegador e somente o xpub derivado é enviado ao Bitcart. A view key de XMR passa transitoriamente pelo BFF para chegar ao Bitcart, sem persistência/log no Ágora.
- Rotas privilegiadas negam acesso por padrão; o proxy não aceita caminhos arbitrários do Bitcart.
- Payouts e reembolsos não pertencem ao primeiro marco.

## Desenvolvimento

```bash
npm install
npm run dev
```

Configure `AGORA_NEXTAUTH_SECRET` (32 bytes aleatórios, mantidos em segredo), `NEXTAUTH_URL`, `BITCART_API_URL` (`https://bitcart.docktools.com.br`) e, opcionalmente, `AGORA_ADMIN_EMAILS` no ambiente de execução. O Compose injeta `AGORA_NEXTAUTH_SECRET` no NextAuth como `NEXTAUTH_SECRET`. Não grave secrets no repositório.

## Docker

O `docker-compose.yml` publica somente em `127.0.0.1:3010`; o acesso externo deve passar pela rota do Cloudflare Tunnel. Injete `AGORA_NEXTAUTH_SECRET` pelo Infisical antes de iniciar o Compose. A imagem usa o modo standalone do Next.js e executa como usuário sem privilégios.

O fluxo permite cadastro público de conta no Bitcart, conexão de wallet watch-only e criação de loja antes de chegar à tela atual de links de pagamento. A opção xpub é pré-selecionada; BTC/BCH também podem gerar uma frase local no navegador. Ethereum pede somente o endereço. Monero pede endereço e view key, que é enviada e armazenada no Bitcart (nunca no Ágora). O cadastro aberto é uma configuração global do Bitcart, não exclusiva do Ágora.

O login também aceita contas existentes do Bitcart e cria faturas/links na loja selecionada. Criar conta, wallet, loja ou link são operações reais no Bitcart; não são executadas automaticamente por health checks ou verificações locais.

## Verificação

```bash
npm run lint
npm run build
curl http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/wallets
```

As rotas de lojas, provisionamento de wallet e faturas devem devolver `401` sem sessão. O cadastro público aplica rate limit e validação de origem.

Consulte [SECURITY.md](SECURITY.md) para as fronteiras de segurança e o escopo proibido.
