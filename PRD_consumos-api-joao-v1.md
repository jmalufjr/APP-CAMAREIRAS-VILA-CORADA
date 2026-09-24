# Vila Corada — instruções para implementar a API de consumos

Observacao inicial: toda vez que este arquivo se referir a Joao ele esta se referindo a pessoa que esta implementando junto com voce este webapp Vila Corada Camareiras. E toda vez que se referir a app do Joao ele esta se referindo a este webapp Vila Corada Camareiras.

Data: 22/09/2026. Versão do documento: 1.1. Versão proposta da API: V1.

**Documento único para encaminhamento.** João pode anexar este arquivo inteiro
à IA que trabalha no aplicativo dele. Não é necessário acesso à nossa conversa,
ao repositório de reservas ou a outros arquivos para compreender a solicitação.
Os exemplos são inteiramente fictícios; não há senhas ou dados reais aqui.

**Situação:** pedido de implementação e contrato proposto, não API existente ou
integração implantada. O aceite do João autoriza o trabalho no projeto dele;
divergências de contrato devem ser alinhadas com a equipe de reservas. Migração
de dados reais e publicação em produção exigem autorização específica.

## 0. Instrução direta para a IA implementadora

Você está trabalhando no **aplicativo de camareiras/consumos do João**, cujo
endereço informado é `https://app-camareiras-vila-corada.vercel.app`.
Sua tarefa é preparar e implementar, no repositório desse aplicativo e com a
autorização do responsável, uma API de leitura para integração com o **sistema
de reservas e recebimentos Vila Corada**. São dois sistemas diferentes.

Neste documento, “nosso sistema”, “nosso importador” e “nossa equipe” significam
o sistema de reservas e sua equipe. Você implementa o lado **fornecedor dos
consumos**. A outra equipe implementará o conector, o vínculo com a reserva e a
exibição dos consumos depois de receber sua entrega.

Leia o documento inteiro antes de agir. Não responda apenas com um plano ou com
rotas demonstrativas: implemente o que for compatível e autorizado, teste e
entregue evidências. Se faltar acesso ao repositório, ambiente isolado ou decisão
de negócio, registre o bloqueio exato. Não invente capacidade existente, dado
histórico, teste aprovado ou URL de uma API que ainda não foi publicada.

### 0.1. Escopo que você deve preservar

- Inspecione primeiro as instruções locais, arquitetura, autenticação, banco,
fluxo de frigobar, comandas, fechamento, pagamentos e testes existentes.
- Preserve mudanças de terceiros e o funcionamento diário das camareiras/bar.
Não reescreva o aplicativo nem redesenhe áreas sem relação com a API.
- Reutilize a stack existente. Não imponha Next.js/Supabase ao app do João só
porque o sistema consumidor usa essa stack. Não contratar serviços ou criar
dependência de infraestrutura paga sem autorização.
- API externa somente GET. As telas internas existentes podem continuar seus
lançamentos normais; alterações mínimas nelas para vincular a estadia e manter
o histórico devem ser explicadas, testadas e aprovadas pelo João.
- Não implementar o conector do Vila Corada, integração bancária, emissão fiscal,
conciliação automática, webhooks ou escrita na Stays.
- Não solicitar nossas senhas, banco ou credenciais Stays. O vínculo manual por
`stay_id`/`account_id` permite começar sem compartilhar esses acessos.
- Não converter automaticamente um acumulado por suíte em várias estadias,
nem deduzir pagamentos de saldos zerados ou contas fechadas.
- Não usar produção para fixtures/testes, apagar históricos, executar migrations
remotas, fazer backfill real ou deploy de produção sem autorização específica.



### 0.2. Execute nesta ordem e mantenha um checklist

**A — Diagnóstico.** Mapeie tabelas/modelos, IDs existentes e todos os caminhos
que criam, editam, cancelam ou fecham consumos. Entregue uma matriz com campo
solicitado, fonte real, transformação e limitação. Confirme se há estadia
separada de suíte e se pagamentos realmente são registrados individualmente.

**B — Compatibilidade.** Use os nomes e regras deste contrato como alvo. Se algo
não puder ser atendido, liste a divergência e a alternativa; não altere o
contrato silenciosamente. Mudanças de cálculo, identificação da estadia,
semântica de pagamento ou sincronismo precisam de acordo antes da integração.
Se faltar histórico confiável, proponha data de corte e pendência explícita.

**C — Contrato executável.** Crie `openapi.yaml` ou `openapi.json` em OpenAPI
3.1.x, com todos os schemas, campos obrigatórios/nullable, enums, autenticação,
paginação, limites, exemplos e erros. O arquivo deve descrever a implementação
real, não apenas copiar exemplos sem validação. Tokens/cursors dos exemplos são
fictícios. Identifique o documento como rascunho até concluir os testes.

**D — Implementação isolada.** Implemente autenticação de serviço com escopo por
propriedade, os quatro recursos GET, normalização monetária, identificadores
estáveis, versionamento e sincronização persistente. Mudanças de domínio e seu
registro no histórico devem ser atômicos; instrumente todos os caminhos de
escrita, não apenas a tela mais utilizada. Em ambiente serverless, não dependa de
memória do processo para checkpoints, eventos ou snapshots. Não mantenha uma
transação de banco aberta entre requisições HTTP. Escolha uma estratégia
compatível com a stack e demonstre que passa nos testes de concorrência.

Se forem necessárias migrations, faça-as aditivas, versionadas e testadas em
ambiente isolado, com plano de reversão. Não execute saneamento de dados reais
como efeito colateral de criar a API. GET não pode fechar conta, marcar pago,
cancelar itens ou criar cobranças. Telemetria e rate limiting não alteram o
domínio de consumo.

**E — Validação.** Execute testes de contrato, domínio, segurança, sincronismo
e regressão do aplicativo. Cubra a matriz da seção 10. Anote comando, ambiente,
resultado e limitações. Valide o schema OpenAPI e seus exemplos. Teste API e
persistência de verdade no ambiente isolado, não somente funções com mocks.

**F — Homologação.** Prepare um ambiente separado, com banco isolado e dados
sintéticos. Publique esse ambiente apenas se autorizado pelo responsável.
Credencial de teste deve ser entregue por canal seguro, nunca na documentação,
em commits, prints, logs ou na resposta da IA. Se o preview exigir autenticação
adicional de hospedagem, documente o procedimento para acesso servidor a
servidor, sem desativar a proteção da produção.

**G — Handoff.** Entregue o pacote da seção 12. Use “pronto para integração em
homologação” somente quando os endpoints estiverem acessíveis e testados, com
OpenAPI correspondente. Se não houver publicação autorizada, escreva “pronto
localmente, aguardando publicação de homologação”, sem alegar entrega online.
Produção fica condicionada ao aceite conjunto e à autorização de publicação.

### 0.3. Decisões que você deve confirmar com João

1. Como a operação distingue entrada de novo hóspede de reabertura da conta do
  mesmo hóspede? Quem inicia/encerra a estadia e como trata troca de quarto?
2. “Fechar a conta” registra apenas encerramento ou um pagamento verificável,
  com forma, valor, data e conta de destino? Existe pagamento parcial/misto?
3. Qual é a base real da taxa de serviço? Como descontos, isenções e
  arredondamentos funcionam hoje? Não mudar cobranças históricas para atender
   uma fórmula proposta.
4. Há consumos lançados também na Stays? Há referência técnica para distingui-los?
5. Desde quando os dados são confiáveis por estadia e qual histórico pode ser
  disponibilizado sem atribuir consumos a hóspedes errados?

Essas questões não justificam inventar respostas. É possível desenvolver o
contrato e testes com dados sintéticos enquanto as respostas são alinhadas;
não liberar cobrança real com regras ainda indefinidas.

## 1. Mensagem para encaminhar

João, precisamos consultar os consumos do seu aplicativo dentro das reservas do
Vila Corada. A proposta é uma API HTTPS/JSON, autenticada e somente de leitura,
com contas de consumo separadas por estadia, itens de frigobar/bar, taxa de
serviço, descontos, cancelamentos e pagamentos informados.

Não precisamos acessar seu banco nem alterar consumos pela API. Precisamos de
IDs estáveis e consulta incremental para atualizar os registros sem duplicação.
O vínculo ideal é o ID da reserva da Stays; se você ainda não o tiver, precisamos
de um ID permanente de estadia/conta para fazer a associação no nosso sistema.
Somente o número da suíte não é suficiente.

Confira o contrato abaixo e nos devolva: URL de homologação, documentação
OpenAPI, credencial de leitura por canal seguro, exemplos fictícios e eventuais
diferenças do seu modelo atual. Não envie senha de administrador nem chave de
acesso irrestrito ao banco.

## 2. Responsabilidades e escopo

```text
Stays -- leitura --> Vila Corada: reserva e hospedagem
                            ^
                            | API GET autenticada
                            |
App do João: estadia --> conta de consumo --> itens e pagamentos informados

Vila Corada: vínculo conferido --> consumos na reserva
                              --> cobrança discriminada
                              --> entrada financeira somente após confirmação
```

- João é a origem de itens, preços aplicados, descontos, taxa de serviço,
cancelamentos e fechamentos do aplicativo dele.
- Stays permanece a origem operacional das reservas e continua GET-only.
- Vila Corada mantém a associação com a reserva, a conferência financeira e os
recebimentos efetivos. Não sobrescrevemos o histórico do app do João.
- V1: leitura por consulta periódica; sem webhooks, escrita remota, emissão
fiscal, estoque, compras, contas a pagar ou integração bancária.
- Primeira ativação: exibir/conferir consumos. Criar cobranças e vincular
recebimentos é uma etapa posterior de homologação, não efeito de um GET.



## 3. Vínculo com o nosso sistema


| Campo da API proposta   | Correspondência no Vila Corada                                                      |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `reservation.stays_id`  | `StaysReservationCore.externalId` / `ReservationReceivable.reservationExternalId`   |
| `reservation.reference` | `StaysReservationCore.reference`; código exibido, não chave primária                |
| `room.stays_listing_id` | `StaysReservationCore.listingId` / `listingExternalId`                              |
| `property_id`           | ID da propriedade no app do João, mapeado para nossa propriedade; não é ID da suíte |
| `account_id`            | ID estável da conta de consumo daquela estadia no app do João                       |
| `stay_id`               | ID estável da estadia no app do João, mesmo após troca de quarto                    |
| `items[].id`            | ID estável do lançamento de consumo                                                 |
| `payments[].id`         | ID estável do pagamento informado na origem                                         |


IDs são strings opacas. Não converter para número, reconstruir IDs nem usar
nome do hóspede como chave. Não precisamos de CPF, telefone, e-mail ou nome de
hóspede nesta API. O nome já pode ser apresentado a partir da reserva local.

### Como começar sem integração de reservas no app do João

1. O app precisa separar as estadias: nova ocupação gera outro `stay_id` e outra
  conta. Nunca reaproveitar a conta anterior ao trocar o hóspede da suíte.
2. `reservation.stays_id` pode ser `null` inicialmente, com
  `link_status: "unlinked"`. Nosso sistema fará associação manual auditada
   usando suíte e período como sugestões, não como confirmação automática.
3. Uma vez associado, novos itens da mesma conta seguem essa associação. Não
  haverá escrita no app do João para gravar o vínculo nesta primeira etapa.
4. Se João já possuir o ID da Stays, usar `link_status: "linked"`; ainda assim
  validaremos a propriedade e a existência da reserva antes de aceitar.
5. Para automatizar a seleção no app dele, poderemos posteriormente oferecer
  uma API nossa de reservas em leitura. Essa API ainda não existe e não é
   requisito para começar com o vínculo manual.

Se o histórico atual for somente acumulado por suíte, sem separar estadias, é
necessária uma data de corte e conferência do histórico. Não inventar estadias,
datas ou pagamentos. Registros ambíguos ficam pendentes e fora da cobrança.

Troca de quarto preserva `stay_id`, conta e itens; registrar os períodos em
`room_assignments`. Cada item preserva `room_id` do momento do consumo. Mais de
uma conta pode se vincular à mesma reserva, mas um item não pode ser copiado
para outra conta com um novo ID para representar a mesma cobrança.

## 4. Segurança e convenções

- Base proposta: `https://<dominio-do-app>/api/integration/v1`.
- `Authorization: Bearer <token-de-integracao>`; token exclusivo, revogável,
rotacionável, de leitura e limitado à propriedade autorizada.
- Autorização por objeto em todos os endpoints: trocar um ID ou cursor jamais
deve revelar outra propriedade. Validar permissões no servidor.
- Credenciais separadas para homologação/produção; sem senha de usuário, chave
Supabase privilegiada, token na URL ou segredo no frontend.
- Respostas privadas com `Cache-Control: no-store`. Logs só com identificadores
técnicos mínimos e códigos de erro, sem payloads, valores ou credenciais.
- `Content-Type: application/json`; moeda `BRL`; dinheiro inteiro em centavos.
- Datas civis: `YYYY-MM-DD`; instantes: RFC 3339 com fuso, preferencialmente UTC
terminado em `Z`; fuso operacional `America/Fortaleza`.
- `null` significa indisponível/não informado. Zero somente quando confirmado.
- IDs nunca reutilizados. `version` inteiro positivo e crescente por conta.
- Alterar item, pagamento, vínculo, quarto, taxa ou estado incrementa a versão
da conta e atualiza `updated_at`, na mesma transação que registra a mudança.
- Preservar campos da V1; alteração incompatível exige V2 e transição combinada.



## 5. Endpoints solicitados

Todos são **GET**. Não precisamos de POST, PATCH ou DELETE nesta integração.


| Endpoint relativo à base           | Retorno                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `/rooms`                           | IDs e números/rótulos das suítes, situação ativa e ID Stays se disponível |
| `/stay-accounts?limit=25`          | Carga inicial paginada de contas completas, inclusive fechadas/canceladas |
| `/stay-accounts?cursor=<opaco>`    | Próxima página do mesmo retrato consistente da carga inicial              |
| `/stay-accounts/{account_id}`      | Retrato completo e atual de uma conta autorizada                          |
| `/changes?cursor=<opaco>&limit=25` | Mudanças posteriores ao checkpoint, inclusive cancelamentos e reaberturas |


Limite padrão 25, máximo 100, aceito também em `/rooms` com paginação por cursor.
Página tem `data`, `next_cursor` (`null` no fim) e `has_more`. `/rooms` inclui
`id`, `property_id`, `number` (string), `label`, `active`, `stays_listing_id`.
`stays_listing_id` é nullable; os demais campos da suíte são obrigatórios.
O detalhe retorna diretamente o objeto conta, sem envelope `data`.

Filtros opcionais, se implementados: `stay_id`, `reservation_stays_id` e
`room_id`. Não são necessários ao sincronismo global. Não filtrar a sincronização
apenas pelas contas abertas, pela suíte atual ou pela data de criação.

### Sincronização sem perder mudanças

- A primeira página de `/stay-accounts` fixa um retrato consistente e devolve
`snapshot_id` e `sync_cursor`: ponto inicial do histórico de alterações.
As páginas seguintes preservam esse retrato, mesmo com vendas simultâneas.
- Cada conta vem completa, com todos os itens e pagamentos; não truncar arrays
silenciosamente. Se o volume exigir paginação interna, combinar uma revisão
deste contrato com versão/snapshot por conta antes da implementação.
- Depois de importar todas as páginas, chamamos `/changes` com `sync_cursor`.
Assim uma mudança durante a carga inicial não se perde.
- `/changes` devolve eventos ordenados de um histórico durável. Cada evento tem
`event_id`, `occurred_at`, `account_id`, `version`, `type: "account.updated"`
e `account` com o retrato completo daquela versão, inclusive cancelamentos.
- O cursor é opaco, escopado à propriedade e ordenado por mudanças efetivamente
confirmadas. Não usar apenas `updated_at > ultima_data`: empates e transações
concorrentes podem fazer registros sumirem.
- A resposta de mudanças contém `data`, `next_cursor` e `has_more`. Aqui
`next_cursor` **sempre** é o checkpoint para continuar, mesmo quando
`has_more: false` ou `data: []`.
- Repetir uma página pode repetir eventos, nunca criar novos IDs para eles.
Nosso importador deduplica por origem + propriedade + entidade + versão.
Uma versão antiga recebida depois não substitui uma mais nova.
- Nosso checkpoint só avança depois da persistência atômica de toda a página.
Reconsultar após queda deve ser seguro.
- Proposta de retenção do histórico de mudanças: no mínimo 90 dias; documentar
valor real. Cursor expirado retorna `410 CURSOR_EXPIRED` e exige nova carga
consistente. Prazo do snapshot inicial: mínimo 30 minutos, documentado.
- Contas e itens cancelados permanecem consultáveis como registros lógicos,
inclusive numa nova carga. Ausência numa página não significa exclusão.
- Frequência inicial proposta: 1 a 5 minutos, a ajustar aos limites disponíveis.
Informaremos a última atualização e falhas na UI; indisponibilidade não é zero.



### Envelopes de resposta — exemplos fictícios

Exemplo de última página de uma carga inicial vazia. Com registros, `data`
contém objetos completos da seção 6. `snapshot_id` e `sync_cursor` devem vir
em todas as páginas e permanecer iguais durante essa carga.

```json
{
  "data": [],
  "next_cursor": null,
  "has_more": false,
  "snapshot_id": "demo-snapshot-001",
  "sync_cursor": "demo-checkpoint-001"
}
```

Resposta de mudanças quando não há novidades. Não significa falha nem exige
reiniciar a carga: o consumidor persiste `next_cursor` e volta a consultar.

```json
{
  "data": [],
  "next_cursor": "demo-checkpoint-001",
  "has_more": false
}
```

Quando houver mudanças, cada entrada de `data` contém os campos `event_id`,
`occurred_at`, `account_id`, `version`, `type` e `account` descritos acima.
`account.account_id` e `account.version` devem coincidir com o evento.
O schema deve exigir `account` completo, não um patch parcial.

## 6. Conta completa — exemplo fictício

Este é o objeto retornado pelo detalhe e dentro de `data` da carga inicial.
IDs e valores abaixo são sintéticos, sem relação com hóspedes reais.

```json
{
  "account_id": "demo-account-001",
  "stay_id": "demo-stay-001",
  "property_id": "demo-property-001",
  "version": 3,
  "status": "open",
  "currency": "BRL",
  "reservation": {
    "stays_id": null,
    "reference": null,
    "link_status": "unlinked"
  },
  "check_in_date": "2026-09-20",
  "check_out_date": "2026-09-23",
  "room_assignments": [
    {
      "room_id": "demo-room-005",
      "started_at": "2026-09-20T17:00:00Z",
      "ended_at": null
    }
  ],
  "items": [
    {
      "id": "demo-item-001",
      "order_id": "demo-order-001",
      "room_id": "demo-room-005",
      "category": "pool_bar",
      "product_id": "demo-product-001",
      "description": "Produto de exemplo",
      "quantity": 2,
      "unit_price_cents": 1500,
      "gross_cents": 3000,
      "discount_cents": 0,
      "service_charge_base_cents": 3000,
      "service_charge_rate_bps": 1000,
      "service_charge_cents": 300,
      "service_charge_waived": false,
      "total_cents": 3300,
      "status": "active",
      "occurred_at": "2026-09-21T16:30:00Z",
      "created_at": "2026-09-21T16:31:00Z",
      "updated_at": "2026-09-21T16:31:00Z",
      "cancelled_at": null,
      "change_reason_code": null
    }
  ],
  "payments": [],
  "payment_data_quality": "complete",
  "totals": {
    "gross_cents": 3000,
    "discount_cents": 0,
    "service_charge_cents": 300,
    "total_cents": 3300,
    "reported_paid_cents": 0,
    "reported_balance_cents": 3300
  },
  "created_at": "2026-09-20T17:00:00Z",
  "updated_at": "2026-09-21T16:31:00Z",
  "closed_at": null,
  "cancelled_at": null,
  "change_reason_code": null
}
```



### Regras dos campos e cálculos

- Campos do exemplo são obrigatórios; nullable: vínculo Stays/referência,
datas de estadia desconhecidas, início/fim de ocupação desconhecidos,
`order_id` (frigobar sem comanda), `product_id` (legado), cancelamento/fechamento
e motivo quando não aplicável. Não inventar horário para converter data antiga.
- Se datas ou detalhes históricos não existirem, declarar a limitação na
homologação. O exemplo é o contrato-alvo para novos registros, não autorização
para preencher histórico desconhecido com dados artificiais.
- Conta: `open`, `closed` ou `cancelled`. Reabrir gera nova versão `open`, limpa
`closed_at` na versão atual e preserva o fechamento anterior no histórico.
- Item: `active` ou `cancelled`. Cancelar mantém ID e valores históricos,
informa `cancelled_at` e motivo codificado; não entra nos totais ativos.
- Categorias: `minibar` e `pool_bar`. Outras precisam ser combinadas antes.
- V1 aceita quantidade inteira positiva; se houver venda fracionada, combinar
unidade e escala decimal explicitamente antes de integrar esses itens.
- `gross_cents = quantity * unit_price_cents`.
- `0 <= discount_cents <= gross_cents`.
- `total_cents = gross_cents - discount_cents + service_charge_cents`.
- Taxa em pontos-base: `1000 = 10%`. Base proposta para bar: bruto menos
desconto. João deve confirmar a regra real; não recalcularemos silenciosamente
o que já foi cobrado. Arredondar ao centavo mais próximo, metade para cima.
- Isenção preserva taxa/base, mas `service_charge_cents = 0`,
`service_charge_waived = true` e motivo; frigobar normalmente tem taxa zero.
- Desconto/isenção aplicado à conta deve ser distribuído entre itens, com
arredondamento determinístico e soma exata. Não cobrar taxa novamente no total.
- `totals` soma somente itens ativos. Preço é o praticado na venda; alteração
posterior do cardápio não pode modificar consumos antigos.
- Edição parcial de quantidade/desconto gera versão auditada. Cancelamento da
conta cancela logicamente seus itens; pagamentos preservados não somem.
- Motivos por códigos (`operator_correction`, `guest_waiver`, `duplicate`,
`cancellation`); sem textos livres contendo dados pessoais.



## 7. Pagamentos informados, separados dos itens

Se o aplicativo registrar pagamentos detalhados, cada elemento de `payments`
segue este modelo fictício. Se não registrar, **não criar pagamentos a partir
do botão de fechar conta**: usar `payment_data_quality: "not_recorded"`, array
vazio e totais de pago/saldo `null`. Histórico parcial usa `"partial"`; completo
usa `"complete"`. Zero pago só pode significar ausência confirmada de pagamento.

```json
{
  "id": "demo-payment-001",
  "kind": "payment",
  "original_payment_id": null,
  "status": "recorded",
  "method": "pix",
  "amount_cents": 5000,
  "allocated_to_account_cents": 3300,
  "financial_account_external_id": null,
  "external_reference": null,
  "occurred_at": "2026-09-22T14:00:00Z",
  "created_at": "2026-09-22T14:01:00Z",
  "updated_at": "2026-09-22T14:01:00Z",
  "cancelled_at": null,
  "change_reason_code": null
}
```

- `method`: `pix`, `cash`, `bank_transfer`, `card`, `other` ou `unknown`.
`card` reserva compatibilidade futura, não declara cartões habilitados hoje.
- `kind`: `payment` ou `refund`. Estorno real usa novo ID, valores positivos e
`original_payment_id`; não apagar/cancelar também o original como se nunca
tivesse ocorrido. `status: "cancelled"` é correção de um registro inválido.
- `amount_cents` é o valor total do pagamento; `allocated_to_account_cents` é
somente a parcela aplicada àquela conta. Ambos inteiros positivos e parcela
não superior ao total. Pagamento misto não é integralmente receita de consumo.
- O mesmo pagamento distribuído entre contas conserva o mesmo ID e cabeçalho;
cada conta informa sua parcela, sem somar duas vezes o valor integral.
Uma mudança de cabeçalho/estorno atualiza todas as contas afetadas.
- Soma das parcelas entre contas não pode ultrapassar o pagamento. Restante de
um pagamento misto exige conferência; não presumir que quitou a hospedagem.
- `reported_paid_cents`: soma de parcelas `recorded` de pagamentos menos
parcelas `recorded` de refunds. Refund acumulado não excede parcela paga.
- `reported_balance_cents = total_cents - reported_paid_cents`; não forçar a
zero quando negativo. Sinalizar crédito/divergência para conferência.
- Com dados incompletos, os dois totais são `null`, mantendo os registros
disponíveis. Pagamento informado **não significa conciliado no banco**.
- `external_reference` é referência técnica opcional, não comprovante ou texto
com dados bancários pessoais. Não enviar cartões, documentos ou credenciais.
- A emissão da nota fiscal não faz parte desse estado de pagamento.



## 8. Respostas de erro e limites

Formato: `{"error":{"code":"CURSOR_EXPIRED","message":"Reinicie a carga.", "request_id":"demo-request-001"}}`. Sem stack trace ou dados privados.


| HTTP | Uso                                                                    |
| ---- | ---------------------------------------------------------------------- |
| 400  | parâmetro inválido, cursor malformado, limite fora do permitido        |
| 401  | credencial ausente/inválida                                            |
| 403  | credencial sem escopo para a operação                                  |
| 404  | objeto inexistente ou de outra propriedade, sem revelar sua existência |
| 410  | cursor/snapshot expirado; reiniciar carga                              |
| 429  | limite atingido, com `Retry-After`                                     |
| 503  | indisponibilidade temporária; nunca responder lista vazia como sucesso |


Informar limites por minuto, timeout recomendado, retenção e prazo dos snapshots.
Proposta inicial: 60 requisições/minuto por integração, negociável. Nosso lado
terá timeout e retentativas limitadas com espera para falhas transitórias;
401/403/contrato inválido interrompem o sincronismo e geram aviso.

## 9. Adaptações necessárias no Vila Corada — nossa responsabilidade

O contrato não se encaixa automaticamente no modelo atual sem desenvolvimento:

- Hoje `ReceivableSource` aceita `manual | stays | legacy`, e entradas
financeiras declaram origem `manual`. Precisaremos acrescentar origem de
consumo e seus vínculos de forma explícita, não disfarçá-los como Stays.
- Criar armazenamento próprio para contas/itens, versões e associações,
com RLS por propriedade e migrations aditivas. Chave externa inclui sistema
de origem + propriedade + ID, com restrição única contra duplicação.
- Manter consumos separados do bruto das diárias e do ADR; apresentar composição
da estadia sem sobrescrever `grossCents`, `extrasCents` ou comissão da Stays.
- Conferir se um item já foi lançado como extra na Stays. Sem referência externa
confiável, encaminhar à revisão; valor e descrição iguais não comprovam cópia.
- Canal da reserva não define quem recebe o consumo: reserva Booking pode ter
frigobar pago diretamente. Não incluir consumo em lote OTA automaticamente.
- `reservation_receivables` representa cobranças/direitos; `financial_receipts`
representa dinheiro recebido. Na futura integração financeira, reutilizar
uma entrada existente ou criar uma após confirmação, com alocações próprias,
sem duplicar pagamentos importados ou lançados manualmente.
- Correção de consumo já cobrado/conciliado gera pendência auditada. Não modificar
lançamento financeiro fechado automaticamente nem apagar histórico.
- Consumir somente no servidor, com segredo privado e controles de acesso às
reservas. Não bloquear o carregamento da reserva esperando a API do João.
- Guardar o mínimo necessário no banco autorizado, sem cópias locais de dados
reais, dumps de payload ou PII desnecessária; definir retenção na implementação.



## 10. Checklist de entrega e homologação



### João entrega

- [ ] Aceite do contrato e lista explícita de campos ainda indisponíveis.
- [ ] URLs separadas de homologação/produção; token de leitura entregue em canal seguro.
- [ ] OpenAPI 3.1.x descrevendo campos, enums, nullable, limites, erros e autenticação.
- [ ] Identificadores permanentes de suítes, estadias, contas, itens e pagamentos.
- [ ] Quatro recursos GET acima, cursor consistente e cancelamentos preservados.
- [ ] Regra efetiva da taxa de serviço, descontos e arredondamento documentada.
- [ ] Explicação do que “Fechar a conta” registra e da qualidade do histórico.
- [ ] Dados fictícios de homologação; nenhuma operação de teste em hóspedes reais.



### Validamos juntos antes de produção

- [ ] Bar e frigobar da mesma estadia, taxa, isenção e desconto com totais exatos.
- [ ] Duas estadias consecutivas na mesma suíte sem misturar contas.
- [ ] Troca de quarto e lançamento tardio mantendo a estadia correta.
- [ ] Conta sem ID Stays fica pendente até associação explícita.
- [ ] Edição, cancelamento, reabertura e correção de vínculo aparecem no sincronismo.
- [ ] Repetir páginas e retomar após queda não duplica itens/pagamentos.
- [ ] Mudanças simultâneas à carga e timestamps iguais não perdem registros.
- [ ] Cursor expirado exige carga completa sem excluir registros por ausência.
- [ ] Token inválido e tentativa de outra propriedade não revelam dados.
- [ ] Fechamento sem pagamento não quita a reserva ou o financeiro.
- [ ] Pagamento parcial/misto, estorno e dado desconhecido tratados separadamente.
- [ ] Falha da origem mantém último dado identificado como desatualizado, não zero.
- [ ] Consumo já existente como extra Stays não é cobrado novamente.
- [ ] Primeiro aceite somente de leitura por Beatriz; financeiro validado com Márcia.
- [ ] Depois: revisão de código, testes, árvore limpa, commit publicado, deploy READY
  e verificação das rotas, mediante autorização da entrega de implementação.



## 11. Contexto do consumidor e referências

Base local verificada em 22/09/2026:

- Consumidor: Next.js App Router + TypeScript, com persistência financeira em
Supabase e integrações exclusivamente server-side.
- A reserva expõe `externalId`, `reference`, `listingId`, datas, situação,
valores da hospedagem e extras. A correspondência está na seção 3.
- Recebíveis e entradas financeiras são entidades diferentes, conectadas por
alocações. Pagamento informado por uma origem externa não comprova entrada
efetiva no banco. Consumo não deve alterar automaticamente lotes OTA.
- Evidências internas de referência, sem necessidade de enviá-las ao João:
`src/lib/integrations/stays/stays-contract.ts`,
`src/lib/finance/reservation-receivables.ts`,
`src/lib/finance/financial-receipts.ts` e
`docs/spec/adr-reservation-receivables-and-financial-receipts.md`.

Esses caminhos pertencem ao repositório consumidor. Não tente abri-los ou
criá-los no projeto do João; as informações necessárias estão neste documento.

A inspeção anterior do app identificou frigobar, comandas, consolidação por
suíte, taxa/isenção e fechamento. Não comprovou API pública, esquema do banco
ou vínculo interno com Stays. Esta proposta não afirma que essas capacidades
técnicas já existam.

Referências primárias consultadas: [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
para descrição do contrato HTTP; [OWASP API1 — autorização por objeto](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/)
para a exigência de checar a propriedade em cada consulta. As regras de negócio,
endpoints e desenho de sincronismo acima são uma proposta nossa, não exigências
dessas fontes nem documentação do aplicativo do João.

## 12. Pacote que João deve devolver à equipe de reservas

Entregar arquivos pequenos e utilizáveis pela outra equipe, sem exportar banco,
dados de hóspedes ou segredos. Nomes sugeridos, podendo seguir a organização
do repositório do João:


| Artefato                         | Conteúdo obrigatório                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openapi.yaml` ou `openapi.json` | Contrato validado que corresponde aos endpoints implementados                                                                                      |
| `INTEGRACAO-CONSUMOS-README.md`  | Base URL de homologação, autenticação, sequência carga/mudanças, limites e instruções de execução                                                  |
| `MAPEAMENTO-E-LIMITACOES.md`     | Campos e respectivas fontes, dados ausentes, significado de fechar conta e regras efetivas de cálculo                                              |
| `exemplos/`                      | JSONs sintéticos válidos: conta aberta, fechada sem pagamento conhecido, cancelamento, taxa isenta, pagamento parcial e estorno, quando suportados |
| Teste de fumaça executável       | Usa URL/token por ambiente, testa autenticação e consultas sem imprimir token ou payload real                                                      |
| `VALIDACAO-INTEGRACAO.md`        | Matriz da seção 10, testes/comandos/resultados, commit e pendências reais                                                                          |


Documentar os nomes das variáveis necessárias, nunca seus valores reais.
O teste de fumaça deve ser somente leitura e falhar se a API retornar contrato
inválido; não criar ou fechar contas reais para demonstrar funcionamento.
Fixtures e testes que escrevem rodam exclusivamente no banco isolado.

Token de homologação e, posteriormente, token de produção são entregues fora
desses arquivos, por canal seguro. A URL de produção só é informada como
disponível após autorização, publicação e verificação efetiva.

### Formato da resposta final da IA do João

Preencha com evidências reais, sem credenciais:

```text
ESTADO: pronto localmente / pronto para homologação / bloqueado
REPOSITÓRIO E COMMIT:
URL BASE DE HOMOLOGAÇÃO: ou “ainda não publicada”
CONTRATO OPENAPI: caminho do arquivo
AUTENTICAÇÃO: mecanismo, escopo e procedimento seguro de entrega
IDENTIFICAÇÃO: como suíte, estadia e conta são diferenciadas
VÍNCULO STAYS: disponível / null com associação no consumidor
PAGAMENTOS: complete / partial / not_recorded, com explicação da cobertura
SINCRONISMO: estratégia, retenção, expiração e comportamento de retomada
TESTES: comandos executados, resultados e limitações
MIGRATIONS: preparadas / aplicadas somente em teste / pendentes de aprovação
DIVERGÊNCIAS DO CONTRATO: nenhuma ou lista precisa
ARQUIVOS ENTREGUES:
PENDÊNCIAS E RESPONSÁVEIS:
PRODUÇÃO: não alterada / alteração especificamente autorizada e verificada
```

Só depois desse retorno a equipe do Vila Corada configura o conector e realiza
os testes conjuntos. Aprovar esta especificação ou publicar homologação não
equivale a autorizar importação financeira, migração ou deploy em produção.