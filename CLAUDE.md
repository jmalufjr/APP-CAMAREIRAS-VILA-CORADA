@AGENTS.md

# Camareiras Vila Corada — Resumo do projeto

> Registro objetivo do que foi construído e das decisões tomadas, escrito
> como se fosse o planejamento de fases que teria sido feito antes de
> começar. Serve para retomar o contexto do zero caso a conversa com o
> Claude seja perdida. Requisitos completos e changelog detalhado ficam em
> `PRD_Camareiras_parte01.md` — este arquivo é o mapa rápido de "o que existe
> e onde".

## O que é

Web app de gestão do serviço de camareiras da pousada Vila Corada:
planejamento diário de arrumação/preparação/troca de quartos, checklists,
ocorrências de manutenção, layout e hóspedes das mesas do café da manhã,
chegadas/saídas do dia e comissão da equipe. Uma segunda parte do projeto
adicionou um módulo completo de manutenção corretiva (ocorrências,
funcionário de manutenção) e preventiva (categorias/itens recorrentes,
checklists) — **já mesclada em `main` e implantada em produção** (branch
`feature/manutencao` integrada via PR #1). Ver seção "Parte 02 do projeto"
abaixo e `PRD_Camareiras_parte02.md`. Uma terceira leva de iterações (ver
seção 10) reorganizou a tela "Listas" em submenu, adicionou ordenação de
itens de checklist/manutenção preventiva e datas iniciais configuráveis
para o cronograma de manutenção preventiva. Uma quarta leva (seção 11)
adicionou controle de consumo de frigobar e do bar da piscina por quarto,
com conta compartilhada entre os dois (fechar/reabrir/pagar) e cards
equivalentes no histórico e no "Resumo executivo". Uma quinta leva (seção 12)
substituiu o lançamento direto de consumo do bar da piscina por um sistema
de comandas (pedidos por quarto, numerados, editáveis/canceláveis) e passou
o fechamento/reabertura/pagamento da conta do quarto do admin para a
camareira — o admin passou a só visualizar. Uma sexta leva (seção 13)
adicionou o envio automático por e-mail (Resend) do recibo em PDF de uma
conta de quarto ao ser paga, com reenvio manual pelo admin em caso de
falha, e uma tela de pagamento por PIX (QR code estático) acionada pela
camareira quando a conta está fechada. Uma sétima leva (seção 14)
acrescentou o formato de mesa "Quadrada" ao layout do café. Em
15/09/2026 o app entrou em uso real ("Parte 08", seção 15): os dados de
teste foram zerados do banco de produção, o lançamento de quantidade de
frigobar pela camareira passou a usar o mesmo seletor +/- já usado nas
comandas de bar, e o ambiente de desenvolvimento local passou a rodar num
Supabase isolado via Docker em vez de compartilhar o banco de produção.
Em seguida vieram: checklists "Saída com Chegada"/"Somente Saída"/"Somente
Chegada" e configuração diária de mesas (Parte 09); serviços atrasados
não somem mais da tela da camareira, cancelamento e um log de 7 dias no
Resumo Executivo (Parte 10); a primeira fase da integração com a API de
reservas da Stays, sincronizando o Planejamento Diário (Parte 11,
`PRD_regrasdenegocio.md`); a renomeação "Quarto" → "Suíte" em todo o app e
a alocação de suítes por mesa no layout do café, com tonalidade mais clara
para mesas ocupadas (Parte 12); e a extensão da sincronização com a Stays
para Chegadas & Saídas (com busca do nome do hóspede) e Mesas do Café (com
o algoritmo de distribuição por proximidade da vista do mar) — Parte 13.

## Onde está

- **Repositório**: https://github.com/jmalufjr/APP-CAMAREIRAS-VILA-CORADA (branch `main`, deploy automático a cada push)
- **Produção**: https://app-camareiras-vila-corada.vercel.app
- **Banco**: projeto Supabase próprio (Postgres + Auth + Row Level Security)

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
(`@base-ui/react`) + Supabase (Postgres/Auth/RLS) + Recharts + next-themes.
Toda mutação de dados passa por Server Actions (`src/lib/actions/*.ts`); não
há rotas de API REST nem uso do cliente Supabase do navegador — leitura
também é feita em Server Components.

## Fases de desenvolvimento (ordem em que foi feito)

1. **Fundação**: scaffold Next.js + Tailwind + shadcn/ui; clientes Supabase
   (browser/server/admin/middleware); schema SQL inicial (`supabase/schema.sql`)
   e seed (`supabase/seed.sql`) com os 11 quartos, itens de checklist
   (arrumação/preparação), categorias de ocorrência e 9 mesas do café; tema
   visual (paleta clara/escura da marca, fontes) e logo provisório.
2. **Autenticação e layout base**: login por seleção de nome pré-cadastrado
   + senha (Supabase Auth); middleware de proteção de rotas por papel
   (admin/camareira); sidebars separadas por papel, responsivas (menu Sheet
   no mobile).
3. **CRUD administrativo core**: Quartos, Camareiras (criação via Auth Admin
   API, reset de senha), Checklists & Ocorrências (itens por tipo de
   trabalho e por quarto, categorias de ocorrência), valor da comissão.
4. **Mesas do café**: layout arrastável, CRUD de mesas, hóspedes por mesa
   (hoje/amanhã), cálculo de comissão.
5. **Planejamento diário e execução pelas camareiras**: admin define tipo de
   trabalho por quarto/dia; camareira preenche checklist, registra
   ocorrências e observações, libera o quarto.
6. **Dashboard e Histórico**: cards de resumo do dia, gráfico mensal,
   tabela histórica filtrável por período com exportação CSV.
7. **Deploy em produção**: Vercel conectada ao GitHub, variáveis de
   ambiente configuradas com boas práticas (chave secreta do Supabase nunca
   exposta ao client — ver seção "Segurança" abaixo).
8. **Iterações pós-lançamento** (mudanças de requisito pedidas ao longo do
   uso — detalhadas em `PRD_Camareiras_parte01.md` seção 8):
   - Modo claro/escuro com **dois** temas escuros (bordô e azul), seletor de
     3 opções em todas as telas.
   - Logo oficial (PNG, troca automática por tema) substituindo o
     desenho provisório; padronização do lettering "Vila Corada / CAMAREIRAS".
   - **Mudança de fluxo importante**: camareira passou a escolher o próprio
     quarto entre os disponíveis, em vez de o admin atribuir manualmente.
   - Terceiro tipo de trabalho **"Troca"** + renomeação
     "Preparação" → **"Preparação Chegada"**.
   - Seletor Hoje/Amanhã no Planejamento diário (componente reutilizável
     `DateSwitcher`).
   - Nova tela **Chegadas & Saídas** (admin edita, camareira lê).
   - Limite de 10 hóspedes por mesa (independente da capacidade configurada)
     + campo de observações por mesa, visível também no dashboard do admin.
   - Renomeação "Ocorrências" → **"Ocorrências Manutenção"** em todo o app;
     novas telas de visibilidade para o admin (`/ocorrencias`,
     `/ocorrencias/[data]`, `/ocorrencias/historico`) com ranking das 10
     categorias mais frequentes; mesma coluna/ranking adicionados ao
     `/historico` geral.
   - Duas novas categorias de ocorrência: "Mau cheiro quarto" e
     "Mau cheiro banheiro".
   - `PRD_Camareiras_parte01.md` criado como PRD vivo, atualizado com todo
     esse changelog.
9. **Parte 02 — módulo de Manutenção** (branch `feature/manutencao`,
   implementada, testada e **mesclada em `main`/implantada** — detalhada na
   seção "Parte 02 do projeto" abaixo e em `PRD_Camareiras_parte02.md`):
   - Novo papel **"Funcionário de Manutenção"**; tela "Camareiras" virou
     **"Usuários"** (cadastra os dois papéis).
   - **Ocorrências de manutenção** ganharam ciclo de vida
     pendente → selecionada → resolvida, com tela própria para o
     funcionário de manutenção selecionar/resolver.
   - Módulo de **Manutenção Preventiva** novo: categorias e itens
     recorrentes (9 categorias × ~10 itens, seed baseado em boas práticas
     do setor), com tela do funcionário organizada em cards por
     categoria+semana e dashboard do admin por semana.
   - Item de menu "Checklists & ocorrências manutenção" renomeado para
     **"Listas"**.
   - Lição de arquitetura importante: transições de estado sensíveis
     (selecionar/resolver/concluir) usam funções `security definer` no
     Postgres em vez de policies de RLS de UPDATE combinadas — ver
     "Regras específicas desta parte 02" abaixo.
10. **Parte 03 — reorganização de "Listas", ordenação de itens e datas de
    manutenção preventiva** (feita direto em `main`, pós-merge da parte 02):
    - **Latência no checklist da camareira**: o toque num item esperava um
      round trip completo ao servidor (1 select + até 3 updates) e depois
      um `router.refresh()` de página inteira antes do "X" aparecer.
      Resolvido com UI otimista no cliente (estado local atualizado no
      clique, sem esperar o servidor) + a função `security definer`
      `toggle_daily_room_task_check` (migration 012), que colapsa as
      idas ao banco em 1 round trip.
    - **"Listas" virou um submenu vertical** em vez de abas: `/checklists`
      lista Arrumação, Troca, Preparação Chegada, Ocorrências Manutenção,
      Manutenção Preventiva, Quartos e Layout & mesas, cada um como rota
      própria com botão "Voltar" (`src/components/shared/back-link.tsx`).
      **Quartos** foi movido de `/quartos` para `/checklists/quartos`, e
      **só a aba "Layout & mesas"** (não a tela inteira "Mesas do café")
      foi movida para `/checklists/mesas` — "Mesas do café" continua no
      menu principal, agora só com "Hóspedes de hoje/amanhã" e o valor da
      comissão (`src/app/(admin)/mesas/gerenciar/guests-admin-panel.tsx`).
    - **Ordenação de itens**: o admin escolhe a posição (inclusive
      primeira/última) de um item ao criar ou editar, tanto em
      `checklist_items` (arrumação/troca/preparação) quanto em
      `maintenance_items` (compartilhada entre técnico e não técnico da
      mesma categoria). Implementado com as funções `security definer`
      `reorder_checklist_items`/`reorder_maintenance_items` (migration
      013), que recebem a lista completa de ids já na ordem final e
      reescrevem `position` de todos em 1 round trip. Cada card mostra o
      número da posição atual e anima (técnica FLIP, sem lib nova) ao
      reordenar.
    - **Data inicial da manutenção preventiva**: `maintenance_categories`
      ganhou `start_date` (data da primeira manutenção da categoria); cada
      `maintenance_items` tem `follows_category_start_date` (padrão true)
      e seu próprio `start_date` opcional para quando um item precisa de
      cronograma independente. `next_due_date` é recalculada a partir
      dessas datas por `compute_next_due_date`/`recompute_category_schedule`/
      `recompute_item_schedule` (migration 014) — **não** substitui o
      reagendamento "flutuante" já existente ao concluir um item
      (`next_due_date = current_date + periodicidade`), que continua
      valendo depois da primeira conclusão.
    - **Bug real encontrado em teste**: as chamadas `supabase.rpc(...)` de
      reordenação/recálculo não checavam `.error` — quando a migration 013
      ainda não tinha sido rodada no banco, a Server Action retornava
      sucesso mesmo sem reordenar nada, e só apareceu porque o usuário
      testou manualmente (não em `npm run build`/`lint`). Lição: **toda**
      chamada a `supabase.rpc()` numa Server Action precisa checar
      `.error` e devolvê-lo, nunca assumir sucesso.
    - **`daily_room_task_checks` é um snapshot**: os itens de uma tarefa do
      dia são copiados de `room_checklist_items` só no momento em que o
      admin define o tipo de trabalho do quarto naquele dia
      (`setRoomTask`); um item de checklist criado depois não aparece
      retroativamente em tarefas já criadas. `createChecklistItem` agora
      faz esse *backfill* automaticamente, mas só nas tarefas do mesmo
      tipo/quarto que ainda não estão `concluido` — tarefas já concluídas
      nunca são alteradas.
    - Realce sutil (pontinho, não fundo colorido — fundo colorido lia como
      "selecionado") nos 3 itens mais usados do menu do admin
      (Planejamento diário, Chegadas & saídas, Mesas do café).
11. **Parte 04 — Consumo de Bar e Frigobar** (feita direto em `main`, pós
    parte 03):
    - **Catálogos novos** geridos em "Listas": `minibar_items` (frigobar —
      "Consumo de Frigobar", `/checklists/frigobar`, seed com 5 itens) e
      `poolbar_items` (bar da piscina — "Bar da Piscina",
      `/checklists/poolbar`, com `category` opcional para agrupar em
      Petiscos/Bebidas, seed com as ~19 itens do cardápio real).
    - **Ciclo de conta único por quarto**, compartilhado entre frigobar e
      bar da piscina: `room_bills.status` = `aberta → fechada → reaberta →
      paga`, com no máximo 1 conta não-paga por quarto (unique index
      parcial). O consumo (`room_bill_minibar_items`/`room_bill_poolbar_items`)
      não é mais vinculado a uma tarefa/dia específico — é um valor por
      (conta, item) que qualquer camareira/admin pode somar enquanto a
      conta estiver aberta ou reaberta; ao fechar, a camareira fica
      bloqueada (RLS); ao marcar como paga, nasce automaticamente uma conta
      nova `aberta` para o quarto. `src/lib/room-bills.ts` tem o helper
      `getOrCreateCurrentBill`, que chama a função `security definer`
      `ensure_room_bill` (necessária porque INSERT direto em `room_bills` é
      admin-only via RLS, mas a camareira precisa poder garantir a conta de
      um quarto novo na primeira vez que lança consumo nele).
    - **Telas**: camareira lança frigobar dentro do checklist de cada
      tarefa (`/tarefas/[taskId]`, mesmo componente `ChecklistDetail`) e bar
      da piscina numa tela própria (`/bar-piscina`, menu principal dela) —
      ambas em formato **acordeão** (`src/components/ui/accordion.tsx`,
      novo wrapper de `@base-ui/react/accordion`), não mais cards em grid:
      um card em grid com ~19 itens de nomes longos cortava o campo de
      quantidade; o acordeão dá largura de tela inteira a cada quarto
      expandido. Admin gerencia tudo em `/frigobar` ("Consumo de Bar e
      Frigobar", também acordeão): cada quarto mostra os totais de
      frigobar e bar da piscina, taxa de serviço de 10% sobre o bar, total
      geral, botões "Fechar a conta" / "Pagamento efetuado" /
      "Editar/reabrir conta" (este último libera campos de quantidade
      editáveis ali mesmo, tanto de frigobar quanto de bar da piscina).
    - **Histórico e "Resumo executivo" (dashboard, ex-"Dashboard")**
      ganharam cards de frigobar e bar da piscina (nessa ordem) iguais aos
      já existentes de mesas/comissão: tabela item×quantidade×total por
      período/mês atual/mês anterior, e dois gráficos de pizza (% no mês /
      % desde o início). Como o consumo não tem mais data própria, esses
      totais somam pela data em que a conta foi **paga** (`paid_at`), não
      pela data do lançamento.
    - **Gráficos de pizza**: nome do item sobreposto na própria fatia
      (fonte pequena, halo na cor do card por trás do texto para continuar
      legível em qualquer cor de fundo), só para os 5 maiores itens; a
      lista de nome+percentual fica só na legenda abaixo do gráfico — a
      `<Legend>` do Recharts foi trocada por uma lista HTML própria porque
      a legenda automática colidia com os rótulos externos quando havia
      muitos itens pequenos.
    - **Bug real corrigido nesta parte**: uma `<TableRow>` de totais
      (tabela "Resumo diário" do histórico) estava fora de `<TableBody>`/
      `<TableFooter>`, direto como filha de `<Table>` — inválido em HTML,
      causava erro de hidratação. Corrigido envolvendo com `<TableFooter>`
      (já existia no componente base `src/components/ui/table.tsx`, só não
      estava sendo usado). Pré-existente, não introduzido por esta parte.
12. **Parte 05 — Comandas de bar da piscina** (feita direto em `main`, pós
    parte 04; requisitos completos em `PRD-comandas.md`):
    - **Consumo de bar deixou de ser um valor editado por item** e passou a
      vir de **comandas** (pedidos por quarto): `bar_comandas` (numeração
      `sequence_number` sequencial **por conta** — reinicia em 1 sempre que
      o quarto ganha uma conta nova ao ser paga — e status `original` /
      `cancelada` / `editada`; não existe um quarto estado "em edição"
      persistido, foi decisão explícita do proprietário não gravá-lo) e
      `bar_comanda_items` (item + quantidade + preço no momento do pedido).
      Substituem `room_bill_poolbar_items` (migration 016), removida nesta
      parte (migration 018). Frigobar não mudou em nada.
    - **Todas as transições passam por funções `security definer`**
      (`submit_comanda`/`edit_comanda`/`cancel_comanda`), seguindo o padrão
      já estabelecido — nunca INSERT/UPDATE direto pela camareira. Editar
      uma comanda também permite trocar o quarto (decisão explícita do
      proprietário, ao contrário da minha recomendação inicial): a comanda
      passa a pertencer à conta corrente do novo quarto, com nova
      numeração se for uma conta diferente.
    - **Fechar/reabrir/marcar como paga a conta do quarto virou ação da
      camareira**, não mais do admin: `close_room_bill`/`reopen_room_bill`/
      `pay_room_bill` (também `security definer`) substituíram os UPDATEs
      diretos que existiam em `src/lib/actions/room-bills.ts` desde a parte
      04 — mesma lógica de antes, só a checagem de papel muda de
      `is_admin()` para a nova `is_camareira()`.
    - **Telas novas da camareira**: "Comanda" (`/comanda` — lista de
      comandas ativas + botão "Novo pedido") e o formulário de pedido
      (`/comanda/novo` e `/comanda/[id]/editar`, mesmo componente
      `comanda-form.tsx` para criar e editar), com seletor de quantidade em
      stepper (+/-) em vez de campo numérico — exigência explícita do
      proprietário para não deixar a camareira digitar números. A antiga
      tela "Consumo de Bar da Piscina" da camareira (`/bar-piscina`) virou
      "Consumo por quartos": mesmo acordeão e mesmas ações que a extinta
      tela do admin (fechar/reabrir/pagar), com a diferença de que a seção
      de bar agora é só leitura (soma das comandas ativas do quarto) e só o
      frigobar continua editável ali.
    - **Tela do admin `/frigobar` virou só leitura**, com duas abas
      (`src/components/ui/tabs.tsx`): "Lista de comandas do bar"
      (`comandas-list-panel.tsx`, mesmo componente de detalhe
      `src/components/shared/comanda-detail-dialog.tsx` reaproveitado da
      tela da camareira) e "Consumo por quartos" (`frigobar-rooms-panel.tsx`,
      sem nenhum botão de ação nem campo editável).
    - **Lição de eficiência**: o modal de "ver itens da comanda" não busca
      dados sob demanda ao clicar — `getActiveComandas()` já traz os itens
      de cada comanda embutidos na mesma consulta da lista. Uma primeira
      versão buscava os itens num `useEffect` ao abrir o modal, mas isso
      cai na regra de lint `react-hooks/set-state-in-effect` (evitar
      `setState` direto dentro de um efeito) e, mais importante, introduz
      um round trip extra por clique — evitado ao carregar tudo de uma vez
      no primeiro carregamento da página, coerente com o requisito de
      "processamento rápido, sem delays".
    - **Bug real encontrado em teste manual**: `edit_comanda` já bloqueava
      editar uma comanda quando a conta do quarto de **destino** estava
      fechada, mas `cancel_comanda` não checava status nenhum — permitia
      cancelar uma comanda de um quarto com a conta fechada, contrariando a
      regra de que nada pode ser feito numa comanda depois que a conta é
      fechada. Corrigido na migration `019_comanda_closed_bill_guard.sql`:
      `cancel_comanda` passou a checar o status da conta atual da comanda, e
      `edit_comanda` passou a checar também o status da conta **original**
      da comanda (antes só olhava a de destino) — assim trocar de quarto na
      edição não vira uma forma de contornar o bloqueio. A tela também
      passou a travar proativamente (steppers, seletor de quarto e os dois
      botões desabilitados + aviso) assim que a comanda editada pertence a
      uma conta fechada, em vez de só mostrar o erro depois de tentar
      salvar/cancelar.
    - **Bug encontrado em teste manual, RLS de `profiles`**: a tela
      "Comanda" da camareira mostrava "—" no lugar do nome de quem fez a
      última ação sempre que essa ação foi de OUTRA camareira. Causa: a
      única policy de select em `profiles` era "própria linha ou admin" — o
      join embutido pro nome de created_by/last_action_by falha
      silenciosamente (volta null) quando o dono da linha é outra
      camareira. Corrigido com a policy `profiles_camareira_select_camareiras`
      (migration `022`), mesmo padrão já usado para o funcionário de
      manutenção ver colegas camareiras.
13. **Parte 06 — Recibo em PDF por e-mail e pagamento por PIX** (feita
    direto em `main`, pós parte 05):
    - **PDF do recibo gerado sob demanda, sem persistir arquivo nenhum**:
      `src/lib/receipt-pdf.tsx` usa `@react-pdf/renderer` (`renderToBuffer`)
      pra montar o PDF a partir dos dados já existentes no banco (itens de
      frigobar/bar, totais) toda vez que é preciso — tanto pro link "Ver
      PDF" do admin quanto pro anexo do e-mail (envio automático e
      reenvio). Decisão deliberada de não usar nenhum serviço de storage
      (Supabase Storage/Vercel Blob): como os dados de uma conta paga são
      imutáveis, reconstruir o PDF sempre a partir do banco é mais simples
      e sempre fiel, sem arquivo órfão pra gerenciar.
    - **E-mail só no pagamento, nunca no fechamento**: `pay_room_bill`
      (migration `023`) passou a devolver o id da conta paga (antes era
      `void`) pra `markRoomBillPaid` conseguir gerar e mandar o recibo
      daquela conta específica por e-mail (via Resend) logo em seguida — só
      pro e-mail fixo da contabilidade, nunca por quarto/hóspede. Envio é
      **melhor esforço**: nunca lança erro nem bloqueia a confirmação de
      pagamento pra camareira — o resultado (sucesso/falha) fica gravado em
      `room_bills.receipt_email_sent` via a função `mark_receipt_email_sent`
      (checa `is_camareira() or is_admin()`, já que tanto o envio
      automático quanto o reenvio manual do admin passam por ela).
    - **E-mail de destino configurável pelo admin, não fixo por variável de
      ambiente** (adicionado logo depois, ainda dentro desta parte):
      migration `024_receipt_settings.sql` criou a tabela singleton
      `receipt_settings` (mesmo padrão de `commission_settings`) com a
      coluna `accounting_email`; um card "E-mail da contabilidade" no final
      da aba "Consumo por quartos" do admin (dentro de
      `frigobar-rooms-panel.tsx`) deixa esse e-mail editável ali mesmo, sem
      precisar mexer em variável de ambiente nenhuma.
    - **Domínio de envio verificado no Resend**: `consumos.vilacorada.com.br`
      — um subdomínio dedicado (não o domínio raiz do site nem `www`),
      registrado como domínio próprio no Resend com os registros DKIM (TXT)
      e SPF (2 CNAME) adicionados manualmente no painel DNS do Registro.br
      (o domínio já roda nos servidores DNS do próprio Registro.br). Escolha
      deliberada de subdomínio em vez do domínio raiz: isola a reputação de
      envio deste sistema automatizado de um futuro e-mail "de verdade" da
      pousada no domínio principal. Remetente padrão
      `recibos@consumos.vilacorada.com.br` (`src/lib/actions/room-bills.ts`,
      função `sendReceiptEmail`), sobrescrevível pela variável de ambiente
      opcional `RECEIPT_FROM_EMAIL` caso precise trocar no futuro.
    - **Admin vê e reenvia, camareira nunca vê o PDF**: a aba "Consumo por
      quartos" do admin, na seção "Contas pagas (últimos 7 dias)"
      (`frigobar-rooms-panel.tsx`), ganhou um botão "Ver PDF" (aponta pra
      `/api/room-bills/[billId]/receipt`, uma Route Handler que gera o PDF
      na hora e checa `role === "admin"` manualmente — rotas de API não
      passam pelo middleware de proteção por papel, que só olha caminhos de
      página) e, quando `receipt_email_sent` é `false`, um badge vermelho
      "E-mail não enviado" já visível no card fechado do acordeão + um
      aviso destacado + botão "Reenviar e-mail". A camareira não tem acesso
      a nada disso — nem o link do PDF nem o resultado do envio aparecem em
      nenhuma tela dela.
    - **Pagamento por PIX é uma imagem estática, não um QR dinâmico**: a
      camareira, com a conta fechada, tem um botão "Pagar com PIX" que abre
      `/bar-piscina/pix/[roomId]` — mostra a imagem `public/pix-qrcode.png`
      (chave PIX fixa da pousada, sem valor embutido) + o valor total da
      conta como texto ao lado, pro hóspede digitar manualmente ao pagar. A
      imagem fica num fundo branco fixo (não segue o tema escuro do app) e é
      renderizada com `<img>` simples, não `next/image` — de propósito,
      pra não passar pelo otimizador de imagem do Next.js (recompressão/
      reamostragem que poderia degradar a nitidez de um QR code, que precisa
      de bordas nítidas pra ser lido pela câmera).
    - **Lição de teste**: `@react-pdf/renderer` (via sua dependência
      `@react-pdf/hyphenate`) falha com `ERR_PACKAGE_PATH_NOT_EXPORTED`
      quando rodado fora do bundler do Next.js (testado isoladamente via
      `npx tsx`) — o pacote é ESM-only e algo no caminho de resolução do
      `tsx` tenta um `require()` CJS num subpath que só tem condição
      `import`. **Isso não é um bug real** (o bundler do Next.js resolve
      normalmente); a forma correta de testar geração de PDF nesta stack é
      sempre através de uma rota/Server Action real rodando no `next dev`,
      nunca isolado via `tsx`/`ts-node`.
14. **Parte 07 — Mesa quadrada no layout de mesas** (feita direto em
    `main`, pós parte 06): novo formato de mesa `table_shape` = `'square'`
    (migration `025_mesa_quadrada.sql`), ao lado dos já existentes `round`/
    `rect`. O lado da quadrada usa o mesmo tamanho fixo 70×70 já usado pela
    redonda (só o retângulo tem largura/altura diferentes entre si) — a
    diferença entre as três é só visual: círculo (`rounded-full`), quadrado
    de cantos discretamente arredondados (`rounded-md`) e retângulo de
    cantos mais arredondados (`rounded-2xl`, como antes). Como
    `TableLayoutCanvas` (`src/components/shared/table-layout-canvas.tsx`)
    é o único componente que desenha o formato — reaproveitado tanto no
    editor de layout do admin (`/checklists/mesas`) quanto na visão da
    camareira (`/mesas`) — bastou uma mudança nesse componente para
    impactar as duas telas ao mesmo tempo, sem duplicação.
15. **Parte 08 — Início do uso real: limpeza de dados de teste, stepper de
    frigobar e ambiente local isolado** (15/09/2026, feita direto em
    `main`, pós parte 07):
    - **Zeramos os dados de teste do banco de produção** no dia em que o
      app começou a ser usado de verdade: apagadas todas as linhas de
      `daily_room_tasks` (com `daily_room_task_checks`/
      `daily_room_task_occurrences` em cascata), `daily_breakfast`,
      `daily_arrivals`, `daily_departures`, `maintenance_completions` e
      `room_bills` (com `room_bill_minibar_items`/`bar_comandas`/
      `bar_comanda_items` em cascata) — todas datadas antes de hoje.
      **Preservado**: `rooms`, `breakfast_tables` (layout atual),
      catálogos (`checklist_items`, `minibar_items`, `poolbar_items`,
      `occurrence_categories`, `maintenance_categories`) e `profiles`
      (usuários, incluindo uma conta `admin-camareira` de origem
      duvidosa que o proprietário optou por não mexer por enquanto). Os
      94 `maintenance_items` que tinham `status = 'selecionada'` presa de
      teste voltaram para `'pendente'`, e `next_due_date` de todos foi
      recalculada (hoje, para quem não tem `start_date` real configurada;
      preservada para os poucos itens/categorias que já tinham uma data
      real própria) — sem isso o funcionário de manutenção veria itens
      "já selecionados" por ninguém de verdade.
    - **Quantidade de frigobar lançada pela camareira virou seletor +/-**
      (igual à comanda de bar), em vez de campo de texto numérico —
      exigência explícita do proprietário, igual ao motivo já documentado
      para a comanda (evitar a camareira precisar digitar números). O
      stepper foi extraído para um componente compartilhado,
      `src/components/shared/quantity-stepper.tsx` (antes só existia
      dentro de `comanda-form.tsx`), e passou a ser usado nos dois lugares
      onde a camareira lança frigobar: o checklist do quarto
      (`checklist-detail.tsx`) e a tela "Consumo por quartos"
      (`consumo-quartos-panel.tsx`, ao reabrir uma conta fechada pra
      editar). Cada clique no `+`/`-` já salva na hora (não existe
      "blur"/confirmação separada como no campo de texto antigo).
    - **Ambiente de desenvolvimento local deixou de compartilhar o banco
      de produção** — decisão tomada porque o app entrou em uso real e
      testes locais não podem mais poluir dados/estatísticas reais. Ver
      `README.md` seção 4 para o passo a passo completo. Resumo: Supabase
      rodando localmente via Docker (`npx supabase start`), configurado
      em `supabase/config.toml` (criado por `npx supabase init`, sem
      precisar instalar o CLI globalmente). **Detalhe técnico
      importante**: `[db.migrations]` e `[db.seed]` estão **desabilitados**
      nesse config — `supabase/migrations/` começa em `002` (não existe
      uma migration `001`; o schema inicial foi aplicado direto no painel
      da nuvem antes deste projeto usar o CLI), então o replay automático
      de migrations que `supabase start`/`db reset` fariam por padrão
      quebra contra um banco vazio. Por isso o bootstrap do banco local é
      manual, sempre `schema.sql` **antes** de `seed.sql`, direto via
      `docker exec -i supabase_db_APP_Camareiras_Vila_Corada psql -U
      postgres -d postgres -f -` (não via `supabase db query -f`, que não
      aceita arquivos com múltiplos comandos SQL). `.env.local` agora
      aponta para o Supabase local por padrão; as credenciais reais da
      nuvem foram movidas para `.env.local.cloud` (nunca versionado, só
      para o caso raro de precisar testar contra produção). De propósito,
      `.env.local` local **não** tem `RESEND_API_KEY` configurada — sem
      ela, o envio de recibo por e-mail falha silenciosamente (já é
      "melhor esforço" por design) em vez de mandar e-mail de teste de
      verdade pra conta real da contabilidade.
16. **Parte 09 — Novos checklists de saída/chegada e configuração diária de
    mesas do café** (16/09/2026, feita direto em `main`, pós parte 08;
    testada primeiro no ambiente local via Docker antes de aplicar em
    produção, seguindo o fluxo descrito na Parte 08):
    - **"Preparação Chegada" renomeado para "Saída com Chegada"** (só o
      rótulo — o valor do enum continua `preparacao`) e dois checklists
      novos: **"Somente Saída"** e **"Somente Chegada"**, cobrindo os três
      cenários possíveis de giro de quarto — arrumação/troca não mudaram.
      "Saída com Chegada" e "Somente Saída" compartilham a mesma lista de
      22 itens (limpeza completa, já que mesmo um quarto só com saída pode
      receber reserva de última hora) mais 2 itens novos de conferência
      (pertences esquecidos do hóspede que saiu / itens do quarto como
      chaves e controles que não podem ter sido levados); só não têm
      itens de boas-vindas, que dependem de uma chegada com data certa.
      "Somente Chegada" (23 itens) parte da mesma base mas os itens de
      limpeza viram uma revisão mais leve (quarto já foi limpo numa
      "Somente Saída" anterior), sem os itens de pertences esquecidos, e
      ganha itens de boas-vindas (chocolate, flor, cheirinho) e ênfase em
      testar o funcionamento dos aparelhos. Migration
      `026_checklists_saida_chegada.sql` (enum novo + conteúdo dos itens
      + associação a todos os quartos) e `schema.sql`/`seed.sql`
      atualizados para instalações novas. A tela de planejamento diário,
      o menu "Listas", a tela da camareira e o histórico já eram
      genéricos o bastante (dirigidos por `TASK_TYPE_OPTIONS`/
      `TASK_TYPE_LABELS` em `src/lib/task-type.ts`) pra aceitar os tipos
      novos sem mudança — só `src/app/(admin)/historico/history-tables.tsx`
      precisou ser generalizado (tinha 3 colunas de tipo de trabalho
      fixas no código, viraram um loop sobre `TASK_TYPE_OPTIONS`).
    - **Bug real corrigido nesta parte**: o seletor de tipo de trabalho no
      planejamento diário (`planning-board.tsx`) voltava a mostrar o valor
      cru do enum (ex.: "preparacao") em vez do rótulo assim que uma opção
      era selecionada — o componente `Select` do Base UI só "adivinha" o
      rótulo a partir do item quando o menu está montado; ao fechar, sem
      um jeito explícito de resolver o rótulo, ele cai pro valor cru.
      Corrigido passando uma função pro `<SelectValue>` (`children` como
      `(value) => label`), o padrão oficialmente documentado pelo Base UI
      pra esse caso — não testado nos outros `<SelectValue>` do app, então
      se o mesmo sintoma aparecer em outra tela, aplicar a mesma correção.
    - **Descrição dos itens de checklist da camareira virou um popover**:
      antes aparecia sempre abaixo do nome do item, em fonte pequena
      (`checklist-detail.tsx`); ocupava espaço demais no celular. Agora só
      o nome do item aparece (fonte maior, `text-base`), com um botão de
      informação (ícone "i") que abre a descrição — mesmo tamanho de
      fonte do nome — num popover ancorado no próprio item (não cobre a
      tela, não navega, fecha ao clicar de novo no mesmo lugar). Vale para
      todos os checklists da camareira, que passam pelo mesmo componente.
    - **Configuração diária de mesas do café, separada do controle por
      mesa**: nova tabela `daily_breakfast_settings` (uma linha por dia,
      `total_tables` + `notes`, migration `027_daily_breakfast_settings.sql`)
      — complementa, não substitui, `daily_breakfast` (que continua
      controlando hóspedes/observação por mesa individual). Na tela do
      admin (`/mesas/gerenciar`, agora com abas "Mesas de hoje"/"Mesas de
      amanhã" em vez de "Hóspedes de hoje"/"Hóspedes de amanhã"), logo
      abaixo da data aparecem um seletor de "Total de mesas" (0 até o
      número de mesas ativas — valor manual do admin, independente da
      contagem "Total de mesas ocupadas" já existente, calculada a partir
      do hóspede lançado por mesa) e uma caixa de "Observação do dia". Os
      dois valores aparecem pra camareira em `/mesas`, cada um no seu
      próprio card, acima do layout de mesas — a observação usa
      `whitespace-pre-wrap` pra preservar exatamente as quebras de linha
      que o admin digitou (sem isso, texto em lista virava uma linha só).
      Os cards de mesa na tela do admin passaram a ser ordenados em ordem
      crescente pelo número extraído do rótulo (`"Mesa 3"` → `3`), não
      mais pela ordem de criação no banco.
17. **Parte 10 — Serviços atrasados não somem mais, cancelamento e log de 7
    dias no resumo executivo** (16/09/2026, feita direto em `main`, pós
    parte 09; testada primeiro no ambiente local antes de aplicar em
    produção):
    - **Cards "Mesas · hoje/amanhã" saíram do Resumo Executivo e foram para
      o final da tela "Mesas do café" (`/mesas/gerenciar`)** — o layout
      visual (`TableLayoutCanvas`/`TableNotesList`) reaproveita os mesmos
      dados que a tela já buscava pras abas "Mesas de hoje/amanhã", sem
      fetch novo.
    - **Nova tabela "Serviços dos últimos 7 dias"** no Resumo Executivo,
      logo abaixo dos cards "Quartos de hoje"/"Quartos de amanhã": lista
      `daily_room_tasks` com status `concluido` ou `cancelado` dos últimos
      7 dias (data, quarto, tipo, camareira), ordenada por data
      decrescente e, dentro do mesmo dia, por número do quarto crescente.
      Linha de serviço cancelado mostra "Cancelado por {nome}" em vez do
      nome de quem executou (não clicável — nunca houve nada preenchido).
      Linha de serviço concluído é clicável e abre
      `/dashboard/tarefas/[taskId]`, uma visão **somente leitura** nova
      pro admin, reaproveitando o mesmíssimo componente
      `src/components/shared/checklist-detail.tsx` da tela da camareira
      (movido de dentro de `(camareira)/tarefas/[taskId]/` pra
      `components/shared/` justamente por passar a ser usado nos dois
      lugares) — o componente já trava tudo sozinho quando
      `task.status === 'concluido'` (checkboxes, formulário de ocorrência,
      frigobar), não precisou de nenhuma prop nova de "somente leitura".
      **Decisão importante, não pedida explicitamente**: essa visão do
      admin **não mostra consumo de frigobar** — a prop `minibar` do
      `ChecklistDetail` virou opcional e a seção inteira só aparece quando
      ela é passada. Motivo: frigobar é por **conta corrente do quarto**,
      não por tarefa/dia (ver Parte 04) — mostrar "o frigobar de hoje"
      rotulado como "o que a camareira preencheu naquele dia" seria
      mostrar dado errado sempre que a conta do quarto já tiver girado
      desde então. Se quiser esse dado ali mesmo assim, dá pra reconsiderar
      (ex.: rotular claramente como "estado atual da conta", ou investir
      num snapshot de frigobar por tarefa — mudança de modelo de dados
      maior, fora do escopo desta parte).
    - **Serviços de dias anteriores não reivindicados por ninguém não
      somem mais da tela "Meus quartos" da camareira**: antes, a tela só
      buscava `daily_room_tasks` do dia corrente (`.eq('date', hoje)`), e
      um serviço `pendente` sem `assigned_to` de um dia passado ficava
      invisível pra sempre assim que o dia virava (mesmo as RLS policies
      de `daily_room_tasks` já sendo abertas por ownership, sem filtro de
      data — o corte sempre foi só na query da página). "Disponíveis para
      escolher" virou duas subseções: "Serviços de hoje" (como antes) e
      "Serviços anteriores" (`date < hoje`, `status = 'pendente'`,
      `assigned_to is null`, sem limite de quantos dias voltam). Uma
      camareira pode **escolher** um serviço anterior (mesma
      `claimTask`, sem mudança — ele passa a aparecer em "Meus quartos"
      referenciando a **data original**, não hoje) ou **cancelar**
      (`cancelTask`/`cancel_daily_room_task`, novo enum `task_status` =
      `'cancelado'` + colunas `cancelled_by`/`cancelled_at` — migration
      `028_cancelar_servico_pendente.sql`). Implementado como função
      `security definer` (checando `is_camareira()`), não mais uma policy
      de UPDATE na tabela — `daily_room_tasks` já tem duas policies de
      UPDATE pra camareira (`drt_camareira_update_own`/`drt_camareira_claim`)
      e o próprio `CLAUDE.md` já documentava o risco de combinar mais uma
      ali (ver "Convenções e decisões importantes" abaixo). "Meus quartos"
      também passou a buscar tarefas de dias anteriores ainda atribuídas à
      própria camareira (`pendente`/`em_andamento`) — sem isso, escolher um
      "serviço anterior" faria ele desaparecer de vez (não é mais "hoje",
      então não aparecia nem em "disponíveis" nem em "meus quartos").
      Cards de serviço de dia anterior mostram a data ao lado do tipo, pra
      deixar claro que não é de hoje.
18. **Parte 11 — Integração com a Stays, fase 1: Planejamento Diário**
    (16/09/2026, feita direto em `main`, pós parte 10; requisitos completos
    em `PRD_regrasdenegocio.md`; credenciais/mapeamento em `README.md`
    seção 6):
    - **Credenciais obtidas e gravadas**: `STAYS_BASE_URL` (subdomínio da
      própria conta, não um host genérico da Stays — ex.:
      `https://jmj.stays.net`), `STAYS_CLIENT_ID`/`STAYS_CLIENT_SECRET`
      (rótulos "Login"/"Senha" na tela "Chaves da API" do App Center da
      Stays) em `.env.local` e `.env.local.cloud` — **ainda não
      adicionadas na Vercel** (só necessário quando a sincronização for
      automatizada por cron; o gatilho manual atual roda a partir de
      qualquer ambiente onde essas variáveis existam).
    - **Mapeamento quarto ↔ listing**: coluna `rooms.stays_listing_id`
      (migration `029_stays_integracao_schema.sql`), já populada pros 11
      quartos — os listings da Stays já se chamam "Suite 01".."Suite 11",
      batendo exatamente com o número do quarto no app, sem ambiguidade.
      O valor usado é o campo `_id` de `GET /external/v1/content/listings`
      (formato longo, é o mesmo valor do campo `_idlisting` em cada
      reserva) — **não** o campo curto `id` (código interno da Stays).
    - **Endpoint e parâmetros verificados na prática** (não documentados
      em detalhe na doc pública): `GET /external/v1/booking/reservations`
      com `from`/`to`/`dateType=included` retorna todas as reservas cujo
      período de estadia toca alguma data do intervalo — inclusive
      hóspedes que já fizeram check-in antes de `from`. Outros valores
      possíveis de `dateType` (não usados aqui): `arrival`, `departure`,
      `creation`, `creationorig`. O campo `type` da reserva é `"booked"`
      (reserva de hóspede de verdade) ou algo como bloqueio de calendário
      do proprietário — `src/lib/stays/client.ts` já filtra só `"booked"`.
    - **Regra de preferência (PRD seção 1) implementada via coluna
      `stays_locked`** em `daily_room_tasks` (e, já preparadas no schema
      pras próximas fases, em `daily_arrivals`, `daily_departures`,
      `daily_breakfast` e `daily_breakfast_settings` — migration
      `029_stays_integracao_schema.sql`): quando `true`, a sincronização
      nunca sobrescreve a linha. `setRoomTask` (edição manual do admin no
      Planejamento Diário) grava `stays_locked = true`. A sincronização
      também nunca mexe numa linha já reivindicada por uma camareira
      (`assigned_to` preenchido) ou que já saiu do status `pendente`
      (em andamento/concluída/cancelada) — mesmo sem lock explícito,
      trabalho já em curso nunca é tocado. **Limitação conhecida, não
      resolvida ainda**: se o admin escolhe explicitamente "Sem trabalho"
      pra um quarto/dia (limpando a linha), isso *apaga* a linha em vez de
      deixar um registro travado — a sincronização pode recriar uma
      tarefa ali no próximo ciclo se a Stays ainda indicar uma reserva
      relevante. Resolver isso exigiria uma forma de representar
      "admin decidiu explicitamente que não há trabalho" sem depender da
      existência da linha (schema atual não permite `task_type` nulo).
    - **Fórmula de troca por quantidade de noites** (PRD seção 2,
      `src/lib/stays/troca-schedule.ts`, função `trocaNights`): troca a
      cada 3 noites, exceto quando o período restante desde a última troca
      (ou desde o check-in, se ainda não houve troca) é **exatamente 4**
      noites — nesse caso, em vez de 3+1, divide-se ao meio (2+2). Fórmula
      verificada contra os 7 exemplos do PRD (4,5,6,7,8,9,10 noites) antes
      de integrar; ver comentário no arquivo pra tabela completa.
    - **`src/lib/stays/derive-planning.ts`** (`deriveWorkType`): dado o
      conjunto de reservas de um quarto e uma data, decide entre
      `preparacao` (Saída com Chegada), `somente_saida`, `somente_chegada`,
      `troca`, `arrumacao` ou `null` (quarto vago) — pura, sem I/O, fácil
      de testar isolada (foi testada isolada antes de integrar).
    - **`src/lib/actions/stays-sync.ts`** (`syncStaysPlanning`): usa o
      client admin/service-role (`createAdminClient`), não a sessão do
      usuário — necessário porque essa função precisa também rodar sem
      ninguém logado quando virar um cron job (ainda não configurado
      nesta parte; por enquanto o gatilho é manual, botão "Sincronizar com
      a Stays" na tela `/planejamento`, `sync-stays-button.tsx`). Busca
      reservas de hoje+amanhã numa única chamada, deriva o tipo por quarto
      via `deriveWorkType`, e só recria a tarefa quando o tipo mudou (evita
      apagar/recriar — e perder o progresso do checklist — sem necessidade
      quando o tipo já está correto).
    - **Testado com dados reais da API de produção da Stays** (não só
      localmente com mocks): rodado contra o banco local via uma rota de
      API temporária (mesmo truque já usado antes neste projeto pra testar
      coisas que só funcionam dentro do runtime do Next.js, ex. geração de
      PDF na Parte 06) — confirmado que o quarto já escolhido por uma
      camareira foi corretamente preservado (`skipped`), e os demais
      quartos receberam o tipo de trabalho certo, batendo com o cálculo
      feito à parte num script isolado antes da integração.
    - **Sincronização de Chegadas & Saídas e Mesas do Café implementadas
      na Parte 13** (ver abaixo). **Ainda não implementado**: automação por
      cron (Vercel Cron) — por ora toda sincronização é sempre manual, via
      botão em cada tela.
19. **Parte 12 — Renomeação "Quarto" → "Suíte" e alocação de suítes no
    layout de mesas** (16/09/2026, feita direto em `main`, pós parte 11):
    - **Todo texto visível ao usuário que dizia "Quarto"/"quarto" virou
      "Suíte"/"suíte"** em todo o app — menus, títulos, placeholders,
      mensagens de erro/toast, e-mail e PDF do recibo. **Deliberadamente
      não renomeado**: identificadores internos (`rooms`, `room_id`,
      `roomId`, o tipo TS `Room`), a rota `/checklists/quartos` e nomes de
      função/componente (ex.: `RoomsTable`) — só o texto exibido mudou, o
      código interno continua em "room"/"quarto" por baixo. Comentários de
      código em português também não foram todos revisados (não são
      visíveis ao usuário; baixa prioridade). Vale como convenção daqui
      pra frente: texto novo voltado ao usuário deve dizer "suíte", nunca
      "quarto".
    - **Layout de mesas (`TableLayoutCanvas`, compartilhado entre admin e
      camareira) ganhou duas mudanças visuais**: cada mesa agora mostra o
      nome de cada suíte alocada nela ("Suíte N") com a quantidade de
      hóspedes correspondente logo abaixo — e mesas ocupadas ficam na
      tonalidade mais clara possível (contra mesas vagas, mais escuras).
      Ver `PRD_regrasdenegocio.md` seção 5 para o requisito completo,
      incluindo a Mesa 7 podendo mostrar mais de uma suíte empilhada.
    - **Nova tabela `daily_breakfast_room_assignments`** (migration
      `030_mesa_suite_assignments.sql`): associa suíte(s) a uma mesa, por
      dia, com a quantidade de hóspedes daquela suíte especificamente —
      única por (date, room_id): uma suíte só pode estar numa mesa por
      vez, sem impedir a Mesa 7 de ter várias linhas (uma por suíte).
      **Decisão importante**: essa tabela **não substitui nem realimenta
      automaticamente** `daily_breakfast.guest_count` (o total manual já
      editado pela tela, que segue comandando a comissão) — são dois
      campos independentes que o admin preenche separadamente por ora.
      Risco aceito conscientemente: os dois podem ficar
      inconsistentes entre si (nada valida que a soma das suítes bate com
      o total digitado) — populá-los a partir da mesma fonte (a futura
      sincronização "Mesas do Café" da Stays, ainda não implementada — ver
      Parte 11) resolveria isso, mas está fora do escopo desta parte.
    - **UI do admin** (`guests-admin-panel.tsx`, componente
      `TableRoomAssignments`): dentro de cada card de mesa, uma
      lista das suítes já alocadas ali (com botão de remover) e um
      seletor pra adicionar mais uma — o seletor só oferece suítes ainda
      **não** alocadas em nenhuma mesa naquele dia (calculado a partir de
      todas as `assignments` do dia, não só as da mesa em questão), pra
      não deixar duplicar uma suíte em duas mesas ao mesmo tempo (também
      garantido no banco pela constraint `unique(date, room_id)`).
20. **Parte 13 — Sincronização de Chegadas & Saídas e Mesas do Café com a
    Stays** (16/09/2026, feita direto em `main`, pós parte 12): completa as
    duas peças que a Parte 11 tinha deixado pendentes, cada uma com seu
    próprio botão "Sincronizar com a Stays" na respectiva tela do admin
    (mesmo padrão do Planejamento Diário).
    - **Chegadas & Saídas** (`syncStaysArrivalsDepartures`, em
      `src/lib/actions/stays-sync.ts`): o nome do hóspede não vem no
      payload da reserva — precisa de uma chamada extra por reserva a
      `GET /external/v1/booking/clients/{_idclient}` (`getStaysClientName`
      em `src/lib/stays/client.ts`), cujo campo `name` já vem pronto como
      "Nome Sobrenome". As respostas são cacheadas em memória durante a
      sincronização (por `_idclient`) pra não repetir a chamada à toa.
      Noites e hóspedes vêm direto da reserva (`checkInDate`/`checkOutDate`/
      `guests`). Chegada sincroniza quando `checkInDate === data`; saída
      quando `checkOutDate === data` — só a existência da linha é
      sincronizada pro caso de saída (não há outro campo). `stays_locked`
      grava true sempre que o admin cria manualmente (`createArrival`/
      `createDeparture`) ou edita um campo sincronizável (`updateArrival`
      só trava se nome/noites/hóspedes mudou — editar só horário
      previsto/observações nunca trava, conforme a exceção do PRD seção 3).
    - **Mesas do Café** (`syncStaysBreakfastTables`, mesmo arquivo): decide
      quais suítes estão ocupadas num dia (`checkInDate < data <=
      checkOutDate` — inclui quem sai naquele dia, já que toma café antes
      de ir embora; exclui quem chega naquele dia, que só terá café no dia
      seguinte) e roda o algoritmo de distribuição por
      proximidade da vista do mar (`src/lib/stays/derive-breakfast.ts`,
      função pura `assignRoomsToTables`, verificada com casos sintéticos
      antes de integrar — mesmo rigor já usado para `trocaNights` na Parte
      11): suítes de 3 hóspedes vão pra Mesa 1 (a primeira) e Mesa 7 (as
      demais); suítes de 1-2 hóspedes preenchem as "mesas normais" (2, 3,
      4, 5, 6, 8, 9) na ordem 5→9→3→4→8→2→6; qualquer sobra que não coube
      em lugar nenhum vai pra Mesa 7 como última alternativa. Grava o
      resultado em `daily_breakfast_room_assignments` **e** soma os
      hóspedes por mesa pra `daily_breakfast.guest_count` (resolvendo o
      risco de inconsistência entre os dois campos, já apontado como
      pendente na Parte 12) — cada um respeitando seu próprio
      `stays_locked`.
    - **Nova coluna `daily_breakfast_room_assignments.stays_locked`**
      (migration `031_breakfast_assignment_lock.sql`): quando o admin
      atribui/move uma suíte manualmente (`setTableRoomAssignment`), a
      linha trava e a sincronização passa a ignorá-la, preservando a
      escolha do admin pro resto do dia (regra de preferência do PRD seção
      1). **Limitação conhecida, aceita conscientemente por ora**: o
      botão de remover uma alocação (`removeTableRoomAssignment`) não deixa
      nenhum rastro de que aquela suíte foi removida de propósito — como a
      linha simplesmente deixa de existir, a próxima sincronização pode
      recriá-la se a suíte continuar ocupada segundo a Stays. Contornável
      na prática movendo a suíte pra outra mesa em vez de só removê-la
      (isso sim trava). Resolver de verdade exigiria uma "lápide" (linha
      marcando "suíte X removida de propósito no dia Y"), deixado de fora
      por ora por não ter sido pedido e por adicionar complexidade nova ao
      modelo de dados.
    - **Testado com dados reais da API de produção da Stays**, mesmo
      truque de rota de API temporária + bypass temporário do middleware já
      usado na Parte 11 (e antes, na Parte 06 pra PDF) — confirmado
      chegadas com nome/noites/hóspedes corretos e mesas distribuídas na
      ordem esperada, ambos limpos do código depois do teste.
    - **Não implementado nesta parte** (documentado como pendência menor em
      `PRD_regrasdenegocio.md` seção 4): os quatro campos novos de
      `daily_breakfast_settings` (quantidade de mesas de 1/2/3 hóspedes,
      hóspedes na Mesa 07) — as colunas já existem (Parte 11) mas ainda não
      têm sincronização nem tela de edição própria.

## Convenções e decisões importantes

- **Modelo de planejamento**: o trabalho de um dia é planejado com um dia de
  antecedência (admin usa a aba "Amanhã"); a aba "Hoje" existe para ajustes
  de última hora e testes. Camareiras sempre veem/atuam em "Hoje".
- **Ambiente local de teste (desde a Parte 08, seção 15)**: `npm run dev`
  na máquina do proprietário roda contra um Supabase **local via Docker**
  (`npx supabase start`), não contra o banco de produção — testar não polui
  mais dados/estatísticas reais. Passo a passo completo em `README.md`
  seção 4. Login admin local: `admin@camareiras.vilacorada.app` /
  `admin123`. As credenciais da nuvem ficam em `.env.local.cloud` (não
  versionado) só para o caso raro de precisar rodar local contra produção.
- **Migrações do banco**: todo schema novo é adicionado em
  `supabase/schema.sql` (para instalações novas) **e** em um arquivo
  numerado sequencialmente em `supabase/migrations/00N_*.sql` (para rodar no
  projeto Supabase já existente, manualmente, no SQL Editor). Ao adicionar
  um novo valor a um `enum` do Postgres, isso precisa ser feito em duas
  execuções separadas (o Postgres não permite usar um valor de enum recém
  criado na mesma transação em que foi criado) — ver
  `supabase/migrations/003_troca_task_type.sql` como exemplo.
- **Segurança**: `SUPABASE_SERVICE_ROLE_KEY` só é lida em
  `src/lib/supabase/admin.ts`, importado exclusivamente por Server Actions
  (`"use server"`); nunca é usada em componentes `"use client"`. Variáveis
  `NEXT_PUBLIC_*` são as únicas expostas ao navegador. RLS ativa em **todas**
  as tabelas (checado manualmente: contagem de `create table` bate com
  contagem de `alter table ... enable row level security` em
  `supabase/schema.sql`) — admin tem acesso total, cada papel só ao que é
  seu/disponível.
- **Vulnerabilidade crítica do Next.js corrigida** (não introduzida por
  nenhuma parte deste projeto — só detectada ao instalar
  `@react-pdf/renderer`/`resend` na Parte 06, via `npm audit`): execução
  remota de código não autenticada, presente até a 16.3.2. Atualizado para
  `next@16.3.5` / `eslint-config-next@16.3.5` (pin exato, sem `^`, mesmo
  padrão já usado para `react`/`react-dom`) logo em seguida, mais
  `npm audit fix` para as demais vulnerabilidades restantes (todas em
  dependências transitivas de ferramentas de desenvolvimento — CLI do
  shadcn e ESLint —, nunca no bundle do app). `npm audit` limpo
  (0 vulnerabilidades) depois disso.
- **Transições de estado sensíveis via função `security definer`, não via
  policy de UPDATE combinada**: sempre que uma linha precisa passar por mais
  de um estado (ex.: pendente → selecionada → resolvida/concluída) e mais de
  um papel/usuário participa da transição, implementar como função SQL
  `security definer` com checagem explícita de papel no início (padrão de
  `is_admin()`/`is_manutencao()`, `select_occurrence`/`resolve_occurrence`,
  `claim_maintenance_category`/`complete_maintenance_*`), nunca como uma
  policy de UPDATE só cujo `with check` tente cobrir várias transições ao
  mesmo tempo — isso já causou um bug real em produção (ver PRD parte02,
  seção 4.1) porque o Postgres nem sempre valida esse tipo de `with check`
  combinado do jeito esperado, e o erro só aparece em teste real, não em
  `npm run build`/`lint`.
- **Sempre checar `.error` de `supabase.rpc(...)` em Server Actions**: um
  `await supabase.rpc(...)` sem checar `{ error }` engole silenciosamente
  qualquer falha (função inexistente porque a migration não rodou,
  permissão negada etc.) e a action continua retornando `{ success: true }`
  — a UI mostra "salvo com sucesso" mesmo sem nada ter mudado no banco. Já
  aconteceu de verdade (reordenação de itens em Parte 03, seção 10) e só
  apareceu em teste manual, não em `npm run build`/`lint`. Sempre capturar
  o `error` do retorno de `.rpc()` e devolver `{ error: error.message }`
  quando existir, igual já é feito para `.insert()`/`.update()`.
- **Fonte de títulos**: "The Seasons" (paga, foundry My Creative Land) não
  foi licenciada ainda — o app usa Playfair Display (Google Fonts) como
  substituta. Trocar em `src/app/layout.tsx` quando os arquivos forem
  adquiridos.
- **Primeiro usuário admin**: não é criado pelo app (a tela "Usuários" só
  cria camareiras e funcionários de manutenção) — precisa ser criado
  manualmente uma única vez via painel do Supabase. Passo a passo no
  `README.md`.
- **Recibo por e-mail** (Parte 06, ver `src/lib/actions/room-bills.ts`):
  `RESEND_API_KEY` é obrigatória por variável de ambiente — sem ela o
  envio automático falha silenciosamente (é "melhor esforço" por design) e
  fica marcado como não enviado. O e-mail de destino (contabilidade) **não**
  é variável de ambiente — é configurável pelo admin na própria tela
  "Consumo por quartos" (tabela `receipt_settings`, singleton). Domínio de
  envio verificado no Resend: `consumos.vilacorada.com.br` (subdomínio
  dedicado, separado do domínio principal do site, seguindo a prática
  recomendada de isolar a reputação de envio de e-mail transacional);
  remetente padrão `recibos@consumos.vilacorada.com.br`, sobrescrevível por
  `RECEIPT_FROM_EMAIL` se precisar trocar.

## Parte 02 do projeto: módulo de Manutenção (implementada e mesclada em `main`)

> Requisitos completos (texto integral do proprietário) + changelog
> detalhado de decisões/desvios em `PRD_Camareiras_parte02.md` (seção 4) —
> ler antes de mexer em qualquer parte deste módulo, pois tem detalhes finos
> (ex.: os dois checklists por trabalho de manutenção preventiva) que não
> cabem neste resumo.

**Objetivo**: controle de manutenção corretiva (ocorrências imediatas
identificadas pelas camareiras) e preventiva (agenda recorrente por
categoria/item), com um novo papel de usuário "Funcionário de Manutenção".

**Status**: implementação completa, testada em localhost pelo proprietário
com sucesso (fluxo de ocorrências corretivas e de manutenção preventiva,
ambos ponta a ponta), **mesclada em `main` via PR #1 e implantada em
produção**. O banco de dados já estava pronto antes do merge (as migrations
foram rodadas contra o mesmo projeto Supabase único usado por local e
produção — ver nota abaixo).

### O que foi construído (mapa rápido de arquivos)

- **Papel novo**: enum `user_role` ganhou `manutencao`; rotas do
  funcionário de manutenção ficam em `src/app/manutencao/` — **pasta real,
  não route-group** (um route-group `(manutencao)` foi tentado primeiro e
  colidiu com `/ocorrencias` do admin porque parênteses não viram segmento
  de URL; lição: ao criar um papel novo com prefixo de URL próprio, usar
  pasta real, não `(grupo)`). Layout em `src/app/manutencao/layout.tsx`.
- **Tela "Camareiras" → "Usuários"**: `src/app/(admin)/usuarios/` (antes
  `camareiras/`); Server Actions em `src/lib/actions/users.ts` (antes
  `camareiras.ts`) — `createUser`/`updateUser`/`resetUserPassword`/
  `deleteUser`, todas aceitam `role: "camareira" | "manutencao"`.
- **Ocorrências de manutenção com ciclo de vida** (pendente → selecionada →
  resolvida): `src/lib/actions/occurrences.ts`
  (`getManutencaoOccurrences`/`selectOccurrence`/`resolveOccurrence`), tela
  `src/app/manutencao/ocorrencias/`; admin vê status/horários em
  `/ocorrencias`, coluna "Resolvidas" em `/ocorrencias/historico` e
  "Ocorrências resolvidas" em `/historico` geral.
- **Manutenção Preventiva**: tabelas `maintenance_categories`/
  `maintenance_items`/`maintenance_completions`; Server Actions em
  `src/lib/actions/maintenance.ts`; labels/periodicidade em
  `src/lib/maintenance.ts`. Cada item guarda seu ciclo atual
  (`next_due_date`/`status`/`selected_by`) e, ao ser concluído, grava uma
  linha em `maintenance_completions` (histórico) e agenda a próxima data —
  não existe tabela de agendamentos pré-gerados. CRUD do admin: aba
  "Manutenção Preventiva" em `src/app/(admin)/checklists/
  maintenance-preventiva-panel.tsx`. Tela do funcionário
  (`src/app/manutencao/preventiva/`): cards por **categoria + semana**
  (semana corrente no topo, semanas atrasadas ainda não resolvidas abaixo),
  link para checklist em `[categoryId]/[weekStart]/` com as duas seções
  (não técnico marcável / técnico externo com nome + conclusão), e tabela
  somente-leitura "Próximas quatro semanas". Dashboard do admin
  (`src/app/(admin)/manutencao-preventiva/`): tabela única "Pendentes,
  selecionadas e concluídas, esta semana" + "Planejamento semanal"
  (filtrável, com link por semana para `semana/[weekStart]/`).
  Componentes compartilhados: `src/components/shared/week-maintenance-table.tsx`
  e `src/components/shared/weekly-planning-table.tsx`.
- Item de menu do admin "Checklists & ocorrências manutenção" renomeado
  para **"Listas"**.
- **As migrations já estão aplicadas no banco** — `008_funcionario_manutencao.sql`,
  `009_fix_manutencao_occurrence_rpc.sql`, `010_manutencao_preventiva.sql`
  e `011_manutencao_preventiva_por_semana.sql`, além de
  `012_toggle_check_rpc.sql`, `013_reorder_items.sql` e
  `014_maintenance_start_dates.sql` da Parte 03 (seção 10) — todas rodadas
  manualmente no SQL Editor. **Nota (atualizada na Parte 08, seção 15)**:
  isso valia porque, até 15/09/2026, este projeto usava **um único
  projeto Supabase** para local e produção (mesma `NEXT_PUBLIC_SUPABASE_URL`/
  chaves em Development, Preview e Production na Vercel). Migrations
  rodadas manualmente no SQL Editor da nuvem continuam sendo o processo
  para **produção** (Development/Preview/Production na Vercel continuam
  compartilhando o projeto Supabase da nuvem entre si — isso não mudou).
  O que mudou foi só o **dev local fora da Vercel** (`npm run dev` na
  máquina do proprietário): passou a rodar contra um Supabase isolado via
  Docker (ver Parte 08 e `README.md` seção 4), não mais contra o banco de
  produção — então uma migration nova agora precisa ser aplicada nos dois
  lugares: no SQL Editor da nuvem (produção) e manualmente no Postgres
  local (`docker exec ... psql ... -f - < supabase/migrations/0NN_*.sql`),
  se quiser testá-la localmente antes.

### Lição de arquitetura (a mais importante desta parte)

Um bug real apareceu em teste (não em `npm run build`/`lint`): uma policy
de RLS de UPDATE cobrindo duas transições de estado ao mesmo tempo
(selecionar + resolver) falhava no `with check` do Postgres ao tentar
resolver uma ocorrência já selecionada. A correção — e o padrão adotado daí
em diante para toda transição de estado sensível — foi usar funções SQL
`security definer` com checagem explícita de papel (`select_occurrence`/
`resolve_occurrence` para ocorrências;
`claim_maintenance_category`/`complete_maintenance_nao_tecnico`/
`complete_maintenance_tecnico` para manutenção preventiva), o mesmo padrão
já usado por `is_admin()`/`is_manutencao()`. Ver detalhe completo em
`PRD_Camareiras_parte02.md` seção 4.1, e a regra geral já incorporada em
"Convenções e decisões importantes" acima — **vale para qualquer parte
futura do projeto, não só esta**.

### Regras específicas desta parte 02 (histórico — válidas durante o desenvolvimento pré-merge)

- Não mudar nada fora do escopo de manutenção sem pedir autorização antes
  ao proprietário (instrução explícita dele em `PRD_Camareiras_parte02.md`
  seção 2.3) — restrição que valeu até o merge/deploy (já concluídos); não
  se aplica mais às iterações normais pós-merge (ex.: Parte 03, seção 10).
- Identidade visual mantida igual à parte 1 — nenhuma paleta, tema ou
  componente visual novo foi introduzido.

## Skills e agents instalados a usar neste projeto

Instalados globalmente em `~/.claude/skills` e `~/.claude/agents` (via
`claude-code-templates`), disponíveis em qualquer sessão. Neste projeto,
aplicar proativamente:

- **Skill `supabase-postgres-best-practices`**: consultar ao criar/alterar
  tabelas, índices, políticas de RLS ou queries em `supabase/schema.sql`,
  `supabase/migrations/*.sql` e nas Server Actions de `src/lib/actions/`.
- **Skill `security-audit`**: rodar antes de qualquer deploy/push relevante,
  além da checagem manual já feita (chave `SUPABASE_SERVICE_ROLE_KEY`
  isolada, RLS ativa etc.).
- **Skill `frontend-design`**: consultar ao criar/redesenhar telas ou
  componentes visuais em `src/app/` e `src/components/`.
- **Agent `code-reviewer`**: acionar para revisão de mudanças antes de
  commit/push em funcionalidades sensíveis (Server Actions, RLS, auth).
- **Agent `code-explorer`**: acionar para mapear como uma funcionalidade
  existente funciona antes de alterá-la, em vez de vasculhar o código
  manualmente.

As skills `stripe-integration` e `micro-saas-launcher` também foram
instaladas globalmente mas não se aplicam ao escopo atual deste projeto
(não há pagamentos nem modelo de negócio SaaS aqui); ficam disponíveis caso
o escopo mude no futuro.

## Onde encontrar cada coisa

- `PRD_Camareiras_parte01.md` — requisitos completos + changelog detalhado
  da parte 1 (já implementada).
- `PRD_Camareiras_parte02.md` — requisitos completos do módulo de
  Manutenção (parte 2, implementada e testada, ver seção acima) +
  changelog de decisões/desvios (seção 4).
- `PRD_regrasdenegocio.md` — regras de negócio da integração com a API da
  Stays (**ainda não implementada** — fase em levantamento de requisitos
  no momento em que este arquivo foi criado): regra de preferência
  admin-vs-sincronização, regras de Arrumação/Troca por duração da
  reserva, Saída com Chegada/Somente Saída/Somente Chegada, Chegadas &
  Saídas e a regra de preenchimento das mesas do café por proximidade da
  vista do mar. Ler antes de começar a implementar essa integração.
- `README.md` — setup local (Docker/Supabase local desde a Parte 08, seção
  15), deploy na Vercel, variáveis de ambiente.
- `supabase/schema.sql` / `supabase/seed.sql` — schema e dados iniciais.
- `supabase/migrations/` — alterações incrementais do banco, em ordem
  (aplicadas manualmente na nuvem; começam em `002`, não existe `001`).
- `supabase/config.toml` — config do Supabase CLI para o banco local
  (Parte 08); `[db.migrations]`/`[db.seed]` ficam desabilitados de
  propósito, ver nota na Parte 08 (seção 15).
- `src/app/(admin)/` — telas do proprietário/admin.
- `src/app/(admin)/checklists/` — submenu "Listas" (ver Parte 03, seção 10):
  `page.tsx` é o menu vertical; `[type]/` (arrumação/troca/preparação),
  `ocorrencias/`, `manutencao-preventiva/`, `quartos/`, `frigobar/`,
  `poolbar/` e `mesas/` (só a aba "Layout & mesas") são as subtelas, cada
  uma com `<BackLink>`.
- `src/app/(admin)/mesas/gerenciar/` — tela "Mesas do café" do menu
  principal (hóspedes de hoje/amanhã + comissão + alocação de suítes por
  mesa, `TableRoomAssignments` dentro de `guests-admin-panel.tsx`, Parte
  12); **não** inclui mais o layout arrastável, que é
  `src/app/(admin)/checklists/mesas/`.
- `src/components/shared/table-layout-canvas.tsx` — desenha o layout de
  mesas (formato, posição); único componente usado tanto pelo editor do
  admin quanto pela visão da camareira, e também pela visão só-leitura de
  `mesas/gerenciar`. Desde a Parte 12 também mostra as suítes alocadas em
  cada mesa (prop `tableRooms`) e escurece mesas vagas em relação às
  ocupadas.
- `src/app/(admin)/frigobar/` — tela "Consumo de Bar e Frigobar" do menu
  principal, **só leitura desde a Parte 05** (seção 12): duas abas, "Lista
  de comandas do bar" (`comandas-list-panel.tsx`) e "Consumo por quartos"
  (`frigobar-rooms-panel.tsx`, acordeão por quarto, sem ações).
- `src/app/(camareira)/comanda/` — tela "Comanda" da camareira (ver Parte
  05): lista de comandas ativas (`page.tsx` + `comandas-list.tsx`) e o
  formulário de pedido, compartilhado entre criar e editar
  (`comanda-form.tsx`, usado por `novo/page.tsx` e `[id]/editar/page.tsx`).
- `src/app/(camareira)/bar-piscina/` — tela "Consumo por quartos" da
  camareira (renomeada na Parte 05; era "Consumo de Bar da Piscina" na
  Parte 04): acordeão por quarto com os totais de frigobar (editável) e bar
  da piscina (só leitura, vem das comandas) e as ações de
  fechar/reabrir/pagar conta, que passaram do admin para a camareira nesta
  mesma parte.
- `src/app/(camareira)/` — telas da camareira.
- `src/app/manutencao/` — telas do funcionário de manutenção (pasta real,
  não route-group — ver "Parte 02 do projeto").
- `src/lib/actions/minibar.ts` / `poolbar.ts` / `room-bills.ts` — Server
  Actions do frigobar, dos relatórios de bar da piscina e do ciclo de conta
  por quarto (fechar/reabrir/pagar, agora via RPC `security definer`
  checando `is_camareira()` — ver Parte 05 — + a consulta combinada usada
  em `/frigobar` e `/bar-piscina`).
- `src/lib/actions/comandas.ts` — Server Actions das comandas de bar da
  piscina (Parte 05): `submitComanda`/`editComanda`/`cancelComanda` (via
  RPC `security definer`) e as consultas de leitura `getActiveComandas`
  (lista, com itens já embutidos), `getComandaForEdit`,
  `getRoomsForComandaSelector`.
- `src/lib/room-bills.ts` — helper `getOrCreateCurrentBill` (não é Server
  Action; recebe o client Supabase como parâmetro), usado pelos arquivos de
  actions acima.
- `src/components/ui/accordion.tsx` — wrapper de `@base-ui/react/accordion`
  (ver Parte 04), usado nas telas de bar/frigobar.
- `src/components/shared/comanda-detail-dialog.tsx` — modal de
  visualização dos itens de uma comanda (Parte 05), reaproveitado pela
  tela da camareira e pela aba "Lista de comandas do bar" do admin.
- `src/components/shared/quantity-stepper.tsx` — seletor de quantidade
  +/- (Parte 05, extraído como componente compartilhado na Parte 08):
  usado na comanda de bar e em todo lançamento de frigobar pela camareira
  (`checklist-detail.tsx` e `consumo-quartos-panel.tsx`).
- `src/components/shared/checklist-detail.tsx` — o checklist de uma tarefa
  (arrumação/troca/saída-chegada/somente saída/somente chegada), com
  frigobar, ocorrências e observações; movido pra cá na Parte 10 (antes
  vivia só dentro de `(camareira)/tarefas/[taskId]/`) porque passou a ser
  usado também pela visão somente-leitura do admin em
  `(admin)/dashboard/tarefas/[taskId]/` — o mesmo componente já é
  automaticamente somente-leitura quando `task.status === 'concluido'`,
  e a prop `minibar` é opcional (a visão do admin não passa essa prop, de
  propósito — ver Parte 10).
- `src/lib/receipt-pdf.tsx` — gera o PDF do recibo de uma conta paga sob
  demanda, sem persistir arquivo (Parte 06), usado tanto pelo e-mail
  automático quanto pela rota `/api/room-bills/[billId]/receipt` ("Ver
  PDF" do admin).
- `src/app/(camareira)/bar-piscina/pix/[roomId]/` — tela de pagamento por
  PIX da camareira (Parte 06): QR code estático (`public/pix-qrcode.png`)
  + valor total da conta.
- `src/lib/actions/` — Server Actions (toda escrita no banco).
- `src/lib/stays/` — integração com a API da Stays (Parte 11 + Parte 13):
  `client.ts` (busca de reservas + `getStaysClientName` pro nome do
  hóspede), `troca-schedule.ts` (fórmula de troca por noites),
  `derive-planning.ts` (deriva o tipo de trabalho de um quarto/dia a
  partir das reservas, e exporta `daysBetween`) e `derive-breakfast.ts`
  (algoritmo de distribuição suíte→mesa por proximidade da vista do mar,
  Parte 13) — todos puros/testáveis isolados, sem Server Action neles.
  `src/lib/actions/stays-sync.ts` é quem efetivamente grava no banco:
  `syncStaysPlanning` (Planejamento Diário), `syncStaysArrivalsDepartures`
  (Chegadas & Saídas) e `syncStaysBreakfastTables` (Mesas do Café), todas
  via cliente admin/service-role — cada uma com seu próprio botão
  "Sincronizar com a Stays" na tela correspondente.
- `src/lib/task-type.ts` — rótulos centralizados dos tipos de trabalho
  (Arrumação/Preparação Chegada/Troca) — mudar aqui reflete em todo o app.
- `src/components/shared/back-link.tsx` — link "← Voltar" reutilizável,
  usado nas subtelas de "Listas" e no detalhe de tarefa da camareira.
