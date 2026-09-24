# Integração de consumos — Vila Corada Camareiras

> Artefato de entrega da seção 12 de `PRD_consumos-api-joao-v1.md`. Descreve
> como consumir a API somente-leitura de contas de bar/frigobar deste app
> (Camareiras Vila Corada) a partir do sistema de reservas/recebimentos.

## URLs base

| Ambiente | URL base | Situação |
| --- | --- | --- |
| Homologação | `https://app-camareiras-vila-corada-git-homologacao-v-corada.vercel.app/api/integration/v1` | Publicada, testada, dados sintéticos. Requer o bypass de proteção da Vercel descrito abaixo (é uma Preview Deployment, não um domínio público). |
| Produção | `https://app-camareiras-vila-corada.vercel.app/api/integration/v1` | Código já implantado (deploy automático a cada push a `main`, convenção deste projeto), mas **nenhum token de serviço foi gerado em produção ainda** — a API está tecnicamente no ar, porém inutilizável sem token, e não deve ser considerada "ativada" até autorização explícita e handoff conjunto (seção 0.2-G do PRD). |

### Acesso à homologação (Preview Deployment protegida)

A URL de homologação é uma Preview Deployment da Vercel, protegida por SSO da
plataforma. Para acessar sem conta no time Vercel, é necessário um bypass de
proteção — entregue por canal seguro, nunca neste arquivo. Uma vez usado (como
parâmetro de query numa primeira requisição), a Vercel libera o acesso sem
precisar repeti-lo a cada chamada subsequente vinda do mesmo cliente HTTP,
desde que o cliente preserve cookies; para chamadas servidor-a-servidor
sem cookie (o caso normal de sincronização automatizada), inclua o parâmetro
de bypass em toda requisição.

## Autenticação

`Authorization: Bearer <token-de-servico>` em toda chamada.

- Token gerado pelo admin do app na tela **"Chaves de acesso — API de
  consumos"** (`/dashboard/api-tokens`), com login de admin do ambiente
  correspondente (homologação ou produção — são bancos/usuários totalmente
  separados).
- O valor só é mostrado **uma vez**, no momento da criação — se perdido,
  revogue e gere outro.
- Token revogável a qualquer momento, sem prazo de expiração automático.
- Não há escopo por propriedade porque esta pousada só tem uma propriedade
  (`property_id` é sempre a constante `"vila-corada"`).
- Sem token válido, todo endpoint responde `401 UNAUTHORIZED`.

## Sequência de sincronização recomendada

1. **Carga inicial** — `GET /stay-accounts?limit=25`, seguindo `next_cursor`
   até `has_more: false`. A primeira página traz `snapshot_id` e
   `sync_cursor`; guarde o `sync_cursor` para o passo 2.
2. **Mudanças incrementais** — `GET /changes?cursor=<sync_cursor da carga
   inicial ou do next_cursor da última chamada>`. Sempre use o `next_cursor`
   devolvido, mesmo quando `data` vier vazio — ele é o checkpoint pra
   próxima consulta.
3. Repita o passo 2 periodicamente (frequência sugerida: 1–5 minutos,
   ajustável). Se o cursor expirar (fora da janela de retenção de 90 dias),
   a resposta é `410 CURSOR_EXPIRED` — nesse caso, reinicie a partir do
   passo 1.
4. `GET /stay-accounts/{account_id}` devolve o retrato atual e completo de
   uma conta específica, sem paginação nem envelope.
5. `GET /rooms` devolve o catálogo de suítes; não paginado (a pousada tem só
   11 suítes), sempre `has_more: false`.

## Limites

- `limit`: padrão 25, máximo 100, em `/stay-accounts` e `/changes`.
- Paginação por keyset (cursor opaco = `id` interno) — estável mesmo sob
  escrita concorrente.
- **Rate limiting não está implementado nesta versão** (divergência
  documentada em `openapi.yaml`) — evita depender de infraestrutura nova
  (ex.: Redis) só para isso. Se o volume de chamadas exigir, isso pode ser
  adicionado numa iteração futura, sob autorização.
- Retenção do histórico de mudanças: 90 dias (limpeza diária automática).

## Contrato

Ver `openapi.yaml` (raiz do repositório) — OpenAPI 3.1, inclui todos os
schemas, enums, campos obrigatórios/nullable e uma seção final de
"Divergências do contrato original" explicando cada ponto em que esta
implementação diverge da proposta inicial do PRD.

## Exemplos

Ver a pasta `exemplos/` — objetos JSON sintéticos (nenhum dado real) para os
casos: conta aberta, conta fechada aguardando pagamento, conta paga, conta
com taxa de serviço isenta, carga inicial vazia e um evento de mudança.

## Teste de fumaça

Ver `scripts/smoke-test-consumos.mjs` — script Node, somente leitura, que
autentica e consulta os 4 endpoints, validando a forma da resposta. Nunca
imprime o token nem payloads completos (só resultados de validação:
OK/FALHA por campo/endpoint).

Execução:

```bash
BASE_URL="https://app-camareiras-vila-corada-git-homologacao-v-corada.vercel.app/api/integration/v1" \
SERVICE_TOKEN="<token gerado na tela /dashboard/api-tokens>" \
VERCEL_BYPASS="<bypass entregue por canal seguro, se aplicável>" \
node scripts/smoke-test-consumos.mjs
```

O script termina com código de saída diferente de zero se qualquer resposta
não bater com o contrato esperado (campo faltando, tipo errado, status HTTP
inesperado).

## O que esta API não faz

- Não cria, altera, fecha, cancela nem marca como paga nenhuma conta — é
  100% leitura (`GET`). Todas as mutações continuam exclusivamente dentro
  deste app (telas da camareira/admin).
- Não expõe webhooks nem escreve na Stays.
- Não devolve nome, CPF, telefone ou e-mail de hóspede — só o `_id` opaco
  da reserva da Stays, quando disponível.
