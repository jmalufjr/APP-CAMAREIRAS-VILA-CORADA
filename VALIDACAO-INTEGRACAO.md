# Validação da integração — API de consumos

> Artefato de entrega da seção 12 de `PRD_consumos-api-joao-v1.md`. Matriz
> da seção 10 do documento, com comandos/resultados reais e pendências.

## Checklist "João entrega" (seção 10)

| Item | Situação |
| --- | --- |
| Aceite do contrato e lista de campos indisponíveis | Feito — ver `MAPEAMENTO-E-LIMITACOES.md`, seções "Dados que este app nunca guardou" e "Como este app separa estadias" |
| URLs separadas de homologação/produção; token entregue em canal seguro | Feito — URLs em `INTEGRACAO-CONSUMOS-README.md`; tokens **nunca** neste repositório, sempre entregues fora dele |
| OpenAPI 3.1.x com campos, enums, nullable, limites, erros, autenticação | Feito — `openapi.yaml`, validado com `js-yaml` |
| Identificadores permanentes de suítes, contas, itens e pagamentos | Feito — `room_id`/`account_id`/`items[].id`/`payments[].id`, todos opacos e estáveis (não há "estadia" própria separada da conta — ver mapeamento) |
| Quatro recursos GET, cursor consistente, cancelamentos preservados | Feito — ver testes abaixo. Não há cancelamento de conta inteira neste app (fora do escopo do modelo real) |
| Regra efetiva da taxa de serviço, descontos e arredondamento documentada | Feito — `MAPEAMENTO-E-LIMITACOES.md`, seção "Regra da taxa de serviço" |
| Explicação do que "Fechar a conta" registra e da qualidade do histórico | Feito — `MAPEAMENTO-E-LIMITACOES.md`, seções "O que 'fechar a conta' significa aqui" e "Desde quando os dados são confiáveis" |
| Dados fictícios de homologação; nenhuma operação de teste em hóspedes reais | Feito — projeto Supabase de homologação isolado (`pzzgdququnsbmameejxz`), nunca compartilhado com produção; todo dado de teste usado durante o desenvolvimento foi removido depois de cada verificação |

## Checklist "Validamos juntos antes de produção" (seção 10)

A maior parte deste bloco pede validação **conjunta**, não algo que se marca
sozinho. Abaixo, o que já foi demonstrado tecnicamente vs. o que ainda
depende de decisão/teste em conjunto.

| Item | Situação |
| --- | --- |
| Bar e frigobar da mesma estadia, taxa, isenção e desconto com totais exatos | Demonstrado — `exemplos/conta-taxa-isenta.json`, e testado com dados reais no ambiente local durante o desenvolvimento das Partes 31/44 |
| Duas estadias consecutivas na mesma suíte sem misturar contas | Demonstrado — mecanismo `guest_slot`, testado nas Partes 42/43 (ver `CLAUDE.md`) |
| Troca de quarto e lançamento tardio mantendo a estadia correta | **Não aplicável neste app** — não existe troca de quarto dentro de uma mesma estadia (ver `room_assignments` em "Dados que este app nunca guardou") |
| Conta sem ID Stays fica pendente até associação explícita | Demonstrado — `link_status: "unlinked"` quando `stays_reservation_id` é nulo; nenhuma suposição automática é feita |
| Edição, cancelamento, reabertura e correção de vínculo aparecem no sincronismo | Demonstrado — triggers no Postgres capturam qualquer mudança em `room_bills`/itens/comandas, sem exceção (Parte 44) |
| Repetir páginas e retomar após queda não duplica itens/pagamentos | Demonstrado — paginação por keyset determinística; `/changes` é idempotente (reconsultar o mesmo cursor devolve os mesmos eventos) |
| Mudanças simultâneas à carga e timestamps iguais não perdem registros | Demonstrado — cursor é `id` bigserial monotônico, não timestamp |
| Cursor expirado exige carga completa sem excluir registros por ausência | Demonstrado — `410 CURSOR_EXPIRED` implementado e testado |
| Token inválido e tentativa de outra propriedade não revelam dados | Demonstrado — `401` sem token/token revogado; não há múltiplas propriedades neste app (`403` por escopo não se aplica) |
| Fechamento sem pagamento não quita a reserva ou o financeiro | Demonstrado — `closed_pending_payment` é um status distinto de `paid`, sem nenhum efeito financeiro automático |
| Pagamento parcial/misto, estorno e dado desconhecido tratados separadamente | **Divergência aceita** — este app nunca teve pagamento parcial/misto/estorno; sempre `payments.length <= 1`, documentado em `openapi.yaml` |
| Falha da origem mantém último dado identificado como desatualizado, não zero | Depende do lado consumidor (fora deste app) — este app sempre devolve o estado real atual, nunca zero por falha própria |
| Consumo já existente como extra Stays não é cobrado novamente | **Pendente de decisão conjunta** — este app não verifica se um item já foi lançado como extra na Stays; é responsabilidade do lado consumidor conferir antes de cobrar (seção 9 do PRD, "nossa responsabilidade" é do lado do João/Vila Corada reservas) |
| Primeiro aceite somente de leitura por Beatriz; financeiro validado com Márcia | **Pendente** — depende de vocês, fora do escopo técnico deste app |
| Revisão de código, testes, árvore limpa, commit publicado, deploy READY, verificação das rotas | Feito pra homologação (ver abaixo); produção já está com o código implantado (deploy contínuo padrão deste projeto), mas sem token gerado — não considerar "ativada" sem autorização explícita |

## Testes executados

### Schema e triggers (banco de homologação, projeto `pzzgdququnsbmameejxz`)

- `schema.sql` e `seed.sql` aplicados com sucesso — 11 suítes, 96 itens de
  checklist, 29 categorias de ocorrência, 9 mesas, 9 categorias de
  manutenção com 90 itens, 5 itens de frigobar, 24 itens de bar. Todas as
  tabelas com RLS ativa (verificado via `list_tables`).
- Triggers de histórico de mudanças testados diretamente no Postgres local
  (antes da homologação existir, durante o desenvolvimento da Parte 44):
  `UPDATE` em `room_bills`, `INSERT` em item de frigobar, em comanda e em
  item de comanda — cada um confirmado incrementando `version` e gravando
  uma linha nova em `room_bill_change_events`, sem nenhum código
  TypeScript de escrita envolvido.

### Endpoints (ambiente de homologação, URL real)

Executado via `scripts/smoke-test-consumos.mjs` contra
`https://app-camareiras-vila-corada-git-homologacao-v-corada.vercel.app/api/integration/v1`,
com um token de serviço gerado e revogado só para este teste:

```
OK   - GET /rooms sem token responde 401
OK   - Erro sem token segue o formato {error:{code,message,request_id}}
OK   - GET /rooms responde 200
OK   - GET /rooms devolve um array em data
OK   - GET /rooms tem has_more: false (sem paginação)
OK   - Room tem os campos obrigatórios (id, property_id, number, label, active)
OK   - GET /stay-accounts responde 200
OK   - GET /stay-accounts devolve um array em data
OK   - Primeira página tem snapshot_id e sync_cursor
AVISO - nenhuma conta encontrada (banco vazio) — checagens de shape de StayAccount puladas
OK   - GET /stay-accounts/{id} inexistente responde 404
OK   - GET /changes responde 200
OK   - GET /changes devolve um array em data
OK   - GET /changes sempre devolve next_cursor, mesmo com data vazio
OK   - Cursor inválido responde 400 ou 410 (nunca 200)

Todos os testes passaram.
```

O banco de homologação está vazio de propósito (nenhuma conta de
bar/frigobar criada ainda) — por isso o teste de fumaça avisa e pula a
checagem de forma de um `StayAccount` real. Essa checagem específica **foi**
feita durante o desenvolvimento, contra o ambiente local com dados
sintéticos (contas abertas, fechadas, pagas e isentas), antes de a
homologação existir — ver `CLAUDE.md`, Parte 44, "Testado".

### Gestão de token

- Geração de token via `/dashboard/api-tokens` testada com sessão
  autenticada real (Playwright) durante o desenvolvimento: diálogo mostra
  o valor uma vez, token aparece como "Ativo" na lista, revogar um token
  o marca como "Revogado" e passa a responder `401`.
- Usuário admin do ambiente de homologação criado (mesmo processo manual
  documentado no `README.md` para o primeiro admin de qualquer instalação
  nova); credencial entregue fora deste repositório.

### OpenAPI

- `openapi.yaml` validado com `js-yaml` (um erro de sintaxe real
  encontrado e corrigido durante o desenvolvimento: dois-pontos sem aspas
  dentro de uma descrição quebrava o parser).

## Migrations aplicadas

| Ambiente | Situação |
| --- | --- |
| Local (Docker) | Todas as migrations até `048_room_bill_change_log.sql`, incluindo as desta entrega |
| Produção (`tedeqaofbchemfpsyezb`) | Todas as migrations até `048`, aplicadas antes do código correspondente ser publicado (mesma prática já usada neste projeto) |
| Homologação (`pzzgdququnsbmameejxz`) | Schema completo (`schema.sql`) e seed (`seed.sql`) aplicados de uma vez, já refletindo todas as migrations — projeto criado depois de tudo já estar pronto |

## Pendências e responsáveis

- **Conferência de duplicidade com extras já lançados na Stays**:
  responsabilidade do sistema consumidor (Vila Corada reservas), não deste
  app — ver seção 9 do PRD.
- **Aceite formal de leitura (Beatriz) e validação financeira (Márcia)**:
  pendente, fora do escopo técnico.
- **Ativação em produção**: código já implantado, mas nenhum token gerado
  em produção — requer autorização explícita antes de qualquer uso real.
- **Rate limiting**: não implementado nesta versão (divergência aceita e
  documentada); pode ser adicionado numa iteração futura se o volume de
  chamadas exigir.
- **Perguntas da seção 0.3 do PRD**: as decisões de negócio relevantes
  (regra da taxa de serviço, distinção de estadias, o que "fechar" significa)
  já foram tomadas ao longo do desenvolvimento deste app e estão
  documentadas em `MAPEAMENTO-E-LIMITACOES.md` — não há mais decisão de
  negócio pendente do lado deste app; qualquer ajuste de agora em diante é
  uma mudança de requisito, não uma lacuna de informação.
