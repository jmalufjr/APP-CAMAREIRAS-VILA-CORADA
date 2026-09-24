# Mapeamento de campos e limitações — API de consumos

> Artefato de entrega da seção 12 de `PRD_consumos-api-joao-v1.md`. Para
> cada campo do contrato (`openapi.yaml`), a fonte real no banco deste app e
> qualquer transformação aplicada. Fonte de verdade do código:
> `src/lib/integration/stay-accounts.ts` e `src/lib/room-bills.ts`.

## `GET /rooms` → `Room`

| Campo | Fonte real | Observação |
| --- | --- | --- |
| `id` | `rooms.id` | direto |
| `property_id` | constante `"vila-corada"` | só existe uma propriedade neste app |
| `number` | `rooms.number` | direto |
| `label` | `rooms.name` | nome de exibição já cadastrado ("Suíte N") |
| `active` | `rooms.active` | direto |
| `stays_listing_id` | `rooms.stays_listing_id` | nullable — só populado pra suítes já mapeadas na Stays |

## `StayAccount` (usado em `/stay-accounts`, `/stay-accounts/{id}` e dentro de `ChangeEvent.account`)

| Campo | Fonte real | Observação |
| --- | --- | --- |
| `account_id` | `room_bills.id` | é a própria conta de bar/frigobar do quarto |
| `stay_id` / `reservation.stays_id` | `room_bills.stays_reservation_id` | `_id` opaco da reserva na Stays; gravado pela sincronização diária/manual (Parte 43 do `CLAUDE.md`), nunca pela API |
| `reservation.reference` | sempre `null` | este app nunca guardou o código legível da reserva, só o `_id` interno |
| `reservation.link_status` | derivado | `"linked"` se `stays_reservation_id` não é nulo, senão `"unlinked"` |
| `version` | `room_bills.version` | incrementada por **trigger no Postgres** a cada mudança na conta ou em qualquer item/comanda dela — nunca por código da aplicação (ver "Sincronização" abaixo) |
| `status` | `room_bills.status` mapeado | `aberta`/`reaberta` → `open`; `fechada` → `closed_pending_payment`; `paga` → `paid`. Não existe `cancelled` — não há cancelamento de conta inteira neste app |
| `room_id` / `room_number` | `room_bills.room_id` / `rooms.number` | join direto |
| `guest_slot` | `room_bills.guest_slot` | `unica` (padrão, imensa maioria dos dias) / `saida_hoje` / `chegada_hoje` — ver "Como este app separa estadias" abaixo |
| `items[]` | `room_bill_minibar_items` + `bar_comanda_items` (via `bar_comandas`) | **agregados por (conta, produto)**, não por lançamento individual — ver limitação abaixo |
| `items[].id` | `"<category>:<product_id>"` | string opaca composta |
| `items[].unit_price_cents` | preço médio | se o mesmo produto foi lançado em mais de um preço dentro da mesma conta (ex.: cardápio mudou no meio do ciclo), o preço unitário exibido é a média — `gross_cents`/`total_cents` continuam exatos, só o unitário é aproximado nesse caso raro |
| `items[].service_charge_cents` | 10% do bruto, só para `pool_bar` | frigobar (`minibar`) nunca tem taxa de serviço |
| `items[].discount_cents` | sempre `0` | este app não tem desconto por item nem por conta |
| `payments[]` | `room_bills.payment_method` + `paid_at` | no máximo 1 elemento, sempre o **valor total** da conta — nunca parcial, misto ou estorno |
| `payment_data_quality` | `"complete"` se `payments.length > 0`, senão `"not_recorded"` | mesmo com `status: "paid"`, uma conta paga antes de a coluna `payment_method` existir (ou por um caminho que não a gravou) aparece como `not_recorded` — bug real encontrado e corrigido durante o desenvolvimento (ver Parte 44 do `CLAUDE.md`) |
| `totals` | `computeBillTotals` (`src/lib/room-bills.ts`) | mesma função usada pelas telas internas do app — sem duplicar a matemática de totais em nenhum lugar |
| `created_at` / `updated_at` | `room_bills.opened_at` / `updated_at` | |
| `closed_at` / `paid_at` | `room_bills.closed_at` / `paid_at` | |
| `cancelled_at` | sempre `null` | não existe cancelamento de conta inteira neste app |

## `ChangeEvent` (`/changes`)

| Campo | Fonte real |
| --- | --- |
| `event_id` | `room_bill_change_events.id` (bigserial, também o cursor) |
| `occurred_at` | `room_bill_change_events.occurred_at` |
| `account_id` / `version` | copiados do evento — sempre coincidem com `account.account_id`/`account.version` |
| `type` | sempre `"account.updated"` — não há distinção de subtipo de mudança |
| `account` | retrato completo e **atual** da conta na hora da consulta (não um patch do que mudou) |

## Como este app separa estadias (em vez de `room_assignments`)

O contrato original propunha um `stay_id` próprio com histórico de
`room_assignments` (início/fim de ocupação por quarto). Este app nunca
rastreou isso — a conta de consumo é sempre por **quarto**, não por estadia
independente do quarto.

Na esmagadora maioria dos dias, isso não é um problema: 1 conta por quarto,
como sempre foi (`guest_slot = "unica"`). A única situação em que duas
estadias podem coexistir na mesma suíte é o dia de "Saída com Chegada" (o
hóspede que sai ainda não pagou quando o hóspede novo chega) ou uma
vacância de alguns dias entre hóspedes sem pagamento no meio — nesses casos,
a conta antiga vira `guest_slot = "saida_hoje"` e nasce uma conta nova
`guest_slot = "chegada_hoje"`, cada uma com seu próprio `account_id`,
preservando os itens já lançados na antiga.

Isso cobre a exigência central do PRD ("nunca reaproveitar a conta anterior
ao trocar o hóspede da suíte") sem precisar de uma entidade "estadia"
própria — o vínculo com a reserva real (`stays_reservation_id`) já
identifica de forma única e estável qual período aquela conta representa.

## O que "fechar a conta" significa aqui

- **`fechada` (`closed_pending_payment`)**: a camareira travou novos
  lançamentos de consumo (RLS bloqueia escrita), mas **nenhum pagamento foi
  registrado ainda** — é um estado de "aguardando cobrança", não de
  encerramento financeiro.
- **`paga` (`paid`)**: pagamento confirmado, com a forma escolhida pela
  camareira (Pix, cartão de crédito, cartão de débito, transferência
  bancária ou dinheiro) — sempre o **valor total já calculado** no momento
  do fechamento, nunca digitado à parte, nunca parcial. Ao confirmar,
  **nasce automaticamente uma conta nova `aberta`** pro mesmo quarto.
- Não existe "reabrir e cancelar" nem "fechar sem intenção de cobrar" — uma
  conta fechada sempre segue pra pagamento ou é reaberta para correção
  (volta a aceitar lançamentos, e o ciclo fechar→pagar recomeça).

## Regra da taxa de serviço

- Taxa fixa de **10%** sobre o valor bruto do bar da piscina
  (`SERVICE_CHARGE_RATE = 0.1`, `src/lib/room-bills.ts`) — nunca sobre o
  frigobar.
- **Isenção é por conta inteira, não por item**: desde que a taxa de
  serviço não é obrigatória por lei no Brasil, a camareira pode isentá-la
  numa conta específica (normalmente porque o hóspede recusou pagar) — isso
  zera `service_charge_cents` de todos os itens de `pool_bar` daquela conta
  e marca `service_charge_waived: true` neles.
- Sem arredondamento especial além do padrão (centavo mais próximo).
- `discount_cents` sempre `0` — este app nunca implementou desconto.

## Dados que este app nunca guardou (não é uma lacuna a preencher — é o modelo real)

- `room_assignments` com hora de início/fim de ocupação por quarto.
- `order_id` por item (frigobar não passa por comanda) e cancelamento
  individual de item com motivo codificado — uma comanda cancelada
  simplesmente não aparece nos itens, não vira "item com `cancelled_at`".
- Pagamento parcial, misto ou estorno (`kind: "refund"`) — sempre 1
  pagamento integral ou nenhum.
- `check_in_date`/`check_out_date` por conta — essas datas vivem na
  reserva da Stays, não neste app; quem precisar delas deve consultar a API
  da Stays usando o `stays_id` devolvido aqui.
- `change_reason_code` — não há edição parcial de item auditada por
  motivo; um item é sempre o agregado atual do que está ativo.

## Desde quando os dados são confiáveis

- `room_bills.version`/`updated_at` e o histórico de mudanças
  (`room_bill_change_events`) só existem a partir da migration `048`
  (23/09/2026) — contas anteriores a essa data têm `version = 1` (valor
  padrão da coluna), não um histórico real de quantas vezes mudaram.
- `stays_reservation_id` só é preenchido retroativamente pela
  sincronização (Parte 43) a partir de 23/09/2026 — contas pagas antes
  disso ficam com `stay_id: null` / `link_status: "unlinked"` permanentemente
  (não há backfill de dado histórico que este app não tinha capturado).
- `payment_method` só existe a partir da migration `044` (23/09/2026) —
  contas pagas antes disso têm `payment_data_quality: "not_recorded"`
  mesmo estando com `status: "paid"`.
