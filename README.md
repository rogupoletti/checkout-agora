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
cp .env.example .env.local
npm install
npm run dev
```

`NEXTAUTH_SECRET` deve ser aleatório e secreto. `NEXTAUTH_URL` é a origem canônica do Ágora. `AGORA_ADMIN_EMAILS` recebe a lista separada por vírgulas dos primeiros administradores.

## Verificação

```bash
npm run lint
npm run build
curl http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/wallets
```

O endpoint de carteiras deve devolver `401` até a sessão e o RBAC reais serem configurados.

Consulte [SECURITY.md](SECURITY.md) para as fronteiras de segurança e o escopo proibido.
