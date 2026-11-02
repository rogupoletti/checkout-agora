# Checkout Ágora

Administração segura para links de pagamento Bitcart da Parallel Society.

## Princípios da primeira versão

- O checkout público continua hospedado pelo Bitcart; o Ágora cria e acompanha links.
- Credenciais do Bitcart ficam exclusivamente no runtime server-side.
- Nenhuma seed, frase de recuperação ou chave privada transita ou é armazenada pelo Ágora.
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

O MVP permite login com uma conta existente do Bitcart e cria uma fatura/link na loja selecionada. Criar o link é uma operação real no Bitcart; não é executada automaticamente por health checks ou testes.

## Verificação

```bash
npm run lint
npm run build
curl http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/wallets
```

As rotas de lojas e faturas devem devolver `401` sem sessão; o endpoint de carteiras continua fora do MVP de PS-51.

Consulte [SECURITY.md](SECURITY.md) para as fronteiras de segurança e o escopo proibido.
