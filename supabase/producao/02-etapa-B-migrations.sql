-- ETAPA B (rodar DEPOIS da etapa A, no SQL Editor do Supabase de PRODUÇÃO)
-- Migrations 054 a 082 (menos os dois enums da etapa A), na ordem, dentro de UMA
-- transação: se qualquer comando falhar, NADA é aplicado e o banco continua
-- como estava. Gerado automaticamente a partir de supabase/migrations/.

begin;

-- ===================== 054_compras_estoque.sql =====================
-- ============================================================================
-- Módulo de Compras, Despesas e Controle de Estoque (PRD_compras.md)
-- ============================================================================
-- Resumo do modelo (ver PRD_compras.md pro raciocínio completo):
-- - "Despesa" (expenses/expense_items) é o registro de TUDO que a pousada
--   gasta, com ou sem relação a estoque.
-- - "Estoque" (inventory_items/inventory_movements) é só a fatia das
--   despesas que corresponde a itens consumíveis — e o saldo de cada item
--   nunca é um número guardado à parte: é sempre a soma de todos os
--   movimentos dele (mesmo princípio de "nunca sincronizar o que pode ser
--   calculado na hora" já estabelecido neste projeto nas Partes 16/17).
-- - Papéis: camareira só dá baixa de estoque; funcionário de manutenção dá
--   baixa e também registra compras; admin faz tudo, incluindo cadastro de
--   categorias/itens e contagem física periódica.

-- ---------- ENUMS ----------
create type inventory_movement_type as enum (
  'compra',               -- entrada por compra (gerada automaticamente ao lançar uma despesa com item de estoque)
  'baixa_manual',         -- saída registrada manualmente por quem usou o item
  'baixa_consumo_hospede',-- saída automática ao pagar uma conta de frigobar/bar (ver trigger mais abaixo)
  'ajuste_contagem'       -- correção gerada ao fechar uma contagem física (ver close_inventory_count_session)
);

create type inventory_count_status as enum ('em_andamento', 'concluida');

-- ---------- EXPENSE CATEGORIES (categorias de despesa) ----------
-- is_inventory_category: só categorias marcadas assim podem ter itens de
-- estoque vinculados (ex.: "Limpeza" sim, "Impostos e taxas" não).
create table expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_inventory_category boolean not null default false,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- INVENTORY ITEMS (catálogo de itens controláveis em estoque) ----------
-- unit: texto livre (un, kg, L, pacote, caixa...). barcode: opcional,
-- preenchido na primeira leitura por câmera. reorder_point: abaixo desse
-- saldo, o item entra na lista de "precisa comprar" (Resumo Executivo).
-- linked_minibar_item_id/linked_poolbar_item_id: ligação OPCIONAL com os
-- catálogos já existentes de frigobar/bar da piscina — é o que habilita a
-- baixa automática por consumo de hóspede (ver trigger mais abaixo). Só
-- um dos dois pode estar preenchido por vez (nunca os dois).
create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid not null references expense_categories(id),
  unit text not null default 'un',
  barcode text unique,
  reorder_point numeric(12,3) not null default 0,
  linked_minibar_item_id uuid references minibar_items(id) on delete set null,
  linked_poolbar_item_id uuid references poolbar_items(id) on delete set null,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (linked_minibar_item_id is null or linked_poolbar_item_id is null)
);

-- ---------- EXPENSES (despesas/compras — cabeçalho) ----------
-- supplier_name: texto livre (sem cadastro de fornecedor separado — não
-- foi pedido, e manter simples evita mais uma tela de CRUD). payment_method
-- é sempre informado (lido pela IA ou escolhido manualmente quando a
-- leitura falhar — nunca fica em branco, mas é anulável no banco porque
-- registros de teste/edição futura podem precisar disso). receipt_storage_path:
-- caminho no bucket privado "expense-receipts" (ver mais abaixo), nullable
-- (nem toda despesa tem uma foto — ex.: um lançamento manual sem recibo).
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  category_id uuid not null references expense_categories(id),
  supplier_name text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_method payment_method,
  receipt_storage_path text,
  nfce_url text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- EXPENSE ITEMS (linhas de uma despesa) ----------
-- Nem toda despesa tem linhas detalhadas (ex.: IPTU, salário, honorário —
-- um valor só, sem itens) — expense_items é opcional, usado principalmente
-- quando a despesa corresponde a uma compra com itens de estoque, ou
-- quando o usuário quer detalhar mesmo sem vínculo de estoque.
create table expense_items (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid not null references expenses(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  created_at timestamptz not null default now()
);

-- ---------- INVENTORY COUNT SESSIONS (contagem física periódica) ----------
create table inventory_count_sessions (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references expense_categories(id) on delete set null,
  status inventory_count_status not null default 'em_andamento',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ---------- INVENTORY COUNT LINES (uma linha por item contado) ----------
-- theoretical_qty: o saldo calculado no momento em que a sessão foi
-- aberta (retrato, não recalculado depois — pra a variância fazer
-- sentido mesmo que outros movimentos aconteçam durante a contagem).
create table inventory_count_lines (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references inventory_count_sessions(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  theoretical_qty numeric(12,3) not null,
  counted_qty numeric(12,3),
  created_at timestamptz not null default now(),
  unique (session_id, inventory_item_id)
);

-- ---------- INVENTORY MOVEMENTS (todo evento que muda o saldo — nunca apagado) ----------
-- quantity: positivo = entrada, negativo = saída. O saldo de um item é
-- sempre SUM(quantity) — ver view inventory_balances mais abaixo.
create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type inventory_movement_type not null,
  quantity numeric(12,3) not null,
  reference_expense_item_id uuid references expense_items(id) on delete cascade,
  reference_room_bill_id uuid references room_bills(id) on delete set null,
  reference_count_line_id uuid references inventory_count_lines(id) on delete set null,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Saldo calculado na hora, nunca persistido (ver comentário da tabela
-- inventory_movements acima). security_invoker garante que a RLS de
-- inventory_movements continue valendo pra quem consulta esta view,
-- em vez de rodar com o privilégio de quem criou a view (recomendação
-- oficial do Supabase pra views sobre tabelas com RLS).
create view inventory_balances
with (security_invoker = true) as
select inventory_item_id, coalesce(sum(quantity), 0) as balance
from inventory_movements
group by inventory_item_id;

-- ---------- RLS ----------
alter table expense_categories enable row level security;
alter table inventory_items enable row level security;
alter table expenses enable row level security;
alter table expense_items enable row level security;
alter table inventory_count_sessions enable row level security;
alter table inventory_count_lines enable row level security;
alter table inventory_movements enable row level security;

-- expense_categories: qualquer autenticado lê; só admin escreve.
create policy "exp_cat_select_authenticated" on expense_categories for select using (auth.uid() is not null);
create policy "exp_cat_admin_insert" on expense_categories for insert with check (is_admin());
create policy "exp_cat_admin_update" on expense_categories for update using (is_admin());
create policy "exp_cat_admin_delete" on expense_categories for delete using (is_admin());

-- inventory_items: qualquer autenticado lê (camareira precisa pra dar
-- baixa); admin ou manutenção podem cadastrar item novo (camareira nunca
-- cria item, só usa o catálogo já existente); só admin edita/apaga.
create policy "inv_items_select_authenticated" on inventory_items for select using (auth.uid() is not null);
create policy "inv_items_insert_admin_manutencao" on inventory_items for insert
  with check (is_admin() or is_manutencao());
create policy "inv_items_admin_update" on inventory_items for update using (is_admin());
create policy "inv_items_admin_delete" on inventory_items for delete using (is_admin());

-- expenses/expense_items: camareira NUNCA tem acesso (ela não lança
-- compra nenhuma) — só admin e manutenção, que podem ver/lançar qualquer
-- despesa (não só as próprias, mesmo padrão já usado pra comandas/
-- ocorrências entre colegas do mesmo papel). Edição/exclusão só admin —
-- uma despesa confirmada vira histórico, igual a outros valores já
-- congelados no projeto.
create policy "expenses_select_admin_manutencao" on expenses for select
  using (is_admin() or is_manutencao());
create policy "expenses_insert_admin_manutencao" on expenses for insert
  with check (is_admin() or is_manutencao());
create policy "expenses_admin_update" on expenses for update using (is_admin());
create policy "expenses_admin_delete" on expenses for delete using (is_admin());

create policy "exp_items_select_admin_manutencao" on expense_items for select
  using (is_admin() or is_manutencao());
create policy "exp_items_insert_admin_manutencao" on expense_items for insert
  with check (is_admin() or is_manutencao());
create policy "exp_items_admin_delete" on expense_items for delete using (is_admin());

-- inventory_count_sessions/lines: contagem física é tarefa do admin.
create policy "count_sessions_admin_all" on inventory_count_sessions for all
  using (is_admin()) with check (is_admin());
create policy "count_lines_admin_all" on inventory_count_lines for all
  using (is_admin()) with check (is_admin());

-- inventory_movements: qualquer autenticado lê (não guarda custo, só
-- quantidade — nada sensível em expor); inserção direta só é permitida
-- pra baixa manual, feita por quem está logado (qualquer papel). Os
-- outros 3 tipos (compra/baixa_consumo_hospede/ajuste_contagem) só
-- nascem através das funções/triggers `security definer` abaixo, que
-- rodam com privilégio elevado e por isso nunca passam por esta policy —
-- não precisam de policy de insert própria.
create policy "inv_mov_select_authenticated" on inventory_movements for select using (auth.uid() is not null);
create policy "inv_mov_insert_baixa_manual" on inventory_movements for insert
  with check (
    movement_type = 'baixa_manual'
    and created_by = auth.uid()
    and (is_camareira() or is_manutencao() or is_admin())
  );
create policy "inv_mov_admin_all" on inventory_movements for all using (is_admin()) with check (is_admin());

-- ---------- TRIGGER: entrada de estoque automática ao lançar um item de compra ----------
-- Dispensa a Server Action de se lembrar de fazer dois inserts separados
-- (despesa + movimento) — mesmo espírito do histórico de mudanças via
-- trigger da Parte 44 (elimina de vez o risco de esquecer o ponto de
-- escrita). security definer porque expense_items é inserida por
-- manutenção/admin via RLS normal, mas o INSERT em inventory_movements
-- de tipo 'compra' não tem (de propósito) nenhuma policy pra esses
-- papéis — só esta função pode criá-lo.
create or replace function create_movement_from_expense_item() returns trigger as $$
begin
  if new.inventory_item_id is not null then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
    values (
      new.inventory_item_id,
      'compra',
      new.quantity,
      new.id,
      (select created_by from expenses where id = new.expense_id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger expense_items_create_movement
after insert on expense_items
for each row execute function create_movement_from_expense_item();

-- ---------- TRIGGER: baixa automática de estoque ao pagar uma conta de frigobar/bar ----------
-- Dispara só na transição pra 'paga' (nunca de novo, mesmo que a linha
-- seja atualizada depois por outro motivo, ex.: receipt_email_sent).
-- Só gera movimento pros itens de frigobar/bar que o admin tiver
-- explicitamente ligado a um item de estoque (linked_minibar_item_id/
-- linked_poolbar_item_id) — ver PRD_compras.md seção 5.4 pro porquê de
-- ser opt-in por item, não automático pra tudo. Comandas canceladas
-- nunca entram (igual ao resto do app).
create or replace function deduct_inventory_on_bill_payment() returns trigger as $$
begin
  if new.status = 'paga' and (old.status is null or old.status is distinct from 'paga') then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select ii.id, 'baixa_consumo_hospede', -mbi.quantity, new.id, 'Baixa automática ao pagar a conta (frigobar)'
    from room_bill_minibar_items mbi
    join inventory_items ii on ii.linked_minibar_item_id = mbi.minibar_item_id
    where mbi.bill_id = new.id and mbi.quantity > 0;

    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select ii.id, 'baixa_consumo_hospede', -sum(bci.quantity), new.id, 'Baixa automática ao pagar a conta (bar da piscina)'
    from bar_comanda_items bci
    join bar_comandas bc on bc.id = bci.comanda_id
    join inventory_items ii on ii.linked_poolbar_item_id = bci.poolbar_item_id
    where bc.bill_id = new.id and bc.status <> 'cancelada' and bci.quantity > 0
    group by ii.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger room_bills_deduct_inventory
after update on room_bills
for each row execute function deduct_inventory_on_bill_payment();

-- ---------- FUNÇÃO: fechar uma contagem física (security definer, admin) ----------
-- Pra cada linha contada (counted_qty preenchido), grava um movimento de
-- ajuste só quando há diferença de verdade (variância = 0 não precisa de
-- movimento nenhum, evita poluir o histórico à toa). Marca a sessão como
-- concluída. Linhas sem contagem preenchida são ignoradas (item não
-- conferido nesta rodada, fica como estava).
create or replace function close_inventory_count_session(p_session_id uuid) returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;

  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_count_line_id, created_by, notes)
  select
    l.inventory_item_id,
    'ajuste_contagem',
    l.counted_qty - l.theoretical_qty,
    l.id,
    auth.uid(),
    'Ajuste de contagem física'
  from inventory_count_lines l
  where l.session_id = p_session_id
    and l.counted_qty is not null
    and l.counted_qty <> l.theoretical_qty;

  update inventory_count_sessions
  set status = 'concluida', closed_at = now()
  where id = p_session_id and status = 'em_andamento';
end;
$$ language plpgsql security definer;

-- ---------- STORAGE (fotos de recibo/nota) ----------
-- Mesmo padrão da Parte 48 (fotos de ocorrência): bucket privado, upload e
-- leitura sempre via client admin/service-role dentro de Server Actions,
-- leitura por URL assinada gerada na hora — nenhuma policy de
-- storage.objects é necessária.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------- SEED: categorias de despesa (ver PRD_compras.md seção 4) ----------
insert into expense_categories (name, is_inventory_category, position) values
  ('Limpeza', true, 1),
  ('Café da manhã', true, 2),
  ('Bar da piscina', true, 3),
  ('Enxoval (cama/banho/mesa)', true, 4),
  ('Piscina', true, 5),
  ('Jardim', true, 6),
  ('Manutenção (elétrica/hidráulica/outros)', true, 7),
  ('Ativos permanentes', false, 8),
  ('Consumo (luz/água/internet)', false, 9),
  ('Pessoal (salários/encargos)', false, 10),
  ('Serviços profissionais', false, 11),
  ('Impostos e taxas', false, 12),
  ('Outras', false, 13)
on conflict (name) do nothing;

-- ===================== 055_turnover_groups_recipes_purchase_requests.sql =====================
-- Grupos de giro (ciclo de reposição por categoria de controle fino),
-- ficha técnica (ingrediente(s) por produto do cardápio, substituindo o
-- vínculo simples 1-pra-1 que nunca chegou a produção) e pedidos de
-- compra visuais da camareira/manutenção — ver PRD_compras.md pra
-- decisões completas desta leva.

-- ---------- GRUPOS DE GIRO ----------
-- coverage_days: "dias de folga" daquele grupo — editável pelo admin a
-- qualquer momento. Usado pra calcular o ponto de reposição automático
-- (giro médio semanal × dias de folga ÷ 7).
create table inventory_turnover_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  coverage_days int not null check (coverage_days > 0),
  created_at timestamptz not null default now()
);

alter table inventory_turnover_groups enable row level security;
create policy "inv_turnover_groups_select_authenticated" on inventory_turnover_groups
  for select using (auth.uid() is not null);
create policy "inv_turnover_groups_admin_write" on inventory_turnover_groups
  for all using (is_admin()) with check (is_admin());

insert into inventory_turnover_groups (name, coverage_days) values
  ('Limpeza', 7),
  ('Bebidas não alcoólicas', 7),
  ('Alimentos (petiscos do bar da piscina)', 7),
  ('Alimentos (café da manhã)', 7),
  ('Bebidas alcoólicas', 60),
  ('Materiais de piscina', 60),
  ('Materiais de manutenção', 30);

-- ---------- NOVOS CAMPOS EM inventory_items ----------
-- turnover_group_id: opcional — de propósito, itens perecíveis (ex.:
-- frutas do café da manhã) nunca recebem grupo, então nunca têm ponto de
-- reposição calculado, só o controle visual via pedidos de compra.
-- portion_weight_kg: só pros itens controlados por "porção" (ex.:
-- macaxeira, camarão, filé mignon) — peso médio de 1 porção em kg,
-- usado só na hora de converter "porções necessárias" em "kg a comprar"
-- na lista de compras; nunca usado pra nada além disso.
alter table inventory_items
  add column turnover_group_id uuid references inventory_turnover_groups(id) on delete set null,
  add column portion_weight_kg numeric(10,4);

-- O vínculo simples 1-pra-1 (linked_minibar_item_id/linked_poolbar_item_id)
-- nunca chegou a produção — removido em favor da ficha técnica abaixo,
-- que cobre tanto o caso simples (1 ingrediente, 1 produto) quanto o caso
-- de ingrediente compartilhado por vários produtos do cardápio (ex.:
-- macaxeira usada em 3 pratos diferentes do bar da piscina).
alter table inventory_items
  drop constraint if exists inventory_items_check,
  drop column if exists linked_minibar_item_id,
  drop column if exists linked_poolbar_item_id;

-- ---------- FICHA TÉCNICA (receita): ingrediente(s) por produto do cardápio ----------
-- Um item de estoque (ingrediente) pode alimentar vários produtos do
-- cardápio (frigobar OU bar da piscina, nunca os dois na mesma linha), e
-- um produto do cardápio pode consumir vários ingredientes — por isso é
-- uma tabela de ligação (muitos-pra-muitos), não mais uma coluna solta.
-- portions_per_order: quantas porções daquele ingrediente um pedido do
-- produto consome (ex.: "filé mignon com macaxeira" pode consumir 1
-- porção de macaxeira por pedido, mas "macaxeira frita" sozinha, 2).
-- O estoque e a lista de compras sempre mostram só o ingrediente, nunca
-- de qual produto ele veio — a origem (frigobar/bar, qual prato) é
-- irrelevante pro controle de estoque, só importa pra saber quanto baixar
-- quando a conta é paga.
create table inventory_item_recipes (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  minibar_item_id uuid references minibar_items(id) on delete cascade,
  poolbar_item_id uuid references poolbar_items(id) on delete cascade,
  portions_per_order numeric(10,3) not null default 1 check (portions_per_order > 0),
  created_at timestamptz not null default now(),
  check (
    (minibar_item_id is not null and poolbar_item_id is null) or
    (minibar_item_id is null and poolbar_item_id is not null)
  )
);
create unique index inv_item_recipes_minibar_uq on inventory_item_recipes (inventory_item_id, minibar_item_id)
  where minibar_item_id is not null;
create unique index inv_item_recipes_poolbar_uq on inventory_item_recipes (inventory_item_id, poolbar_item_id)
  where poolbar_item_id is not null;

alter table inventory_item_recipes enable row level security;
create policy "inv_recipes_select_authenticated" on inventory_item_recipes
  for select using (auth.uid() is not null);
create policy "inv_recipes_admin_write" on inventory_item_recipes
  for all using (is_admin()) with check (is_admin());

-- ---------- PEDIDOS DE COMPRA (sinal visual da camareira/manutenção) ----------
-- Cada pedido é uma linha própria, nunca mesclada com outra — se a mesma
-- pessoa (ou outra) pedir de novo o mesmo item, nasce um pedido novo, e
-- os pendentes se somam na visão do admin (ver getAggregatedPurchaseRequests).
-- Quem pediu pode editar ou cancelar só o próprio pedido, enquanto
-- 'pendente'; o admin só cancela "o total" de um item (todas as linhas
-- pendentes de uma vez, de qualquer pessoa) via função própria abaixo.
create type purchase_request_status as enum ('pendente', 'atendido', 'cancelado');

create table purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  requested_qty numeric(12,3) not null check (requested_qty > 0),
  notes text,
  status purchase_request_status not null default 'pendente',
  requested_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_requests enable row level security;
create policy "purchase_req_select_own_or_admin" on purchase_requests
  for select using (requested_by = auth.uid() or is_admin());
create policy "purchase_req_insert_own" on purchase_requests
  for insert with check (
    requested_by = auth.uid() and (is_camareira() or is_manutencao() or is_admin())
  );
create policy "purchase_req_update_own_pending" on purchase_requests
  for update using (requested_by = auth.uid() and status = 'pendente')
  with check (requested_by = auth.uid());

-- Cancelamento em massa pelo admin (precisa de security definer porque
-- mexe em linhas de outras pessoas, fora do alcance da policy de update
-- "própria e pendente" acima).
create or replace function cancel_purchase_requests_for_item(p_inventory_item_id uuid) returns void as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update purchase_requests
  set status = 'cancelado', updated_at = now()
  where inventory_item_id = p_inventory_item_id and status = 'pendente';
end;
$$ language plpgsql security definer;

-- ---------- VIEWS: giro semanal e sugestão de compra calculada ----------
-- Giro = consumo real (baixa manual + baixa automática de consumo de
-- hóspede — nunca compra nem ajuste de contagem) dos últimos 60 dias,
-- convertido pra "por semana" só pra ficar mais legível (o cálculo em si
-- continua em cima de dias, não muda nada na precisão).
create view inventory_weekly_turnover
with (security_invoker = true) as
select inventory_item_id,
  (coalesce(sum(-quantity), 0) / 60.0) * 7 as weekly_consumption
from inventory_movements
where movement_type in ('baixa_manual', 'baixa_consumo_hospede')
  and created_at >= now() - interval '60 days'
group by inventory_item_id;

-- Ponto de reposição calculado = giro semanal ÷ 7 × dias de folga do
-- grupo do item — só existe quando o item tem um grupo de giro (itens
-- sem grupo, como frutas perecíveis, ficam com calculated_reorder_point
-- nulo de propósito, nunca 0 — "sem dado" é diferente de "zero", mesma
-- distinção já usada noutras partes do app pra não confundir "não
-- calculado ainda" com "calculado e deu zero").
create view inventory_purchase_suggestions
with (security_invoker = true) as
select
  ii.id as inventory_item_id,
  coalesce(ib.balance, 0) as balance,
  coalesce(wt.weekly_consumption, 0) as weekly_consumption,
  tg.coverage_days,
  case when tg.coverage_days is not null
    then (coalesce(wt.weekly_consumption, 0) / 7.0) * tg.coverage_days
    else null
  end as calculated_reorder_point,
  ii.reorder_point as manual_reorder_point,
  ii.portion_weight_kg
from inventory_items ii
left join inventory_balances ib on ib.inventory_item_id = ii.id
left join inventory_weekly_turnover wt on wt.inventory_item_id = ii.id
left join inventory_turnover_groups tg on tg.id = ii.turnover_group_id
where ii.active;

-- ---------- TRIGGER: compra resolve pedido de compra, além da entrada de estoque ----------
-- Qualquer compra do item resolve TODOS os pedidos pendentes dele,
-- independentemente da quantidade comprada ter sido suficiente ou não —
-- o pedido da equipe é só um sinal visual ("sugestão"), não uma meta a
-- bater. Quem continua refletindo uma compra insuficiente é a sugestão
-- CALCULADA pelo sistema, que é sempre (ponto calculado − saldo atual):
-- como o saldo já sobe com a compra, uma compra insuficiente já aparece
-- sozinha como uma sugestão menor na próxima consulta, sem precisar de
-- nenhum ajuste extra aqui — decorrência direta de nunca persistir esse
-- valor (ver view acima).
create or replace function create_movement_from_expense_item() returns trigger as $$
begin
  if new.inventory_item_id is not null then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
    values (
      new.inventory_item_id,
      'compra',
      new.quantity,
      new.id,
      (select created_by from expenses where id = new.expense_id)
    );

    update purchase_requests
    set status = 'atendido', updated_at = now()
    where inventory_item_id = new.inventory_item_id and status = 'pendente';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ---------- TRIGGER: baixa automática via ficha técnica (substitui o vínculo 1-pra-1) ----------
-- Mesmo gatilho de antes (dispara só na transição pra 'paga'), reescrito
-- pra somar por TODOS os produtos do cardápio ligados àquele ingrediente
-- via inventory_item_recipes, multiplicando pela quantidade consumida e
-- por portions_per_order — é o que permite macaxeira (ou qualquer
-- ingrediente) ser compartilhada entre vários pratos sem duplicar
-- cadastro nem decisão de "é do frigobar ou do bar".
create or replace function deduct_inventory_on_bill_payment() returns trigger as $$
begin
  if new.status = 'paga' and (old.status is null or old.status is distinct from 'paga') then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(mbi.quantity * r.portions_per_order), new.id,
      'Baixa automática ao pagar a conta (frigobar)'
    from room_bill_minibar_items mbi
    join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
    where mbi.bill_id = new.id and mbi.quantity > 0;

    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -sum(bci.quantity * r.portions_per_order), new.id,
      'Baixa automática ao pagar a conta (bar da piscina)'
    from bar_comanda_items bci
    join bar_comandas bc on bc.id = bci.comanda_id
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bc.bill_id = new.id and bc.status <> 'cancelada' and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ===================== 056_dismiss_calculated_suggestion.sql =====================
-- Permite ao admin dispensar a sugestão CALCULADA pelo sistema (não só o
-- pedido visual da equipe, que já podia ser cancelado desde a migration
-- 055) — pedido que tinha ficado de fora da primeira leva.
--
-- Como a sugestão calculada nunca é um valor persistido (é sempre
-- recalculada na hora a partir do saldo — ver inventory_purchase_suggestions),
-- "dispensar" não pode ser um apagar permanente: guardamos o saldo no
-- momento da dispensa, e ela só vale enquanto o saldo não mudar de novo.
-- Assim que qualquer movimento altera o saldo do item (nova compra, novo
-- consumo), a dispensa fica automaticamente obsoleta e a sugestão volta a
-- aparecer — sem precisar de nenhum job de limpeza, só uma comparação na
-- hora de ler (ver getPurchaseList).
create table inventory_suggestion_dismissals (
  inventory_item_id uuid primary key references inventory_items(id) on delete cascade,
  dismissed_balance numeric(12,3) not null,
  dismissed_by uuid references profiles(id) on delete set null,
  dismissed_at timestamptz not null default now()
);

alter table inventory_suggestion_dismissals enable row level security;
create policy "inv_suggestion_dismissals_admin_all" on inventory_suggestion_dismissals
  for all using (is_admin()) with check (is_admin());

-- ===================== 057_count_frequency_reminder.sql =====================
-- Frequência de contagem física configurável por categoria (ex.: mensal
-- pra limpeza, trimestral pra enxoval) — usada só pra calcular o aviso
-- "está na hora de contar de novo" na tela de Contagem de estoque. Null
-- (padrão) significa "sem lembrete configurado" — nunca obrigatório.
alter table expense_categories
  add column count_frequency_days integer check (count_frequency_days is null or count_frequency_days > 0);

-- ===================== 058_fixed_assets_and_pdf_receipts.sql =====================
-- Ativo permanente (categorias + itens) — tela nova e separada de
-- "itens de estoque" de propósito (um ativo permanente não tem saldo que
-- se consome, ver PRD_compras.md seção 8). Só admin tem acesso.
create table asset_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table fixed_assets (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references asset_categories(id),
  name text not null,
  brand text,
  model text,
  purchase_date date,
  purchase_value numeric(12,2),
  warranty_until date,
  supplier_name text,
  location text,
  notes text,
  active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table asset_categories enable row level security;
alter table fixed_assets enable row level security;
create policy "asset_categories_admin_all" on asset_categories for all using (is_admin()) with check (is_admin());
create policy "fixed_assets_admin_all" on fixed_assets for all using (is_admin()) with check (is_admin());

insert into asset_categories (name, position) values
  ('Televisores', 1),
  ('Ar-condicionados', 2),
  ('Frigobares e geladeiras', 3),
  ('Boilers e aquecedores', 4),
  ('Bombas (água/piscina)', 5),
  ('Camas e colchões', 6),
  ('Móveis (armários, mesas, cadeiras)', 7),
  ('Eletrodomésticos de cozinha', 8),
  ('Equipamentos de lavanderia', 9),
  ('Computadores e notebooks', 10),
  ('Veículos', 11),
  ('Ferramentas e equipamentos de manutenção', 12),
  ('Outros', 13)
on conflict (name) do nothing;

-- Nota fiscal em PDF: o bucket de recibos/notas (criado na Parte do
-- módulo de compras) só aceitava foto — agora também aceita PDF, pra
-- leitura de notas fiscais formais emitidas nesse formato. Limite de
-- tamanho também sobe de 5MB pra 10MB (PDF de nota formal pode pesar
-- mais que uma foto comprimida).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    file_size_limit = 10485760
where id = 'expense-receipts';

-- ===================== 059_inventory_count_session_unique_open.sql =====================
-- No máximo 1 sessão de contagem física "em_andamento" por categoria (e
-- no máximo 1 sessão "todos os itens" ao mesmo tempo) — trava no banco,
-- não só na Server Action, mesmo padrão já usado pra "1 conta aberta por
-- quarto" em room_bills. category_id é opcional (null = "todos os
-- itens"), então usa coalesce com um UUID sentinela só pra unificar os
-- dois casos num único índice.
create unique index inventory_count_sessions_one_open_per_category
  on inventory_count_sessions (coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'em_andamento';

-- ===================== 060_inventory_shrinkage_tracking.sql =====================
-- Rastreamento de "quebra de estoque" (variação entre saldo no sistema e
-- contagem física) por item, com média móvel de 12 meses que descarta
-- outliers — ver PRD_compras.md seção 18 pro raciocínio completo.
--
-- Modelo: cada contagem FECHADA grava, por item, três números congelados
-- no momento do fechamento (nunca recalculados depois, mesmo que os
-- limites configuráveis mudem — são fatos históricos sobre o que
-- aconteceu naquela contagem específica):
--   - quebra_pct: % de diferença (saldo sistema → contagem física),
--     com o mesmo sinal da diferença.
--   - quebra_12m_pct: média de quebra_pct das contagens fechadas do
--     mesmo item nos últimos 12 meses ANTES desta, excluindo as que
--     tiverem índice_relativo_pct maior que o limite atual do item.
--   - indice_relativo_pct: |quebra_pct ÷ quebra_12m_pct| × 100 —
--     sempre positivo, mostra o quão fora do padrão esta contagem ficou.
--
-- Os dois limites configuráveis (quanto de quebra é aceitável, e quanto
-- de desvio em relação à média é aceitável antes de virar outlier) ficam
-- no item, editáveis a qualquer momento — mudar o limite só afeta quais
-- contagens futuras tratam uma contagem antiga como outlier, nunca
-- reescreve os números já congelados.

alter table inventory_items
  add column quebra_maxima_admitida_pct numeric(6,2) not null default 20 check (quebra_maxima_admitida_pct > 0),
  add column indice_relativo_maximo_pct numeric(6,2) not null default 200 check (indice_relativo_maximo_pct > 0);

alter table inventory_count_lines
  add column quebra_pct numeric(8,2),
  add column quebra_12m_pct numeric(8,2),
  add column indice_relativo_pct numeric(8,2);

-- View de leitura: uma linha por contagem FECHADA, com o nome do item,
-- a categoria, os limites ATUAIS do item (não congelados — é intencional,
-- ver nota acima) e a data da contagem anterior do mesmo item via
-- LAG(), pra nunca precisar calcular isso em JavaScript em três lugares
-- diferentes (tela de contagem, Histórico, Resumo Executivo).
create view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  ec.name as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs.closed_at,
  lag(cs.closed_at) over (partition by cl.inventory_item_id order by cs.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs on cs.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
join expense_categories ec on ec.id = ii.category_id
where cs.status = 'concluida' and cl.counted_qty is not null;

-- ===================== 061_pratos_categorias_multiplas.sql =====================
-- Dupla natureza de consumo (autônomo + ingrediente de prato) e categoria
-- de gasto deixando de ser única por item de estoque — ver PRD_compras.md
-- seção 19 pro raciocínio completo.
--
-- Decisão de arquitetura (confirmada com o proprietário antes de
-- implementar): "prato" não é um catálogo novo e desconectado — é o
-- próprio catálogo já existente de itens vendáveis do bar da
-- piscina/frigobar (poolbar_items/minibar_items). A "Lista de pratos" é
-- só uma tela nova de gestão da ficha técnica (inventory_item_recipes) a
-- partir do prato, em vez de a partir do ingrediente — garante que pedir
-- o prato de verdade já desconta estoque, porque usa o mesmo gatilho que
-- já existe (deduct_inventory_on_bill_payment) e já funciona.

-- 1) Nova categoria "Frigobar" — faltava (só existia "Bar da piscina"),
-- mas o próprio pedido já cita "frigobar" como categoria de um item.
insert into expense_categories (name, is_inventory_category)
select 'Frigobar', true
where not exists (select 1 from expense_categories where name = 'Frigobar');

-- 2) Categoria de gasto deixa de ser 1-pra-1 e passa a ser N-pra-N por
-- item de estoque (ex.: "Coca-Cola Zero lata" pode ser Bar da piscina E
-- Frigobar ao mesmo tempo).
create table inventory_item_categories (
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  category_id uuid not null references expense_categories(id) on delete cascade,
  primary key (inventory_item_id, category_id)
);

insert into inventory_item_categories (inventory_item_id, category_id)
select id, category_id from inventory_items where category_id is not null;

-- A view de histórico de quebra de estoque (Parte 18) dependia de
-- inventory_items.category_id direto — precisa ser trocada pra usar a
-- tabela de ligação ANTES da coluna antiga ser removida (Postgres não
-- deixa derrubar uma coluna que uma view ainda lê). Com mais de uma
-- categoria, mostra todas juntas, separadas por "/".
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(ec.name, ' / ' order by ec.name)
     from inventory_item_categories iic
     join expense_categories ec on ec.id = iic.category_id
     where iic.inventory_item_id = ii.id),
    '—'
  ) as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs.closed_at,
  lag(cs.closed_at) over (partition by cl.inventory_item_id order by cs.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs on cs.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
where cs.status = 'concluida' and cl.counted_qty is not null;

alter table inventory_items drop column category_id;

alter table inventory_item_categories enable row level security;
create policy "inv_item_categories_select_authenticated" on inventory_item_categories
  for select using (auth.uid() is not null);
create policy "inv_item_categories_insert_admin_manutencao" on inventory_item_categories
  for insert with check (is_admin() or is_manutencao());
create policy "inv_item_categories_delete_admin_manutencao" on inventory_item_categories
  for delete using (is_admin() or is_manutencao());

-- 3) Ficha técnica: "portions_per_order" (um número só, ambíguo) virou
-- dois campos explícitos — quantidade de porções do prato (contagem) ×
-- quantidade do item em 1 porção (na unidade própria do item, ex.: kg,
-- L, un). O total consumido por pedido é portions_count * amount_per_portion.
alter table inventory_item_recipes
  add column portions_count numeric(10,3) not null default 1 check (portions_count > 0),
  add column amount_per_portion numeric(12,4) not null default 0 check (amount_per_portion >= 0);

-- Preserva o total já calculado de qualquer ficha técnica existente
-- (portions_count=1 * amount_per_portion=valor antigo = mesmo total de
-- antes) — nunca zera um dado que já existia, mesma regra já usada no
-- projeto pra mudança de regra de cálculo.
update inventory_item_recipes set amount_per_portion = portions_per_order, portions_count = 1;

alter table inventory_item_recipes drop column portions_per_order;

create or replace function deduct_inventory_on_bill_payment() returns trigger as $$
begin
  if new.status = 'paga' and (old.status is null or old.status is distinct from 'paga') then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(mbi.quantity * r.portions_count * r.amount_per_portion), new.id,
      'Baixa automática ao pagar a conta (frigobar)'
    from room_bill_minibar_items mbi
    join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
    where mbi.bill_id = new.id and mbi.quantity > 0;

    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -sum(bci.quantity * r.portions_count * r.amount_per_portion), new.id,
      'Baixa automática ao pagar a conta (bar da piscina)'
    from bar_comanda_items bci
    join bar_comandas bc on bc.id = bci.comanda_id
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bc.bill_id = new.id and bc.status <> 'cancelada' and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 4) "Categoria" deixa de ser um campo da compra inteira (uma compra pode
-- ter itens de categorias diferentes) e passa a existir só por item —
-- ver CLAUDE.md/PRD_compras.md pra onde essa informação passa a viver.
alter table expenses drop column category_id;

-- ===================== 062_itens_consumo_direto.sql =====================
-- Itens de estoque de "consumo autônomo" direto (ver PRD_compras.md
-- seção 19) — produtos vendidos prontos no bar da piscina/frigobar, sem
-- nenhuma composição (abrir uma lata/garrafa e servir), diferente dos
-- petiscos/drinks preparados (esses ficam sem ficha técnica por ora,
-- cadastrados na tela "Lista de pratos" sem receita até o proprietário
-- preencher as quantidades reais). A ficha técnica 1-pra-1
-- (portions_count=1, amount_per_portion=1) aqui não é um palpite — é
-- matematicamente exata por definição (1 unidade vendida = 1 unidade
-- consumida do próprio item).

do $$
declare
  v_bar_piscina uuid := (select id from expense_categories where name = 'Bar da piscina');
  v_frigobar uuid := (select id from expense_categories where name = 'Frigobar');
  v_item_id uuid;
  v_poolbar_id uuid;
  v_minibar_id uuid;
  v_name text;
begin
  foreach v_name in array array['Água com gás', 'Água sem gás', 'Água de Coco', 'Café expresso', 'Cerveja', 'Refrigerante']
  loop
    insert into inventory_items (name, unit)
    values (v_name, 'un')
    returning id into v_item_id;

    insert into inventory_item_categories (inventory_item_id, category_id) values (v_item_id, v_bar_piscina);

    select id into v_poolbar_id from poolbar_items where name = v_name;
    if v_poolbar_id is not null then
      insert into inventory_item_recipes (inventory_item_id, poolbar_item_id, portions_count, amount_per_portion)
      values (v_item_id, v_poolbar_id, 1, 1);
    end if;

    select id into v_minibar_id from minibar_items where name = v_name;
    if v_minibar_id is not null then
      insert into inventory_item_categories (inventory_item_id, category_id)
      values (v_item_id, v_frigobar)
      on conflict do nothing;
      insert into inventory_item_recipes (inventory_item_id, minibar_item_id, portions_count, amount_per_portion)
      values (v_item_id, v_minibar_id, 1, 1);
    end if;
  end loop;
end $$;

-- ===================== 063_custos_e_despesas.sql =====================
-- Módulo "Custos e Despesas" — ver PRD_compras.md seção 20 pro raciocínio
-- completo (pesquisa do setor hoteleiro, decisões confirmadas com o
-- proprietário).
--
-- Cada categoria de despesa passa a ter uma "natureza" (direta/fixa/não é
-- custo) e, quando fixa, 4 percentuais de rateio entre os centros de
-- custo (Hospedagem / Café da Manhã / Serviço de Bar / Frigobar — este
-- último só é diferente de zero pra "Luz") — tudo editável pelo admin,
-- nunca fixado no código, pra que o Demonstrativo/Custos se atualizem
-- sozinhos ao editar uma categoria.

create type cost_nature as enum ('custo_direto', 'custo_fixo', 'nao_custo');

alter table expense_categories
  add column cost_nature cost_nature not null default 'custo_fixo',
  add column alloc_hospedagem_pct int not null default 100 check (alloc_hospedagem_pct between 0 and 100),
  add column alloc_cafe_manha_pct int not null default 0 check (alloc_cafe_manha_pct between 0 and 100),
  add column alloc_bar_pct int not null default 0 check (alloc_bar_pct between 0 and 100),
  add column alloc_frigobar_pct int not null default 0 check (alloc_frigobar_pct between 0 and 100),
  add constraint exp_cat_alloc_sums_100 check (
    cost_nature <> 'custo_fixo' or (alloc_hospedagem_pct + alloc_cafe_manha_pct + alloc_bar_pct + alloc_frigobar_pct) = 100
  );

-- Categorias de custo DIRETO (já têm sua própria regra de cálculo —
-- ficha técnica ou rateio por hóspede — não usam os percentuais acima).
update expense_categories set cost_nature = 'custo_direto'
where name in ('Café da manhã', 'Bar da piscina', 'Frigobar');

-- Ativo permanente nunca é custo do período.
update expense_categories set cost_nature = 'nao_custo'
where name = 'Ativos permanentes';

-- "Consumo (luz/água/internet)" virava 1 categoria só — vira 4, cada uma
-- com seu próprio rateio (água/gás/luz têm perfis de uso bem diferentes
-- entre hospedagem, cozinha do café da manhã e bar). Reaproveita a linha
-- existente como "Água" (preserva qualquer item/despesa já vinculada a
-- ela) e cria as outras 3 novas.
update expense_categories
set name = 'Água', cost_nature = 'custo_fixo',
    alloc_hospedagem_pct = 40, alloc_cafe_manha_pct = 30, alloc_bar_pct = 30, alloc_frigobar_pct = 0
where name = 'Consumo (luz/água/internet)';

insert into expense_categories (name, is_inventory_category, cost_nature, alloc_hospedagem_pct, alloc_cafe_manha_pct, alloc_bar_pct, alloc_frigobar_pct)
values
  ('Luz', false, 'custo_fixo', 80, 10, 5, 5),
  ('Gás', false, 'custo_fixo', 0, 50, 50, 0),
  ('Internet', false, 'custo_fixo', 80, 10, 10, 0);

-- Demais categorias fixas: percentuais confirmados com o proprietário
-- (ver PRD_compras.md seção 20).
update expense_categories set alloc_hospedagem_pct = 100, alloc_cafe_manha_pct = 0, alloc_bar_pct = 0, alloc_frigobar_pct = 0
where name in ('Piscina', 'Jardim');

update expense_categories set alloc_hospedagem_pct = 50, alloc_cafe_manha_pct = 30, alloc_bar_pct = 20, alloc_frigobar_pct = 0
where name = 'Pessoal (salários/encargos)';

update expense_categories set alloc_hospedagem_pct = 70, alloc_cafe_manha_pct = 15, alloc_bar_pct = 15, alloc_frigobar_pct = 0
where name in ('Limpeza', 'Enxoval (cama/banho/mesa)', 'Manutenção (elétrica/hidráulica/outros)', 'Serviços profissionais', 'Impostos e taxas', 'Outras');

-- Cada linha de despesa ganha sua própria categoria, usada só quando NÃO
-- há item de estoque vinculado (salário, honorários, conta de serviço
-- avulsa) — quando há item vinculado, a categoria continua vindo das
-- categorias do item (inventory_item_categories), sem mudança.
alter table expense_items add column category_id uuid references expense_categories(id) on delete set null;

-- Agrupamento de itens pro relatório de custo do café da manhã (ex.:
-- "Frutas e ovos" somados como 1 item só, por não termos controle fino
-- de estoque sobre eles) — null = o item aparece com o próprio nome.
alter table inventory_items add column cost_report_group text;

-- ===================== 064_plano_de_contas.sql =====================
-- "Plano de Contas": centro de custo → subcentro de custo → item de custo
-- — substitui por completo o modelo de "categoria de gasto" (Parte 19/20)
-- por uma hierarquia editável de 3 níveis, com rateio percentual em cada
-- nível. Ver PRD_compras.md seção 21 pro raciocínio completo.
--
-- Decisão confirmada com o proprietário: "item de custo" e "item de
-- estoque" são CADASTROS SEPARADOS, ligados um ao outro quando o item de
-- custo representa estoque (is_inventory = true) — ao contrário da minha
-- sugestão inicial de uní-los numa tabela só.

create table cost_centers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Subcentros NÃO têm nome único — "Gerais" existe uma vez por centro
-- (Hospedagem, Café da manhã, Bar da piscina, Frigobar), cada ocorrência
-- é uma linha própria, com sua própria lista de itens (confirmado com o
-- proprietário: mesmo nome ≠ mesma linha).
create table cost_subcenters (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Um subcentro pode pertencer a mais de 1 centro (a funcionalidade existe
-- de propósito, mesmo que no plano de contas inicial nenhum subcentro
-- precise disso — todos ficam 100% ligados a 1 único centro).
create table cost_subcenter_centers (
  subcenter_id uuid not null references cost_subcenters(id) on delete cascade,
  center_id uuid not null references cost_centers(id) on delete cascade,
  alloc_pct numeric(6,2) not null check (alloc_pct > 0 and alloc_pct <= 100),
  primary key (subcenter_id, center_id)
);

-- Itens de custo: a conta mais analítica — pode ou não representar
-- estoque (is_inventory). Quando representa, liga a um item de estoque
-- já existente (inventory_items) — cadastro separado, nunca a mesma
-- linha, mas é esse vínculo que faz "lançar uma compra nesse item de
-- custo" também dar entrada no saldo de estoque dele.
create table cost_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_inventory boolean not null default false,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create unique index cost_items_inventory_item_uq on cost_items (inventory_item_id) where inventory_item_id is not null;

-- Um item de custo pode pertencer a mais de 1 subcentro (ex.: "água" nos
-- "Gerais" de Hospedagem, Café da manhã e Bar da piscina) — o rateio diz
-- quanto do gasto daquele item vai pra cada subcentro em que ele aparece.
create table cost_item_subcenters (
  cost_item_id uuid not null references cost_items(id) on delete cascade,
  subcenter_id uuid not null references cost_subcenters(id) on delete cascade,
  alloc_pct numeric(6,2) not null check (alloc_pct > 0 and alloc_pct <= 100),
  primary key (cost_item_id, subcenter_id)
);

-- Catálogo de "tipos" de ativo permanente (ex.: "Televisores", "Bombas de
-- piscina") — serve de sugestão de nome ao registrar um bem comprado de
-- verdade (fixed_assets); não tem saldo nem quantidade, é só uma lista
-- de nomes reaproveitáveis, como o "item de custo" serve pra despesas.
create table fixed_asset_catalog_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category_id uuid not null references asset_categories(id),
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table fixed_assets add column catalog_item_id uuid references fixed_asset_catalog_items(id) on delete set null;

-- Toda linha de despesa passa a apontar pra UM item de custo (compra ou
-- despesa pura) OU pra UM ativo permanente comprado — nunca os dois.
-- Substitui inventory_item_id/category_id (Partes 19/20), que saem
-- depois do backfill abaixo.
alter table expense_items
  add column cost_item_id uuid references cost_items(id) on delete set null,
  add column fixed_asset_id uuid references fixed_assets(id) on delete set null,
  add constraint expense_items_one_target check (not (cost_item_id is not null and fixed_asset_id is not null));

alter table cost_centers enable row level security;
alter table cost_subcenters enable row level security;
alter table cost_subcenter_centers enable row level security;
alter table cost_items enable row level security;
alter table cost_item_subcenters enable row level security;
alter table fixed_asset_catalog_items enable row level security;

create policy "cost_centers_select_authenticated" on cost_centers for select using (auth.uid() is not null);
create policy "cost_centers_admin_write" on cost_centers for all using (is_admin()) with check (is_admin());

create policy "cost_subcenters_select_authenticated" on cost_subcenters for select using (auth.uid() is not null);
create policy "cost_subcenters_admin_write" on cost_subcenters for all using (is_admin()) with check (is_admin());

create policy "cost_subcenter_centers_select_authenticated" on cost_subcenter_centers for select using (auth.uid() is not null);
create policy "cost_subcenter_centers_admin_write" on cost_subcenter_centers for all using (is_admin()) with check (is_admin());

create policy "cost_items_select_authenticated" on cost_items for select using (auth.uid() is not null);
-- Admin ou manutenção podem CRIAR um item de custo novo na hora de
-- lançar uma compra (mesmo padrão já usado pra criar item de estoque
-- novo) — só o admin edita/apaga/organiza o Plano de Contas.
create policy "cost_items_insert_admin_manutencao" on cost_items for insert with check (is_admin() or is_manutencao());
create policy "cost_items_admin_update" on cost_items for update using (is_admin());
create policy "cost_items_admin_delete" on cost_items for delete using (is_admin());

create policy "cost_item_subcenters_select_authenticated" on cost_item_subcenters for select using (auth.uid() is not null);
create policy "cost_item_subcenters_admin_write" on cost_item_subcenters for all using (is_admin()) with check (is_admin());

create policy "fixed_asset_catalog_items_select_authenticated" on fixed_asset_catalog_items for select using (auth.uid() is not null);
create policy "fixed_asset_catalog_items_admin_write" on fixed_asset_catalog_items for all using (is_admin()) with check (is_admin());

-- ===================== 065_plano_de_contas_seed.sql =====================
-- Plano de contas inicial (ver PRD_compras.md seção 21): 4 centros, 25
-- subcentros, ~250 vínculos item↔subcentro. Rateio inicial sempre em
-- partes iguais entre os subcentros de que cada item participa
-- (confirmado com o proprietário) — ex.: item em 3 subcentros recebe
-- 34/33/33 (o 1% de resto sempre vai pro primeiro, em ordem alfabética,
-- só pra garantir soma exata de 100).

create temp table raw_items (item_name text, is_inventory boolean, subcenter_name text, center_name text);

insert into raw_items (item_name, is_inventory, subcenter_name, center_name) values
-- ===== HOSPEDAGEM =====
('água', false, 'Gerais', 'Hospedagem'),
('luz', false, 'Gerais', 'Hospedagem'),
('internet', false, 'Gerais', 'Hospedagem'),
('dedetização', false, 'Gerais', 'Hospedagem'),
('limpeza coqueiros', false, 'Gerais', 'Hospedagem'),
('impostos e taxas', false, 'Gerais', 'Hospedagem'),

('amenities', true, 'Materiais das suítes', 'Hospedagem'),
('travesseiros', true, 'Materiais das suítes', 'Hospedagem'),
('papel higiênico', true, 'Materiais das suítes', 'Hospedagem'),
('sacos de lixo', true, 'Materiais das suítes', 'Hospedagem'),
('secador de cabelo', true, 'Materiais das suítes', 'Hospedagem'),

('toalhas de banho', true, 'Enxoval de cama e banho', 'Hospedagem'),
('toalhas de rosto', true, 'Enxoval de cama e banho', 'Hospedagem'),
('lençóis', true, 'Enxoval de cama e banho', 'Hospedagem'),
('fronhas', true, 'Enxoval de cama e banho', 'Hospedagem'),
('capas protetoras de travesseiro', true, 'Enxoval de cama e banho', 'Hospedagem'),
('capas protetoras de colchão', true, 'Enxoval de cama e banho', 'Hospedagem'),

('salário dos funcionários de manutenção', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('salário das camareiras', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('encargos', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('cesta básica', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('plano de saúde', false, 'Mão de obra de hospedagem', 'Hospedagem'),
('transporte', false, 'Mão de obra de hospedagem', 'Hospedagem'),

('outros materiais de jardinagem', false, 'Materiais de Jardim', 'Hospedagem'),
('adubo', false, 'Materiais de Jardim', 'Hospedagem'),
('plantas', false, 'Materiais de Jardim', 'Hospedagem'),
('remédios de plantas', false, 'Materiais de Jardim', 'Hospedagem'),
('mangueiras', false, 'Materiais de Jardim', 'Hospedagem'),
('conectores de mangueiras', false, 'Materiais de Jardim', 'Hospedagem'),
('torneiras de jardim', false, 'Materiais de Jardim', 'Hospedagem'),
('aspersores', false, 'Materiais de Jardim', 'Hospedagem'),
('outros materiais de irrigação', false, 'Materiais de Jardim', 'Hospedagem'),

('outros materiais de piscina', true, 'Materiais de Piscina', 'Hospedagem'),
('cloro', true, 'Materiais de Piscina', 'Hospedagem'),
('clarificante', true, 'Materiais de Piscina', 'Hospedagem'),
('barrilha', true, 'Materiais de Piscina', 'Hospedagem'),
('pastilhas de cloro', true, 'Materiais de Piscina', 'Hospedagem'),
('fluidos de medidores', true, 'Materiais de Piscina', 'Hospedagem'),
('toalhas de piscina', true, 'Materiais de Piscina', 'Hospedagem'),

('outros materiais de manutenção', false, 'Materiais de Manutenção', 'Hospedagem'),
('lâmpadas', true, 'Materiais de Manutenção', 'Hospedagem'),
('fita isolante', true, 'Materiais de Manutenção', 'Hospedagem'),
('fita veda rosca', true, 'Materiais de Manutenção', 'Hospedagem'),
('cola de cano', true, 'Materiais de Manutenção', 'Hospedagem'),
('silicone', true, 'Materiais de Manutenção', 'Hospedagem'),
('lubrificantes', true, 'Materiais de Manutenção', 'Hospedagem'),
('antioxidantes', true, 'Materiais de Manutenção', 'Hospedagem'),
('lixas', false, 'Materiais de Manutenção', 'Hospedagem'),
('peças de reposição', true, 'Materiais de Manutenção', 'Hospedagem'),
('parafusos', false, 'Materiais de Manutenção', 'Hospedagem'),
('porcas', false, 'Materiais de Manutenção', 'Hospedagem'),
('prendedores de toldo', false, 'Materiais de Manutenção', 'Hospedagem'),
('fio elétrico', false, 'Materiais de Manutenção', 'Hospedagem'),
('tomadas', true, 'Materiais de Manutenção', 'Hospedagem'),
('interruptores', true, 'Materiais de Manutenção', 'Hospedagem'),
('outros materiais elétricos', true, 'Materiais de Manutenção', 'Hospedagem'),
('outros materiais hidráulicos', true, 'Materiais de Manutenção', 'Hospedagem'),
('rejunte', false, 'Materiais de Manutenção', 'Hospedagem'),
('tintas de parede', true, 'Materiais de Manutenção', 'Hospedagem'),
('cimento', false, 'Materiais de Manutenção', 'Hospedagem'),
('argamassa', false, 'Materiais de Manutenção', 'Hospedagem'),
('areia', false, 'Materiais de Manutenção', 'Hospedagem'),
('colas em geral', false, 'Materiais de Manutenção', 'Hospedagem'),
('impermeabilizantes', false, 'Materiais de Manutenção', 'Hospedagem'),
('cabos', false, 'Materiais de Manutenção', 'Hospedagem'),
('filtros', false, 'Materiais de Manutenção', 'Hospedagem'),
('conduites', false, 'Materiais de Manutenção', 'Hospedagem'),
('conectores em geral', false, 'Materiais de Manutenção', 'Hospedagem'),
('conexões hidráulicas', false, 'Materiais de Manutenção', 'Hospedagem'),
('canos', false, 'Materiais de Manutenção', 'Hospedagem'),
('eletrodutos', false, 'Materiais de Manutenção', 'Hospedagem'),
('telhas', false, 'Materiais de Manutenção', 'Hospedagem'),
('carrinho de mão', true, 'Materiais de Manutenção', 'Hospedagem'),
('sacos de lixo', true, 'Materiais de Manutenção', 'Hospedagem'),
('escovão', false, 'Materiais de Manutenção', 'Hospedagem'),
('escada', false, 'Materiais de Manutenção', 'Hospedagem'),
('caibros', false, 'Materiais de Manutenção', 'Hospedagem'),
('ripas', false, 'Materiais de Manutenção', 'Hospedagem'),
('linhas de madeira', false, 'Materiais de Manutenção', 'Hospedagem'),
('toras de eucalipto', false, 'Materiais de Manutenção', 'Hospedagem'),
('tábuas', false, 'Materiais de Manutenção', 'Hospedagem'),
('medidores em geral', false, 'Materiais de Manutenção', 'Hospedagem'),

('alicates', false, 'Ferramentas', 'Hospedagem'),
('chaves de fenda', false, 'Ferramentas', 'Hospedagem'),
('chaves estrela', false, 'Ferramentas', 'Hospedagem'),
('chaves allen', false, 'Ferramentas', 'Hospedagem'),
('martelos', false, 'Ferramentas', 'Hospedagem'),
('chaves inglesas', false, 'Ferramentas', 'Hospedagem'),
('chaves de cano', false, 'Ferramentas', 'Hospedagem'),
('serrinha', false, 'Ferramentas', 'Hospedagem'),
('trenas', false, 'Ferramentas', 'Hospedagem'),
('outras ferramentas de manutenção', false, 'Ferramentas', 'Hospedagem'),

('Stays (CMS)', false, 'Honorários administrativos', 'Hospedagem'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Hospedagem'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Hospedagem'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Hospedagem'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Hospedagem'),
('pró-labore', false, 'Honorários administrativos', 'Hospedagem'),

('detergente', true, 'Materiais de limpeza', 'Hospedagem'),
('álcool', true, 'Materiais de limpeza', 'Hospedagem'),
('água sanitária', true, 'Materiais de limpeza', 'Hospedagem'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Hospedagem'),
('desinfetante', true, 'Materiais de limpeza', 'Hospedagem'),
('veja multiuso', true, 'Materiais de limpeza', 'Hospedagem'),
('limpa vidros', true, 'Materiais de limpeza', 'Hospedagem'),
('baldes', true, 'Materiais de limpeza', 'Hospedagem'),
('vassouras', true, 'Materiais de limpeza', 'Hospedagem'),
('rodos', true, 'Materiais de limpeza', 'Hospedagem'),
('panos de limpeza', false, 'Materiais de limpeza', 'Hospedagem'),
('estopas', false, 'Materiais de limpeza', 'Hospedagem'),
('buchas', false, 'Materiais de limpeza', 'Hospedagem'),
('sabão líquido', true, 'Materiais de limpeza', 'Hospedagem'),
('sabão em pó', true, 'Materiais de limpeza', 'Hospedagem'),
('sabão em barra', true, 'Materiais de limpeza', 'Hospedagem'),
('borrifadores', false, 'Materiais de limpeza', 'Hospedagem'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Hospedagem'),

-- ===== CAFÉ DA MANHÃ =====
('água', false, 'Gerais', 'Café da manhã'),
('luz', false, 'Gerais', 'Café da manhã'),
('gás', false, 'Gerais', 'Café da manhã'),
('impostos e taxas', false, 'Gerais', 'Café da manhã'),

('frutas', false, 'Alimentos', 'Café da manhã'),
('ovos', false, 'Alimentos', 'Café da manhã'),
('café', true, 'Alimentos', 'Café da manhã'),
('chocolate', true, 'Alimentos', 'Café da manhã'),
('farinha de trigo', true, 'Alimentos', 'Café da manhã'),
('manteiga', true, 'Alimentos', 'Café da manhã'),
('margarina', true, 'Alimentos', 'Café da manhã'),
('requeijão', true, 'Alimentos', 'Café da manhã'),
('cream cheese', true, 'Alimentos', 'Café da manhã'),
('croissants', true, 'Alimentos', 'Café da manhã'),
('pães', true, 'Alimentos', 'Café da manhã'),
('salgadinhos', false, 'Alimentos', 'Café da manhã'),
('brioches', false, 'Alimentos', 'Café da manhã'),
('bolos', false, 'Alimentos', 'Café da manhã'),
('açúcar', true, 'Alimentos', 'Café da manhã'),
('sal', true, 'Alimentos', 'Café da manhã'),
('adoçante', true, 'Alimentos', 'Café da manhã'),
('mel', true, 'Alimentos', 'Café da manhã'),
('legumes', false, 'Alimentos', 'Café da manhã'),
('verduras', false, 'Alimentos', 'Café da manhã'),
('linguiças', true, 'Alimentos', 'Café da manhã'),
('bacon', true, 'Alimentos', 'Café da manhã'),
('queijos', true, 'Alimentos', 'Café da manhã'),
('presuntos', true, 'Alimentos', 'Café da manhã'),
('farinha de tapioca', true, 'Alimentos', 'Café da manhã'),
('farinha de cuscuz', true, 'Alimentos', 'Café da manhã'),
('pimenta', false, 'Alimentos', 'Café da manhã'),
('temperos', false, 'Alimentos', 'Café da manhã'),

('salário das camareiras', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('encargos', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('cesta básica', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('plano de saúde', false, 'Mão de obra de café da manhã', 'Café da manhã'),
('transporte', false, 'Mão de obra de café da manhã', 'Café da manhã'),

('copos', false, 'Materiais de café da manhã', 'Café da manhã'),
('xícaras', false, 'Materiais de café da manhã', 'Café da manhã'),
('pires', false, 'Materiais de café da manhã', 'Café da manhã'),
('pratos', false, 'Materiais de café da manhã', 'Café da manhã'),
('talheres', false, 'Materiais de café da manhã', 'Café da manhã'),
('jogos americanos', false, 'Materiais de café da manhã', 'Café da manhã'),
('panos de prato', false, 'Materiais de café da manhã', 'Café da manhã'),
('guardanapos', false, 'Materiais de café da manhã', 'Café da manhã'),
('papéis toalha', false, 'Materiais de café da manhã', 'Café da manhã'),
('utensílios de cozinha', false, 'Materiais de café da manhã', 'Café da manhã'),

('Stays (CMS)', false, 'Honorários administrativos', 'Café da manhã'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Café da manhã'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Café da manhã'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Café da manhã'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Café da manhã'),
('pró-labore', false, 'Honorários administrativos', 'Café da manhã'),

('detergente', true, 'Materiais de limpeza', 'Café da manhã'),
('álcool', true, 'Materiais de limpeza', 'Café da manhã'),
('água sanitária', true, 'Materiais de limpeza', 'Café da manhã'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Café da manhã'),
('desinfetante', true, 'Materiais de limpeza', 'Café da manhã'),
('veja multiuso', true, 'Materiais de limpeza', 'Café da manhã'),
('limpa vidros', true, 'Materiais de limpeza', 'Café da manhã'),
('baldes', true, 'Materiais de limpeza', 'Café da manhã'),
('vassouras', true, 'Materiais de limpeza', 'Café da manhã'),
('rodos', true, 'Materiais de limpeza', 'Café da manhã'),
('panos de limpeza', false, 'Materiais de limpeza', 'Café da manhã'),
('estopas', false, 'Materiais de limpeza', 'Café da manhã'),
('buchas', false, 'Materiais de limpeza', 'Café da manhã'),
('sabão líquido', true, 'Materiais de limpeza', 'Café da manhã'),
('sabão em pó', true, 'Materiais de limpeza', 'Café da manhã'),
('sabão em barra', true, 'Materiais de limpeza', 'Café da manhã'),
('borrifadores', false, 'Materiais de limpeza', 'Café da manhã'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Café da manhã'),

-- ===== BAR DE PISCINA =====
('água', false, 'Gerais', 'Bar de piscina'),
('luz', false, 'Gerais', 'Bar de piscina'),
('gás', false, 'Gerais', 'Bar de piscina'),
('impostos e taxas', false, 'Gerais', 'Bar de piscina'),

('manteiga', true, 'Alimentos', 'Bar de piscina'),
('margarina', true, 'Alimentos', 'Bar de piscina'),
('pães', true, 'Alimentos', 'Bar de piscina'),
('açúcar', true, 'Alimentos', 'Bar de piscina'),
('sal', true, 'Alimentos', 'Bar de piscina'),
('adoçante', true, 'Alimentos', 'Bar de piscina'),
('carnes', true, 'Alimentos', 'Bar de piscina'),
('camarões', true, 'Alimentos', 'Bar de piscina'),
('queijos', true, 'Alimentos', 'Bar de piscina'),
('ovos', false, 'Alimentos', 'Bar de piscina'),
('presuntos', true, 'Alimentos', 'Bar de piscina'),
('macaxeira', true, 'Alimentos', 'Bar de piscina'),
('batatas fritas', true, 'Alimentos', 'Bar de piscina'),
('temperos', false, 'Alimentos', 'Bar de piscina'),
('massa de pastel', true, 'Alimentos', 'Bar de piscina'),
('bolinhos de bacalhau', true, 'Alimentos', 'Bar de piscina'),

('Vodka Smirnoff', true, 'Bebidas', 'Bar de piscina'),
('Vodka Absolut', true, 'Bebidas', 'Bar de piscina'),
('Cachaça', true, 'Bebidas', 'Bar de piscina'),
('Campari', true, 'Bebidas', 'Bar de piscina'),
('Gim Tanqueray', true, 'Bebidas', 'Bar de piscina'),
('Água de Coco', true, 'Bebidas', 'Bar de piscina'),
('Água com gás', true, 'Bebidas', 'Bar de piscina'),
('Água sem gás', true, 'Bebidas', 'Bar de piscina'),
('Refrigerante', true, 'Bebidas', 'Bar de piscina'),
('Cerveja', true, 'Bebidas', 'Bar de piscina'),
('Café expresso', true, 'Bebidas', 'Bar de piscina'),

('salário das camareiras', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('encargos', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('cesta básica', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('plano de saúde', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),
('transporte', false, 'Mão de obra de bar da piscina', 'Bar de piscina'),

('taças', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('palitos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('canudos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('mexedores de drink', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('copos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('pratos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('talheres', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('guardanapos', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('papéis toalha', false, 'Materiais de bar da piscina', 'Bar de piscina'),
('utensílios de cozinha', false, 'Materiais de bar da piscina', 'Bar de piscina'),

('Stays (CMS)', false, 'Honorários administrativos', 'Bar de piscina'),
('Invictos (Comercial e Atendimento)', false, 'Honorários administrativos', 'Bar de piscina'),
('Financeiro (Márcia)', false, 'Honorários administrativos', 'Bar de piscina'),
('Contabilidade (Simone Perla)', false, 'Honorários administrativos', 'Bar de piscina'),
('outras honorários administrativos', false, 'Honorários administrativos', 'Bar de piscina'),
('pró-labore', false, 'Honorários administrativos', 'Bar de piscina'),

('detergente', true, 'Materiais de limpeza', 'Bar de piscina'),
('álcool', true, 'Materiais de limpeza', 'Bar de piscina'),
('água sanitária', true, 'Materiais de limpeza', 'Bar de piscina'),
('perfume de ambiente', false, 'Materiais de limpeza', 'Bar de piscina'),
('desinfetante', true, 'Materiais de limpeza', 'Bar de piscina'),
('veja multiuso', true, 'Materiais de limpeza', 'Bar de piscina'),
('limpa vidros', true, 'Materiais de limpeza', 'Bar de piscina'),
('baldes', true, 'Materiais de limpeza', 'Bar de piscina'),
('vassouras', true, 'Materiais de limpeza', 'Bar de piscina'),
('rodos', true, 'Materiais de limpeza', 'Bar de piscina'),
('panos de limpeza', false, 'Materiais de limpeza', 'Bar de piscina'),
('estopas', false, 'Materiais de limpeza', 'Bar de piscina'),
('buchas', false, 'Materiais de limpeza', 'Bar de piscina'),
('sabão líquido', true, 'Materiais de limpeza', 'Bar de piscina'),
('sabão em pó', true, 'Materiais de limpeza', 'Bar de piscina'),
('sabão em barra', true, 'Materiais de limpeza', 'Bar de piscina'),
('borrifadores', false, 'Materiais de limpeza', 'Bar de piscina'),
('outros materiais de limpeza', false, 'Materiais de limpeza', 'Bar de piscina'),

-- ===== FRIGOBAR =====
('luz', false, 'Gerais', 'Frigobar'),
('Água com gás', true, 'Bebidas', 'Frigobar'),
('Água sem gás', true, 'Bebidas', 'Frigobar'),
('Refrigerante', true, 'Bebidas', 'Frigobar'),
('Cerveja', true, 'Bebidas', 'Frigobar'),
('Café expresso', true, 'Bebidas', 'Frigobar');

-- 1) Centros
insert into cost_centers (name, position)
select center_name, row_number() over (order by min(ctid))
from (select center_name, min(ctid) as ctid from raw_items group by center_name) x
group by center_name;
-- (posição aproximada só pra ordem de exibição inicial, reordenável depois)
update cost_centers set position = sub.pos from (
  select name, row_number() over () as pos from (
    select distinct center_name as name from raw_items
  ) t
) sub where cost_centers.name = sub.name;

-- 2) Subcentros (1 linha por par distinto nome+centro, mesmo quando o
-- nome se repete em centros diferentes) + ligação 100% ao seu centro.
create temp table subcenter_map (subcenter_name text, center_name text, subcenter_id uuid);
do $$
declare r record; v_id uuid;
begin
  for r in select distinct subcenter_name, center_name from raw_items order by center_name, subcenter_name loop
    insert into cost_subcenters (name) values (r.subcenter_name) returning id into v_id;
    insert into subcenter_map values (r.subcenter_name, r.center_name, v_id);
  end loop;
end $$;

insert into cost_subcenter_centers (subcenter_id, center_id, alloc_pct)
select sm.subcenter_id, cc.id, 100
from subcenter_map sm join cost_centers cc on cc.name = sm.center_name;

-- 3) Itens de custo — 1 linha por nome distinto; quando representa
-- estoque, liga a um item de estoque já existente (por nome) ou cria um
-- novo (unidade "un" por padrão, editável depois).
create temp table item_map (item_name text, cost_item_id uuid);
do $$
declare r record; v_item_id uuid; v_inv_id uuid;
begin
  for r in select item_name, bool_or(is_inventory) as is_inventory from raw_items group by item_name order by item_name loop
    v_inv_id := null;
    if r.is_inventory then
      select id into v_inv_id from inventory_items where lower(name) = lower(r.item_name) limit 1;
      if v_inv_id is null then
        insert into inventory_items (name, unit) values (r.item_name, 'un') returning id into v_inv_id;
      end if;
    end if;
    insert into cost_items (name, is_inventory, inventory_item_id) values (r.item_name, r.is_inventory, v_inv_id) returning id into v_item_id;
    insert into item_map values (r.item_name, v_item_id);
  end loop;
end $$;

-- 4) Vínculo item↔subcentro, com rateio em partes iguais (resto de
-- arredondamento sempre pro primeiro subcentro, em ordem alfabética, pra
-- garantir soma exata de 100).
insert into cost_item_subcenters (cost_item_id, subcenter_id, alloc_pct)
select
  im.cost_item_id,
  sm.subcenter_id,
  floor(100.0 / cnt.n) + case when rn.rn = 1 then 100 - cnt.n * floor(100.0 / cnt.n) else 0 end
from raw_items ri
join item_map im on im.item_name = ri.item_name
join subcenter_map sm on sm.subcenter_name = ri.subcenter_name and sm.center_name = ri.center_name
join (select item_name, count(*) as n from raw_items group by item_name) cnt on cnt.item_name = ri.item_name
join (
  select item_name, subcenter_name, center_name,
    row_number() over (partition by item_name order by center_name, subcenter_name) as rn
  from raw_items
) rn on rn.item_name = ri.item_name and rn.subcenter_name = ri.subcenter_name and rn.center_name = ri.center_name;

-- 5) Item extra, fora do documento: o ovo já cadastrado de verdade como
-- item de estoque (com ficha técnica real ligada ao prato "Americano")
-- continua representando estoque, ligado ao subcentro "Alimentos" de
-- Bar de piscina a 100% — decisão confirmada com o proprietário (manter
-- como já está hoje, sem o "(E)" do documento, que trata do gasto de
-- ovos de cozinha sem controle fino, afetar esse item específico).
do $$
declare v_inv_id uuid; v_item_id uuid; v_sub_id uuid;
begin
  select id into v_inv_id from inventory_items where name = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA';
  select subcenter_id into v_sub_id from subcenter_map where subcenter_name = 'Alimentos' and center_name = 'Bar de piscina';
  if v_inv_id is not null and v_sub_id is not null then
    insert into cost_items (name, is_inventory, inventory_item_id)
    values ('OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA', true, v_inv_id)
    returning id into v_item_id;
    insert into cost_item_subcenters (cost_item_id, subcenter_id, alloc_pct) values (v_item_id, v_sub_id, 100);
  end if;
end $$;

-- 6) Backfill dos dados reais já lançados antes desta parte (ver
-- PRD_compras.md seção 21): 4 linhas de "polpa de fruta" (sem item nem
-- categoria) → item de custo "frutas"; 2 linhas de ovo (o mesmo produto,
-- uma delas já ligada ao item de estoque, a outra não) → o item de
-- custo do ovo real acima.
update expense_items set cost_item_id = (select id from cost_items where name = 'frutas' limit 1)
where description ilike 'POLPA%' and cost_item_id is null and fixed_asset_id is null;

update expense_items set cost_item_id = (
  select id from cost_items where name = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA' limit 1
)
where description = 'OVO BRANCO TIPO A GRANDE C/30 UNID - HOLANDA' and cost_item_id is null and fixed_asset_id is null;

-- ===================== 066_plano_de_contas_limpeza.sql =====================
-- Limpeza do modelo antigo de "categoria de gasto" (Partes 19/20),
-- totalmente substituído pelo Plano de Contas (migrations 064/065) — ver
-- PRD_compras.md seção 21.

-- 1) A baixa automática de estoque ao lançar uma compra passa a resolver
-- o item de estoque através do item de custo, não mais direto por
-- inventory_item_id (que deixa de existir em expense_items).
create or replace function create_movement_from_expense_item() returns trigger as $$
declare
  v_inventory_item_id uuid;
begin
  if new.cost_item_id is not null then
    select inventory_item_id into v_inventory_item_id from cost_items where id = new.cost_item_id;
    if v_inventory_item_id is not null then
      insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
      values (
        v_inventory_item_id,
        'compra',
        new.quantity,
        new.id,
        (select created_by from expenses where id = new.expense_id)
      );

      update purchase_requests
      set status = 'atendido', updated_at = now()
      where inventory_item_id = v_inventory_item_id and status = 'pendente';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 2) expense_items perde os campos antigos (já totalmente substituídos
-- por cost_item_id/fixed_asset_id, migration 064, com o backfill dos
-- dados reais já feito na migration 065).
alter table expense_items drop column inventory_item_id;
alter table expense_items drop column category_id;

-- 3) Contagem física passa a ser organizada por GRUPO de subcentros com
-- o mesmo nome (ex.: "Alimentos" junta o subcentro de Café da manhã e o
-- de Bar da piscina numa contagem só) — decisão explícita do
-- proprietário. category_id (ligado a expense_categories) sai;
-- subcenter_group_name (o nome do grupo, não o id de 1 subcentro
-- específico) entra. null continua significando "todos os itens".
alter table inventory_count_sessions add column subcenter_group_name text;
alter table inventory_count_sessions drop column category_id;

-- Frequência de contagem (antes por categoria) passa a ser configurada
-- por subcentro — ao agrupar por nome repetido, a tela usa a menor
-- frequência configurada entre os subcentros daquele grupo.
alter table cost_subcenters add column count_frequency_days int check (count_frequency_days is null or count_frequency_days > 0);

-- Trava de "no máximo 1 sessão em_andamento por vez" (migration 059)
-- agora por grupo de subcentro, não mais por categoria.
create unique index inventory_count_sessions_one_open_per_group
  on inventory_count_sessions (coalesce(subcenter_group_name, ''))
  where status = 'em_andamento';

-- A view de histórico de quebra de estoque (Parte 18/19) mostrava a(s)
-- categoria(s) do item via inventory_item_categories — agora mostra
-- o(s) subcentro(s) a que o item de custo ligado àquele item de estoque
-- pertence, pela mesma ideia.
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(distinct cs.name, ' / ' order by cs.name)
     from cost_items ci
     join cost_item_subcenters cis on cis.cost_item_id = ci.id
     join cost_subcenters cs on cs.id = cis.subcenter_id
     where ci.inventory_item_id = ii.id),
    '—'
  ) as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs2.closed_at,
  lag(cs2.closed_at) over (partition by cl.inventory_item_id order by cs2.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs2 on cs2.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
where cs2.status = 'concluida' and cl.counted_qty is not null;

-- 4) inventory_item_categories (N-pra-N item↔categoria, Parte 19) e
-- expense_categories (Partes 1/20) saem por completo — tudo que
-- dependia delas já tem substituto no Plano de Contas.
drop table inventory_item_categories;
drop table expense_categories;

-- 5) Ativo Permanente: categorias passam a ser as 3 do plano de contas
-- do documento (Máquinas, Metais e louças banho, Aparelhos) — as 13
-- antigas nunca tiveram nenhum bem real cadastrado, substituição segura.
delete from asset_categories;
insert into asset_categories (name, position) values
  ('Máquinas', 1),
  ('Metais e louças banho', 2),
  ('Aparelhos', 3);

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Bombas de piscina', 1), ('Bombas pressurizadoras', 2), ('Bombas de irrigação', 3), ('Bombas de poço', 4),
  ('Boilers', 5), ('Aquecedores Cardal', 6), ('Filtros de piscina', 7), ('Politrizes', 8), ('Maquitas', 9), ('Furadeiras', 10)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Máquinas') ac;

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Torneiras', 1), ('Chuveiros', 2), ('Vasos sanitários', 3), ('Registros', 4), ('Ralos', 5), ('Pias', 6), ('Espelhos', 7)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Metais e louças banho') ac;

insert into fixed_asset_catalog_items (name, category_id, position)
select v.name, ac.id, v.pos
from (values
  ('Televisores', 1), ('Roteadores', 2), ('Frigobares', 3), ('Refrigeradores', 4), ('Freezers', 5), ('Bebedouros', 6),
  ('Filtros de água', 7), ('Máquinas de café', 8), ('Ar condicionados', 9), ('Máquinas de lavar', 10),
  ('Lavadoras pressurizada', 11), ('Aspiradores de pó', 12), ('Câmeras', 13), ('Controladoras', 14),
  ('Computadores', 15), ('Laptops', 16), ('Impressoras', 17)
) as v(name, pos)
cross join lateral (select id from asset_categories where name = 'Aparelhos') ac;

-- ===================== 067_dias_de_folga_no_item.sql =====================
-- "Dias de folga" deixa de ser um grupo de giro separado (tela "Grupos de
-- giro", excluída) e passa a ser um campo direto em cada item de estoque
-- — ver PRD_compras.md seção 21 ("Itens de estoque e ciclo de compras").

alter table inventory_items add column coverage_days int not null default 7 check (coverage_days > 0);

update inventory_items ii
set coverage_days = itg.coverage_days
from inventory_turnover_groups itg
where ii.turnover_group_id = itg.id;

-- A sugestão calculada de compra usava "sem grupo de giro" como forma de
-- excluir itens perecíveis (frutas, ovos de café da manhã) do cálculo
-- automático — esses itens, agora, nem chegam a ser item de estoque (são
-- item de custo sem is_inventory), então a exceção "sem grupo = sem
-- cálculo" não tem mais nenhum caso de uso real; todo item de estoque
-- passa a ter sempre um coverage_days (padrão 7) e sempre um ponto de
-- reposição calculado.
create or replace view inventory_purchase_suggestions
with (security_invoker = true) as
select
  ii.id as inventory_item_id,
  coalesce(ib.balance, 0) as balance,
  coalesce(wt.weekly_consumption, 0) as weekly_consumption,
  ii.coverage_days,
  (coalesce(wt.weekly_consumption, 0) / 7.0) * ii.coverage_days as calculated_reorder_point,
  ii.reorder_point as manual_reorder_point,
  ii.portion_weight_kg
from inventory_items ii
left join inventory_balances ib on ib.inventory_item_id = ii.id
left join inventory_weekly_turnover wt on wt.inventory_item_id = ii.id
where ii.active;

alter table inventory_items drop column turnover_group_id;
drop table inventory_turnover_groups;

-- ===================== 068_contabil_plano_de_contas_e_lancamentos.sql =====================
-- Módulo Contábil — Leva 1: plano de contas contábil (Ativo/Passivo/
-- Receita/Custo/Despesa) + motor de partidas dobradas (o "livro-razão"
-- por trás). Ver PRD_compras&contabil.md seção 22 pro documento
-- original e as decisões tomadas antes desta leva.
--
-- Esta leva é só a fundação: nenhuma tela existente (compras, comandas,
-- consumo por quartos, estoque) passa a gravar lançamento nenhum ainda —
-- isso é só um motor novo, testável sozinho, que as próximas levas vão
-- chamar.
--
-- Duas contas contábeis (dimensão "que TIPO de movimento é isso") nunca
-- se confundem com centro de custo (dimensão "de qual PARTE da pousada
-- é isso") — um lançamento carrega as duas, a segunda só quando faz
-- sentido (nem todo lançamento tem centro, ex.: pagar um fornecedor).

create type ledger_account_group as enum ('ativo', 'passivo', 'receita', 'custo', 'despesa');
create type ledger_entry_status as enum ('confirmado', 'estornado');
create type ledger_entry_direction as enum ('debito', 'credito');

-- Plano de contas contábil — editável pelo admin, mas começa com a
-- estrutura inteira do documento (seção 6). `code` é um identificador
-- estável em texto (nunca muda, usado pelo código do app pra saber qual
-- conta usar em cada lançamento automático); `display_code` é só o
-- "1.01" que aparece pro usuário no balancete/livro-razão, puramente
-- cosmético. `requires_cost_center` indica se um lançamento nessa conta
-- PRECISA informar também um centro de custo (ex.: toda despesa/custo
-- precisa; Caixa/Banco/Fornecedores a pagar não precisam).
create table ledger_accounts (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  display_code text,
  name text not null,
  account_group ledger_account_group not null,
  requires_cost_center boolean not null default false,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Item de custo → centro de custo, direto (sem a camada de subcentro —
-- ver migration 069, que remove os subcentros). Fica junto desta
-- migration só pelo número sequencial; a tabela em si só é criada e
-- populada na 069, que mexe no Plano de Contas já existente.

-- Um "lançamento" é 1 evento econômico (uma compra, uma venda, um
-- pagamento) que gera 2 ou mais linhas (débito/crédito). Nunca é
-- apagado depois de confirmado — uma correção sempre nasce como um novo
-- lançamento de estorno (reverses_entry_id), nunca um DELETE/UPDATE no
-- lançamento original.
create table ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_date date not null, -- data de competência
  document_date date, -- data do documento (nota fiscal, recibo etc.), quando houver
  cash_date date, -- data de caixa (pagamento/recebimento), quando houver
  description text not null,
  origin text not null, -- de onde veio: 'compra' | 'despesa' | 'venda_bar' | 'venda_frigobar' | 'pagamento' | 'recebimento' | 'perda_estoque' | 'ajuste_contagem' | 'manual' | 'estorno' etc. — texto livre de propósito, cresce sem precisar de migration nova
  source_type text, -- nome da tabela de origem (ex.: 'expenses', 'bar_comandas'), quando o lançamento foi gerado automaticamente por outra tela
  source_id uuid, -- id da linha de origem nessa tabela — sem FK de verdade, já que aponta pra tabelas diferentes conforme source_type
  status ledger_entry_status not null default 'confirmado',
  reverses_entry_id uuid references ledger_entries(id) on delete set null, -- quando este lançamento É o estorno de outro
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ledger_entries_source_idx on ledger_entries (source_type, source_id);
create index ledger_entries_entry_date_idx on ledger_entries (entry_date);

-- Uma linha = 1 débito OU 1 crédito, numa conta, com centro de custo
-- opcional. A soma dos débitos de um lançamento sempre bate com a soma
-- dos créditos — garantido pela função post_ledger_entry abaixo, nunca
-- confiado a um INSERT direto.
create table ledger_entry_lines (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references ledger_entries(id) on delete cascade,
  account_id uuid not null references ledger_accounts(id),
  cost_center_id uuid references cost_centers(id),
  direction ledger_entry_direction not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index ledger_entry_lines_entry_idx on ledger_entry_lines (entry_id);
create index ledger_entry_lines_account_idx on ledger_entry_lines (account_id);

-- Único jeito de criar um lançamento — nunca INSERT direto em
-- ledger_entries/ledger_entry_lines pelo client (mesmo padrão
-- `security definer` já usado em todo o projeto pra transição de
-- estado sensível). Recebe as linhas como JSON
-- ([{account_code, cost_center_id, direction, amount}, ...]), confere
-- que débitos somam igual a créditos (com 1 centavo de tolerância, pra
-- arredondamento de ponto flutuante nunca travar um lançamento válido)
-- e só então grava o lançamento inteiro, atômico. Qualquer papel
-- autenticado pode chamar (as próprias Server Actions de cada tela é
-- que decidem quando chamar isso, então a autorização de fato já
-- aconteceu antes — ex.: só uma camareira pode fechar uma comanda, e
-- é a Server Action de fechar a comanda que, por baixo, chama esta
-- função).
create or replace function post_ledger_entry(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_entry_id uuid;
  v_total_debito numeric := 0;
  v_total_credito numeric := 0;
  v_line jsonb;
  v_line_count int;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_line_count < 2 then
    raise exception 'Um lançamento precisa de pelo menos 2 linhas (1 débito e 1 crédito).';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line->>'direction') = 'debito' then
      v_total_debito := v_total_debito + (v_line->>'amount')::numeric;
    elsif (v_line->>'direction') = 'credito' then
      v_total_credito := v_total_credito + (v_line->>'amount')::numeric;
    else
      raise exception 'direction inválida: %', v_line->>'direction';
    end if;
  end loop;

  if abs(v_total_debito - v_total_credito) > 0.01 then
    raise exception 'Lançamento desbalanceado: débitos % ≠ créditos %', v_total_debito, v_total_credito;
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, created_by)
  values (p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, auth.uid())
  returning id into v_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, direction, amount)
  select
    v_entry_id,
    la.id,
    nullif(elem->>'cost_center_id', '')::uuid,
    (elem->>'direction')::ledger_entry_direction,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_lines) elem
  join ledger_accounts la on la.code = (elem->>'account_code');

  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(*) from ledger_entry_lines where entry_id = v_entry_id) then
    raise exception 'Uma ou mais contas (account_code) não foram encontradas no plano de contas.';
  end if;

  return v_entry_id;
end;
$$ language plpgsql security definer;

-- Estorna um lançamento confirmado: marca o original como 'estornado' e
-- cria um novo lançamento espelhado (débito↔crédito invertidos em
-- relação ao original), preservando o histórico dos dois — nunca
-- apaga/edita o lançamento original.
create or replace function reverse_ledger_entry(p_entry_id uuid, p_reason text) returns uuid as $$
declare
  v_new_entry_id uuid;
  v_original ledger_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_original from ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;
  if v_original.status = 'estornado' then
    raise exception 'Este lançamento já foi estornado.';
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, reverses_entry_id, created_by)
  values (current_date, v_original.document_date, v_original.cash_date, coalesce(p_reason, 'Estorno de: ' || v_original.description), 'estorno', v_original.source_type, v_original.source_id, p_entry_id, auth.uid())
  returning id into v_new_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, direction, amount)
  select
    v_new_entry_id,
    l.account_id,
    l.cost_center_id,
    (case when l.direction = 'debito' then 'credito' else 'debito' end)::ledger_entry_direction,
    l.amount
  from ledger_entry_lines l
  where l.entry_id = p_entry_id;

  update ledger_entries set status = 'estornado' where id = p_entry_id;

  return v_new_entry_id;
end;
$$ language plpgsql security definer;

alter table ledger_accounts enable row level security;
alter table ledger_entries enable row level security;
alter table ledger_entry_lines enable row level security;

create policy "ledger_accounts_select_authenticated" on ledger_accounts for select using (auth.uid() is not null);
create policy "ledger_accounts_admin_write" on ledger_accounts for all using (is_admin()) with check (is_admin());

-- Ninguém grava direto em ledger_entries/ledger_entry_lines — sempre via
-- post_ledger_entry/reverse_ledger_entry (security definer). A leitura é
-- liberada pra qualquer autenticado (o acesso de verdade é controlado
-- nas telas, já que por ora só o admin tem tela que usa isso).
create policy "ledger_entries_select_authenticated" on ledger_entries for select using (auth.uid() is not null);
create policy "ledger_entry_lines_select_authenticated" on ledger_entry_lines for select using (auth.uid() is not null);

-- Plano de contas contábil inicial (PRD_compras&contabil.md seção 22.1,
-- seção 6). `requires_cost_center`: contas de Ativo/Passivo "de
-- posição" (Caixa, Banco, Estoques, Fornecedores a pagar etc.) não
-- precisam de centro; Receita/Custo/Despesa sempre fazem mais sentido
-- com centro, pra alimentar os relatórios por centro.
insert into ledger_accounts (code, display_code, name, account_group, requires_cost_center) values
  ('caixa', '1.01', 'Caixa', 'ativo', false),
  ('banco', '1.02', 'Banco', 'ativo', false),
  ('consumos-a-liquidar', '1.03', 'Consumos de bar/frigobar a liquidar no checkout', 'ativo', false),
  ('estoque-bebidas', '1.04', 'Estoque Central de bebidas', 'ativo', false),
  ('estoque-alimentos', '1.05', 'Estoque Central de alimentos/ingredientes', 'ativo', false),
  ('estoque-limpeza', '1.06', 'Estoque de materiais de limpeza e amenidades', 'ativo', false),
  ('estoque-outros', '1.07', 'Outros estoques operacionais', 'ativo', false),
  ('equipamentos-imobilizado', '1.08', 'Equipamentos e imobilizado', 'ativo', false),
  ('depreciacao-acumulada', '1.09', 'Depreciação acumulada', 'ativo', false),

  ('fornecedores-a-pagar', '2.01', 'Fornecedores a pagar', 'passivo', false),
  ('despesas-a-pagar', '2.02', 'Despesas operacionais a pagar', 'passivo', false),
  ('salarios-a-pagar', '2.03', 'Salários/encargos a pagar', 'passivo', false),
  ('tributos-a-pagar', '2.04', 'Tributos e taxas a pagar', 'passivo', false),
  ('outras-obrigacoes', '2.05', 'Outras obrigações operacionais', 'passivo', false),

  ('receita-bebidas-bar', '3.01', 'Receita de bebidas — Bar da piscina', 'receita', true),
  ('receita-petiscos-bar', '3.02', 'Receita de petiscos — Bar da piscina', 'receita', true),
  ('receita-drinks-bar', '3.03', 'Receita de drinks — Bar da piscina', 'receita', true),
  ('receita-bebidas-frigobar', '3.04', 'Receita de bebidas — Frigobar', 'receita', true),
  ('descontos-bar-frigobar', '3.05', 'Descontos concedidos no bar/frigobar', 'receita', true),
  ('cancelamentos-bar-frigobar', '3.06', 'Cancelamentos/devoluções do bar/frigobar', 'receita', true),

  ('cmv-bebidas-bar', '4.01', 'CMV de bebidas — Bar da piscina', 'custo', true),
  ('custo-petiscos-bar', '4.02', 'Custo de ingredientes/petiscos — Bar da piscina', 'custo', true),
  ('custo-drinks-bar', '4.03', 'Custo de ingredientes/drinks — Bar da piscina', 'custo', true),
  ('cmv-bebidas-frigobar', '4.04', 'CMV de bebidas — Frigobar', 'custo', true),
  ('custo-cafe-manha', '4.05', 'Custo de alimentos e bebidas consumidos — Café da manhã', 'custo', true),
  ('materiais-limpeza-hospedagem', '4.06', 'Materiais de limpeza e amenidades — Hospedagem', 'custo', true),
  ('lavanderia-hospedagem', '4.07', 'Lavanderia — Hospedagem', 'custo', true),
  ('mao-de-obra-operacional', '4.08', 'Mão de obra operacional', 'custo', true),
  ('perdas-estoque', '4.09', 'Perdas e desperdícios de estoque', 'custo', true),

  ('energia-eletrica', '5.01', 'Energia elétrica', 'despesa', true),
  ('agua-esgoto', '5.02', 'Água e esgoto', 'despesa', true),
  ('gas', '5.03', 'Gás', 'despesa', true),
  ('internet-telefonia', '5.04', 'Internet e telefonia', 'despesa', true),
  ('manutencao', '5.05', 'Manutenção', 'despesa', true),
  ('jardinagem', '5.06', 'Jardinagem', 'despesa', true),
  ('piscina', '5.07', 'Piscina', 'despesa', true),
  ('limpeza-areas-comuns', '5.08', 'Limpeza de áreas comuns', 'despesa', true),
  ('contabilidade-servicos', '5.09', 'Contabilidade e serviços profissionais', 'despesa', true),
  ('material-administrativo', '5.10', 'Material administrativo', 'despesa', true),
  ('tarifas-bancarias', '5.11', 'Tarifas bancárias', 'despesa', false),
  ('despesas-financeiras', '5.12', 'Despesas financeiras', 'despesa', false),
  ('pessoal-administrativo', '5.13', 'Despesas com pessoal administrativo', 'despesa', true),
  ('outras-despesas', '5.14', 'Outras despesas operacionais', 'despesa', true);

-- ===================== 069_remove_subcentros_cost_item_centers.sql =====================
-- Módulo Contábil — Leva 1 (parte 2): remove a camada de subcentros do
-- Plano de Contas, ligando item de custo direto no centro — decisão
-- tomada explicitamente com o proprietário (PRD_compras&contabil.md
-- seção 22.3, item 2): o rateio por percentual entre centros continua
-- existindo, só sem a camada do meio.
--
-- Um item de custo hoje pode estar em mais de 1 subcentro, e cada
-- subcentro pode estar em mais de 1 centro — o percentual "de verdade"
-- que cada item já tem em cada centro é a MULTIPLICAÇÃO dos dois
-- percentuais, somada quando o mesmo centro é alcançado por mais de um
-- caminho. Essa migration deriva esse percentual combinado a partir do
-- que já existe hoje, arredondando pro inteiro mais próximo e corrigindo
-- a sobra de arredondamento na maior linha de cada item (mesma técnica
-- já usada no seed original da migration 065), garantindo que a soma de
-- cada item continua batendo 100%.

create table cost_item_centers (
  cost_item_id uuid not null references cost_items(id) on delete cascade,
  center_id uuid not null references cost_centers(id) on delete cascade,
  alloc_pct numeric(6,2) not null check (alloc_pct > 0 and alloc_pct <= 100),
  primary key (cost_item_id, center_id)
);

do $$
declare
  r record;
  v_total numeric;
  v_first_center_id uuid;
begin
  for r in
    select cis.cost_item_id, csc.center_id, sum(cis.alloc_pct * csc.alloc_pct / 100.0) as raw_pct
    from cost_item_subcenters cis
    join cost_subcenter_centers csc on csc.subcenter_id = cis.subcenter_id
    group by cis.cost_item_id, csc.center_id
  loop
    insert into cost_item_centers (cost_item_id, center_id, alloc_pct)
    values (r.cost_item_id, r.center_id, round(r.raw_pct))
    on conflict (cost_item_id, center_id) do update set alloc_pct = excluded.alloc_pct;
  end loop;

  -- Corrige a sobra de arredondamento: pra cada item cuja soma não bate
  -- 100 exatamente, ajusta a maior linha dele pra absorver a diferença.
  for r in
    select cost_item_id, sum(alloc_pct) as total
    from cost_item_centers
    group by cost_item_id
    having sum(alloc_pct) <> 100
  loop
    v_total := 100 - r.total;
    select center_id into v_first_center_id
    from cost_item_centers
    where cost_item_id = r.cost_item_id
    order by alloc_pct desc, center_id
    limit 1;

    update cost_item_centers
    set alloc_pct = alloc_pct + v_total
    where cost_item_id = r.cost_item_id and center_id = v_first_center_id;
  end loop;
end $$;

-- Confere que todo item de custo com algum vínculo soma exatamente 100
-- antes de seguir — se isso falhar, a migration para aqui, sem apagar
-- nada do que já existia.
do $$
declare
  v_bad_count int;
begin
  select count(*) into v_bad_count
  from (select cost_item_id from cost_item_centers group by cost_item_id having sum(alloc_pct) <> 100) t;
  if v_bad_count > 0 then
    raise exception 'Encontrados % itens de custo cujo rateio por centro não soma 100%% após a migração — abortando antes de remover os subcentros.', v_bad_count;
  end if;
end $$;

alter table cost_item_centers enable row level security;
create policy "cost_item_centers_select_authenticated" on cost_item_centers for select using (auth.uid() is not null);
create policy "cost_item_centers_admin_write" on cost_item_centers for all using (is_admin()) with check (is_admin());

-- `inventory_count_line_history` usava subcentro pra mostrar a
-- categoria do item — passa a mostrar direto o(s) centro(s).
create or replace view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  coalesce(
    (select string_agg(distinct cc.name, ' / ' order by cc.name)
     from cost_items ci
     join cost_item_centers cic on cic.cost_item_id = ci.id
     join cost_centers cc on cc.id = cic.center_id
     where ci.inventory_item_id = ii.id),
    '—'
  ) as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs2.closed_at,
  lag(cs2.closed_at) over (partition by cl.inventory_item_id order by cs2.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs2 on cs2.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
where cs2.status = 'concluida' and cl.counted_qty is not null;

-- A contagem física agrupada "por nome de subcentro através de centros"
-- (ex.: "Alimentos" juntando Café da manhã e Bar da piscina numa
-- contagem só) deixa de fazer sentido sem subcentro — vira, por ora,
-- agrupada por CENTRO inteiro (granularidade mais grossa; será
-- repensada na Leva 3, ver PRD seção 22.3 item 2). Renomeia a coluna pra
-- não sugerir mais "subcentro", e `count_frequency_days` migra pra
-- `cost_centers` — como um centro podia ter várias frequências
-- diferentes vindas de vários subcentros, não dá pra adivinhar qual
-- vale; começa sempre em branco (sem aviso configurado), o admin
-- reconfigura se quiser.
alter table cost_centers add column count_frequency_days int check (count_frequency_days is null or count_frequency_days > 0);

alter table inventory_count_sessions rename column subcenter_group_name to count_group_name;
drop index inventory_count_sessions_one_open_per_group;
create unique index inventory_count_sessions_one_open_per_group
  on inventory_count_sessions (coalesce(count_group_name, ''))
  where status = 'em_andamento';

drop table cost_item_subcenters;
drop table cost_subcenter_centers;
drop table cost_subcenters;

-- ===================== 070_fornecedores_contas_a_pagar.sql =====================
-- Módulo Contábil — Leva 2: fornecedores (cadastro de verdade),
-- contas a pagar (compra/despesa "a prazo"), novos campos na tela de
-- compras (data de competência, número do documento, desconto/frete/
-- tributos por item) e a conta contábil de cada item de custo. Ver
-- PRD_compras&contabil.md seção 22/24.

-- ---------- FORNECEDORES ----------
-- Hoje "fornecedor" é só texto livre em duas colunas independentes
-- (expenses.supplier_name e fixed_assets.supplier_name), que nem batem
-- entre si por causa de maiúscula/minúscula. Esta tabela os unifica.
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cpf_cnpj text,
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name_uq on suppliers (lower(name));

-- Backfill a partir dos nomes já digitados, juntando nomes iguais
-- (ignorando maiúscula/minúscula) — decisão explícita do proprietário,
-- pra não perder a referência das compras antigas.
insert into suppliers (name)
select distinct on (lower(trim(supplier_name))) trim(supplier_name)
from (
  select supplier_name from expenses where supplier_name is not null and trim(supplier_name) <> ''
  union all
  select supplier_name from fixed_assets where supplier_name is not null and trim(supplier_name) <> ''
) t
order by lower(trim(supplier_name)), trim(supplier_name);

alter table expenses add column supplier_id uuid references suppliers(id) on delete set null;
update expenses e set supplier_id = s.id from suppliers s where lower(trim(e.supplier_name)) = lower(s.name);
alter table expenses drop column supplier_name;

alter table fixed_assets add column supplier_id uuid references suppliers(id) on delete set null;
update fixed_assets fa set supplier_id = s.id from suppliers s where lower(trim(fa.supplier_name)) = lower(s.name);
alter table fixed_assets drop column supplier_name;

alter table suppliers enable row level security;
create policy "suppliers_select_authenticated" on suppliers for select using (auth.uid() is not null);
create policy "suppliers_insert_admin_manutencao" on suppliers for insert with check (is_admin() or is_manutencao());
create policy "suppliers_admin_update" on suppliers for update using (is_admin());
create policy "suppliers_admin_delete" on suppliers for delete using (is_admin());

-- ---------- CONTAS A PAGAR (compra/despesa "a prazo") ----------
-- A despesa em si já carrega o estado "pago"/"pendente" — não existe
-- uma tabela separada de "obrigação": a despesa É a obrigação enquanto
-- pendente. "Pagar" só atualiza esta mesma linha (status/paid_at/forma)
-- e gera o lançamento contábil de liquidação, sem reconhecer a despesa
-- de novo (ver pay_expense em src/lib/actions/expenses.ts).
create type expense_payment_status as enum ('pago', 'pendente');

-- Forma de pagamento do lado FORNECEDOR (a pousada pagando), separada
-- da forma de pagamento do lado HÓSPEDE (já existente, `payment_method`,
-- usada por room_bills) — são conceitos diferentes (ver
-- PRD_compras&contabil.md seção 22.3 item 12).
create type supplier_payment_method as enum ('banco_pix', 'dinheiro', 'cartao_corporativo', 'a_prazo');

alter table expenses
  add column competence_date date,
  add column document_number text,
  add column due_date date,
  add column payment_status expense_payment_status not null default 'pago',
  add column paid_at timestamptz;

-- Toda despesa já lançada antes desta leva é um fato passado, sempre já
-- liquidado — o conceito de "pendente" não existia ainda.
update expenses set competence_date = date, paid_at = created_at, payment_status = 'pago';
alter table expenses alter column competence_date set not null;

-- Troca o tipo da coluna pro novo enum específico de fornecedor,
-- mapeando os valores antigos pro mais próximo equivalente (nenhuma
-- despesa real usava 'boleto' até aqui, confirmado antes de migrar).
alter table expenses add column payment_method_new supplier_payment_method;
update expenses set payment_method_new = case payment_method::text
  when 'pix' then 'banco_pix'
  when 'transferencia_bancaria' then 'banco_pix'
  when 'dinheiro' then 'dinheiro'
  when 'cartao_credito' then 'cartao_corporativo'
  when 'cartao_debito' then 'cartao_corporativo'
  when 'boleto' then 'banco_pix'
  else null
end::supplier_payment_method;
alter table expenses drop column payment_method;
alter table expenses rename column payment_method_new to payment_method;

alter table expense_items
  add column discount numeric(12,2) not null default 0 check (discount >= 0),
  add column freight_and_other_costs numeric(12,2) not null default 0 check (freight_and_other_costs >= 0),
  add column recoverable_tax numeric(12,2) not null default 0 check (recoverable_tax >= 0),
  add column non_recoverable_tax numeric(12,2) not null default 0 check (non_recoverable_tax >= 0);

-- ---------- CONTA CONTÁBIL DE CADA ITEM DE CUSTO ----------
-- Qual conta do plano de contas CONTÁBIL (ledger_accounts) o gasto
-- desse item posta nos lançamentos automáticos — null = usa um padrão
-- genérico (estoque-outros se representa estoque, outras-despesas se
-- não), sempre editável pelo admin em "Plano de itens de custo".
alter table cost_items add column ledger_account_code text references ledger_accounts(code);

-- ===================== 071_estoque_valorizacao.sql =====================
-- Módulo Contábil — Leva 3: estoque com saldo em R$ (custo médio
-- ponderado móvel), não só quantidade. Ver PRD_compras&contabil.md
-- seção 25.
--
-- Decisão de design: em vez de guardar um "avg_cost" por item que
-- precisaria ser atualizado por código toda vez que um movimento é
-- inserido (risco real de esquecer um call site — já aconteceu antes
-- neste projeto), cada MOVIMENTO grava seu próprio unit_cost/total_value
-- no momento em que acontece, via um trigger `before insert` que roda
-- pra TODO insert em inventory_movements, não importa de onde venha
-- (compra automática pela despesa, baixa manual, baixa automática de
-- consumo, ajuste de contagem). O "custo médio atual" e o "valor total
-- em estoque" nunca são colunas próprias — são sempre derivados por
-- soma a partir dos movimentos (mesma filosofia já usada por
-- inventory_balances pra quantidade), eliminando qualquer risco de
-- desvio (drift) entre um valor guardado e a soma real dos movimentos.

alter table inventory_movements
  add column unit_cost numeric(14,6),
  add column total_value numeric(12,2);

-- Pra uma COMPRA: usa o custo líquido já calculado na despesa (subtotal,
-- já com desconto/frete/tributo não recuperável aplicados — Módulo
-- Contábil Leva 2), não o unit_cost bruto da nota. Pra qualquer outro
-- tipo de movimento (baixa manual, baixa automática de consumo, ajuste de
-- contagem): usa o custo médio vigente ANTES deste movimento — numa
-- trigger `before insert`, consultar a própria tabela reflete exatamente
-- o estado "antes", já que esta linha ainda não foi gravada.
-- `security definer` (mesmo padrão de toda trigger deste schema): quem
-- dispara o insert pode ser uma camareira (baixa manual) sem acesso de
-- leitura a `expense_items`, mas o cálculo do custo médio só lê
-- `inventory_movements` (liberado a qualquer autenticado) — e, no caso
-- 'compra', o próprio insert sempre vem de uma trigger já security
-- definer (create_movement_from_expense_item), então não há ganho real
-- de permissão aqui, só consistência com o padrão do arquivo.
create or replace function compute_inventory_movement_value() returns trigger as $$
declare
  v_subtotal numeric;
  v_exp_qty numeric;
  v_avg_cost numeric;
begin
  if new.movement_type = 'compra' then
    select subtotal, quantity into v_subtotal, v_exp_qty
    from expense_items where id = new.reference_expense_item_id;

    new.total_value := coalesce(v_subtotal, 0);
    new.unit_cost := case when coalesce(v_exp_qty, 0) > 0 then round(v_subtotal / v_exp_qty, 6) else 0 end;
  else
    select coalesce(sum(total_value), 0) / nullif(sum(quantity), 0)
    into v_avg_cost
    from inventory_movements
    where inventory_item_id = new.inventory_item_id;

    new.unit_cost := coalesce(v_avg_cost, 0);
    new.total_value := round(new.quantity * coalesce(v_avg_cost, 0), 2);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger inventory_movements_compute_value
before insert on inventory_movements
for each row execute function compute_inventory_movement_value();

-- Backfill dos movimentos já existentes (dado real, nunca zerado) — a
-- mesma lógica acima, aplicada em ORDEM CRONOLÓGICA por item, já que o
-- custo médio de um movimento depende dos movimentos anteriores dele
-- (nunca pode ser feito com um UPDATE em lote só, sem ordem).
do $$
declare
  v_item record;
  v_mv record;
  v_balance numeric;
  v_value numeric;
  v_subtotal numeric;
  v_exp_qty numeric;
  v_unit_cost numeric;
  v_total_value numeric;
begin
  for v_item in select id from inventory_items loop
    v_balance := 0;
    v_value := 0;
    for v_mv in
      select id, movement_type, quantity, reference_expense_item_id
      from inventory_movements
      where inventory_item_id = v_item.id
      order by created_at, id
    loop
      if v_mv.movement_type = 'compra' then
        select subtotal, quantity into v_subtotal, v_exp_qty
        from expense_items where id = v_mv.reference_expense_item_id;
        v_total_value := coalesce(v_subtotal, 0);
        v_unit_cost := case when coalesce(v_exp_qty, 0) > 0 then round(v_subtotal / v_exp_qty, 6) else 0 end;
      else
        v_unit_cost := case when v_balance > 0 then round(v_value / v_balance, 6) else 0 end;
        v_total_value := round(v_mv.quantity * v_unit_cost, 2);
      end if;

      update inventory_movements set unit_cost = v_unit_cost, total_value = v_total_value where id = v_mv.id;

      v_balance := v_balance + v_mv.quantity;
      v_value := v_value + v_total_value;
    end loop;
  end loop;
end $$;

alter table inventory_movements alter column unit_cost set not null;
alter table inventory_movements alter column total_value set not null;

-- inventory_balances ganha o valor monetário total e o custo médio atual
-- (derivados, nunca materializados à parte) — extensão, não substitui as
-- colunas já existentes; todo código que já lê "balance" continua
-- funcionando sem mudança.
create or replace view inventory_balances
with (security_invoker = true) as
select
  inventory_item_id,
  coalesce(sum(quantity), 0) as balance,
  coalesce(sum(total_value), 0) as value,
  case when coalesce(sum(quantity), 0) > 0 then sum(total_value) / sum(quantity) else 0 end as avg_cost
from inventory_movements
group by inventory_item_id;

-- ===================== 072_estoque_baixa_no_pedido.sql =====================
-- Módulo Contábil — Leva 4: o estoque de bar/frigobar desce no momento
-- do PEDIDO/lançamento, não mais só quando a conta do quarto é paga.
-- Ver PRD_compras&contabil.md seção 26. Mudança de comportamento
-- confirmada explicitamente com o proprietário (PRD_compras&contabil.md
-- seção 22.3 item 4), ciente de que é um sistema em produção.

-- ---------- 1. CATCH-UP: consumo já lançado antes desta migration, em
-- contas ainda não pagas ----------
-- Sem isso, esse consumo nunca seria baixado: o gatilho antigo (baixa só
-- no pagamento) está sendo removido nesta mesma migration, e o novo
-- mecanismo (baixa no pedido) só vale pra lançamentos NOVOS a partir de
-- agora. Mesma lógica de sempre (ficha técnica via inventory_item_recipes),
-- só que rodando uma vez só, pra tudo que já existe, como se tivesse
-- acabado de acontecer. Bills já 'paga' NÃO entram aqui — já foram
-- corretamente baixadas no pagamento, sob o mecanismo antigo.
insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
select r.inventory_item_id, 'baixa_consumo_hospede',
  -(mbi.quantity * r.portions_count * r.amount_per_portion), mbi.bill_id,
  'Baixa de transição — Módulo Contábil Leva 4 (frigobar já lançado antes da mudança)'
from room_bill_minibar_items mbi
join room_bills b on b.id = mbi.bill_id and b.status <> 'paga'
join inventory_item_recipes r on r.minibar_item_id = mbi.minibar_item_id
where mbi.quantity > 0;

insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
select r.inventory_item_id, 'baixa_consumo_hospede',
  -sum(bci.quantity * r.portions_count * r.amount_per_portion), bc.bill_id,
  'Baixa de transição — Módulo Contábil Leva 4 (comanda já lançada antes da mudança)'
from bar_comanda_items bci
join bar_comandas bc on bc.id = bci.comanda_id
join room_bills b on b.id = bc.bill_id and b.status <> 'paga'
join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
where bc.status <> 'cancelada' and bci.quantity > 0
group by r.inventory_item_id, bc.bill_id;

-- ---------- 2. Remove o mecanismo antigo (baixa no pagamento) ----------
drop trigger if exists room_bills_deduct_inventory on room_bills;
drop function if exists deduct_inventory_on_bill_payment();

-- ---------- 3. Frigobar: baixa/estorno atômico no momento do lançamento ----------
-- Substitui o upsert direto que existia em setMinibarConsumption — ler a
-- quantidade antiga, calcular o delta e gravar a nova precisam acontecer
-- juntos, sem brecha pra condição de corrida (duas chamadas concorrentes
-- lendo a mesma quantidade "antiga" ao mesmo tempo). `security definer`
-- igual a toda transição de estado sensível deste schema.
create or replace function set_minibar_consumption(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_bill_status room_bill_status;
  v_price numeric;
  v_old_quantity int;
  v_new_quantity int;
  v_delta int;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;

  select status into v_bill_status from room_bills where id = p_bill_id for update;
  if v_bill_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_bill_status = 'fechada' then
    raise exception 'A conta desta suíte está fechada. Não é possível registrar consumo.';
  end if;

  select price into v_price from minibar_items where id = p_minibar_item_id;
  if v_price is null then
    raise exception 'Item de frigobar não encontrado.';
  end if;

  select quantity into v_old_quantity
  from room_bill_minibar_items
  where bill_id = p_bill_id and minibar_item_id = p_minibar_item_id
  for update;
  v_old_quantity := coalesce(v_old_quantity, 0);
  v_new_quantity := greatest(0, p_quantity);

  insert into room_bill_minibar_items (bill_id, minibar_item_id, quantity, price_snapshot, updated_at)
  values (p_bill_id, p_minibar_item_id, v_new_quantity, v_price, now())
  on conflict (bill_id, minibar_item_id)
  do update set quantity = excluded.quantity, price_snapshot = excluded.price_snapshot, updated_at = excluded.updated_at;

  v_delta := v_new_quantity - v_old_quantity;
  if v_delta <> 0 then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(v_delta * r.portions_count * r.amount_per_portion), p_bill_id,
      case when v_delta > 0
        then 'Baixa automática ao lançar consumo de frigobar'
        else 'Estorno de estoque — frigobar reduzido'
      end
    from inventory_item_recipes r
    where r.minibar_item_id = p_minibar_item_id;
  end if;
end;
$$ language plpgsql security definer;

-- ---------- 4. Comandas: baixa no pedido, estorno na edição, baixa/estorno condicional no cancelamento ----------

create or replace function submit_comanda(p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
returns uuid as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_comanda_id uuid;
  v_next_seq int;
  v_next_monthly int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select id, status into v_bill_id, v_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_bill_id, v_bill_status;
  end if;

  if v_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_next_seq
  from bar_comandas where bill_id = v_bill_id;

  select coalesce(max(monthly_number), 0) + 1 into v_next_monthly
  from bar_comandas
  where created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  insert into bar_comandas (room_id, bill_id, sequence_number, monthly_number, status, created_by, last_action_by)
  values (p_room_id, v_bill_id, v_next_seq, v_next_monthly, 'original', auth.uid(), auth.uid())
  returning id into v_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select v_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  -- Baixa de estoque no momento do pedido (Módulo Contábil Leva 4) — via
  -- ficha técnica, mesma soma por ingrediente de sempre.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
    'Baixa automática ao registrar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = v_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  return v_comanda_id;
end;
$$ language plpgsql security definer;

-- Edita uma comanda existente: pode trocar o quarto (e, com ele, a conta e
-- a numeração passam a ser as do novo quarto) e substitui todos os itens
-- pelos informados. Bloqueia se a comanda já foi cancelada, se a conta
-- atual da comanda está fechada ou já foi paga, ou se a conta de destino
-- está fechada. Desde o Módulo Contábil Leva 4: estorna o estoque dos
-- itens ANTIGOS antes de apagá-los, e baixa de novo pelos itens NOVOS —
-- o efeito líquido é o delta, igual já acontecia implicitamente com o
-- valor financeiro da comanda.
create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
returns void as $$
declare
  v_old_bill_id uuid;
  v_old_bill_status room_bill_status;
  v_old_comanda_status comanda_status;
  v_old_seq int;
  v_new_bill_id uuid;
  v_new_bill_status room_bill_status;
  v_next_seq int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select c.bill_id, c.status, c.sequence_number, b.status
    into v_old_bill_id, v_old_comanda_status, v_old_seq, v_old_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_old_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_old_comanda_status = 'cancelada' then
    raise exception 'Comanda cancelada não pode ser editada.';
  end if;
  if v_old_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  select id, status into v_new_bill_id, v_new_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_new_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_new_bill_id, v_new_bill_status;
  end if;

  if v_new_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  if v_new_bill_id <> v_old_bill_id then
    select coalesce(max(sequence_number), 0) + 1 into v_next_seq
    from bar_comandas where bill_id = v_new_bill_id;
  else
    v_next_seq := v_old_seq;
  end if;

  -- Estorna o estoque dos itens ANTIGOS (já baixado quando a comanda foi
  -- lançada/editada da última vez) antes de substituí-los.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    sum(bci.quantity * r.portions_count * r.amount_per_portion), v_old_bill_id,
    'Estorno de estoque — comanda editada'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  update bar_comandas
  set room_id = p_room_id,
      bill_id = v_new_bill_id,
      sequence_number = v_next_seq,
      status = 'editada',
      last_action_by = auth.uid(),
      last_action_at = now()
  where id = p_comanda_id;

  delete from bar_comanda_items where comanda_id = p_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select p_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  -- Baixa o estoque dos itens NOVOS.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_new_bill_id,
    'Baixa automática ao editar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;
end;
$$ language plpgsql security definer;

drop function if exists cancel_comanda(uuid);

-- p_ingredients_recovered: desde o Módulo Contábil Leva 4, deixou de ser
-- opcional perguntar isso ao cancelar (PRD_compras&contabil.md seção
-- 22.3 item 4) — o estoque já foi baixado no momento do pedido, então
-- cancelar precisa decidir explicitamente se ele volta (true, prato não
-- chegou a ser preparado) ou fica baixado (false, já foi preparado/
-- perdido). Só restaura na primeira vez que a comanda é de fato
-- cancelada (uma chamada redundante numa já cancelada não restaura de
-- novo).
create or replace function cancel_comanda(p_comanda_id uuid, p_ingredients_recovered boolean)
returns void as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_old_status comanda_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;

  select c.bill_id, c.status, b.status into v_bill_id, v_old_status, v_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';

  if v_old_status <> 'cancelada' and p_ingredients_recovered then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede',
      sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
      'Estorno de estoque — comanda cancelada (ingredientes recuperados)'
    from bar_comanda_items bci
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bci.comanda_id = p_comanda_id and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
end;
$$ language plpgsql security definer;

-- ===================== 073_cafe_da_manha_leva5.sql =====================
-- Módulo Contábil — Leva 5: fórmula de custo do café da manhã. Ver
-- PRD_compras&contabil.md seção 27 e seção 22.3 itens 9/10.

-- "É perecível?" — editável pelo admin, nunca uma lista fixa de nomes
-- (itens perecíveis entram no custo pelo total COMPRADO no período;
-- não-perecíveis entram pelo total BAIXADO manualmente, valorizado pelo
-- custo médio — ver getBreakfastCostForPeriod). Padrão false pra todo
-- item já existente: decisão deliberada de não adivinhar por nome (ex.:
-- "ovo", "fruta") — o admin revisa e marca manualmente os itens
-- relevantes do café da manhã depois do deploy.
alter table inventory_items add column is_perishable boolean not null default false;

-- "Cafés servidos" — um número por DIA (não por suíte). null = usa o
-- total de hóspedes hospedados (soma de daily_breakfast_room_assignments.
-- guest_count) calculado na hora; um valor aqui é sempre um TETO que só
-- pode ser reduzido, nunca aumentado (ver setBreakfastGuestsServed) —
-- nunca persiste o total calculado em si, só o override pra baixo.
alter table daily_breakfast_settings add column guests_served int;

-- ===================== 074_centro_administracao_areas_comuns.sql =====================
-- Módulo Contábil — correção de aderência ao PRD: 5º centro de custo
-- obrigatório. O documento original (PRD_compras&contabil.md, seção 22.1,
-- item 2.1) lista CINCO centros obrigatórios — Hospedagem, Café da manhã,
-- Bar da piscina, Frigobar e "Administração e áreas comuns" (custos
-- administrativos e gastos compartilhados não atribuíveis diretamente a
-- um dos quatro centros anteriores) — e só os quatro primeiros existiam.
--
-- O centro nasce SEM nenhum item de custo ligado: decidir quais itens
-- hoje ligados a Hospedagem/Café da manhã/Bar da piscina passam a ele é
-- uma escolha do proprietário (muda os totais de cada centro nos
-- relatórios, inclusive de períodos passados, já que os vínculos
-- item→centro são lidos ao vivo, sem histórico de vigência).
--
-- Idempotente: cost_centers.name é único, então rodar de novo não duplica.
insert into cost_centers (name, position)
values (
  'Administração e áreas comuns',
  (select coalesce(max(position), 0) + 1 from cost_centers)
)
on conflict (name) do nothing;

-- ===================== 075_itens_administrativos_para_centro_administracao.sql =====================
-- Decisão do proprietário (16/10/2026, resposta à consulta sobre o 5º
-- centro de custo): só os itens claramente ADMINISTRATIVOS passam 100%
-- pro centro "Administração e áreas comuns" (criado na migration 074).
-- Hoje eles estão divididos 34/33/33 entre Bar de piscina, Hospedagem e
-- Café da manhã. Luz, água, internet e demais itens compartilhados
-- FICAM como estão (escolha explícita dele).
--
-- Aviso já dado e aceito: os vínculos item→centro são lidos ao vivo
-- pelos relatórios de custo, então mover um item também re-atribui os
-- períodos passados dele. (Lançamentos contábeis já gravados guardam o
-- centro da época — mas este módulo ainda não foi implantado em
-- produção, então não há lançamento real afetado.)
--
-- Idempotente: apaga os vínculos atuais desses itens e regrava o único
-- vínculo 100% — rodar de novo termina no mesmo estado.
delete from cost_item_centers
where cost_item_id in (
  select id from cost_items
  where name in (
    'Contabilidade (Simone Perla)',
    'Financeiro (Márcia)',
    'Stays (CMS)',
    'Invictos (Comercial e Atendimento)',
    'outras honorários administrativos',
    'pró-labore',
    'impostos e taxas'
  )
);

insert into cost_item_centers (cost_item_id, center_id, alloc_pct)
select ci.id, cc.id, 100
from cost_items ci
cross join cost_centers cc
where cc.name = 'Administração e áreas comuns'
  and ci.name in (
    'Contabilidade (Simone Perla)',
    'Financeiro (Márcia)',
    'Stays (CMS)',
    'Invictos (Comercial e Atendimento)',
    'outras honorários administrativos',
    'pró-labore',
    'impostos e taxas'
  );

-- ===================== 076_cadastro_de_produtos.sql =====================
-- Módulo Contábil — correção de aderência ao PRD: Cadastro de produtos
-- (PRD_compras&contabil.md, seção 22.1 item 5.1). Decisões do
-- proprietário (16/10/2026): tela única que edita, juntos, o item de
-- custo e o item de estoque ligado a ele ("produto" = os dois);
-- "Plano de itens de custo" fica pros gastos que não são produtos
-- (salário, luz, honorários) e mostra os produtos só pra consulta.
--
-- Esta migration cobre os campos do produto. Unidades/conversões
-- (077) e validade por lote (078) vêm em migrations próprias.

-- Tipo de produto (lista fechada do PRD). null = "não classificado" —
-- os itens que já existem começam assim até o admin classificar.
create type product_type as enum (
  'revenda',
  'ingrediente_receita',
  'material_consumo',
  'material_limpeza',
  'embalagem',
  'outro'
);

-- Categorias de produto: lista própria, editável pelo admin. Começa com
-- os nomes dos antigos subcentros do Plano de Contas (migration 065),
-- que o próprio proprietário já tinha curado — nada de começar do zero.
create table product_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index product_categories_name_uq on product_categories (lower(name));

alter table product_categories enable row level security;
create policy "product_categories_select_authenticated" on product_categories for select using (auth.uid() is not null);
create policy "product_categories_admin_write" on product_categories for all using (is_admin()) with check (is_admin());

-- Um produto É um item de custo (sempre) mais, quando controla estoque,
-- o item de estoque ligado a ele. Os campos descritivos moram no item de
-- custo — assim produtos que NÃO controlam estoque (ex.: taças,
-- ferramentas) também têm SKU/descrição/categoria/tipo.
alter table cost_items
  add column is_product boolean not null default false,
  add column sku text,
  add column description text,
  add column category_id uuid references product_categories(id) on delete set null,
  add column product_type product_type;

-- Todo item que controla estoque já é, de fato, um produto. Os demais
-- (despesas e serviços) continuam fora do cadastro até o admin promovê-los.
update cost_items set is_product = true where is_inventory;

-- SKU único (ignorando maiúscula/minúscula) quando preenchido.
create unique index cost_items_sku_uq on cost_items (lower(sku)) where sku is not null;

-- Invariante garantida no banco, não em cada tela: item que controla
-- estoque é sempre produto (mesmo padrão de gatilho usado no resto do
-- schema — nenhum ponto de criação, incluindo "criar item novo" dentro
-- de "Lançar compras e despesas", pode esquecer disso).
create or replace function cost_items_set_product_flag() returns trigger as $$
begin
  if new.is_inventory then
    new.is_product := true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger cost_items_product_flag
before insert or update on cost_items
for each row execute function cost_items_set_product_flag();

-- Categorias iniciais (nomes dos antigos subcentros que classificavam
-- itens de estoque).
insert into product_categories (name, position) values
  ('Alimentos', 1),
  ('Bebidas', 2),
  ('Materiais de limpeza', 3),
  ('Materiais das suítes', 4),
  ('Enxoval de cama e banho', 5),
  ('Materiais de Piscina', 6),
  ('Materiais de Manutenção', 7);

-- Categoria de cada item de estoque já existente, a partir do antigo
-- subcentro dele na migration 065 (item em mais de 1 subcentro: vale o
-- primeiro). Casa por nome; item cujo nome o admin mudou depois, ou
-- criado depois do seed, fica sem categoria até ser classificado na tela.
with seed(item_name, category_name) as (
  values
  ('amenities', 'Materiais das suítes'),
  ('travesseiros', 'Materiais das suítes'),
  ('papel higiênico', 'Materiais das suítes'),
  ('sacos de lixo', 'Materiais das suítes'),
  ('secador de cabelo', 'Materiais das suítes'),
  ('toalhas de banho', 'Enxoval de cama e banho'),
  ('toalhas de rosto', 'Enxoval de cama e banho'),
  ('lençóis', 'Enxoval de cama e banho'),
  ('fronhas', 'Enxoval de cama e banho'),
  ('capas protetoras de travesseiro', 'Enxoval de cama e banho'),
  ('capas protetoras de colchão', 'Enxoval de cama e banho'),
  ('outros materiais de piscina', 'Materiais de Piscina'),
  ('cloro', 'Materiais de Piscina'),
  ('clarificante', 'Materiais de Piscina'),
  ('barrilha', 'Materiais de Piscina'),
  ('pastilhas de cloro', 'Materiais de Piscina'),
  ('fluidos de medidores', 'Materiais de Piscina'),
  ('toalhas de piscina', 'Materiais de Piscina'),
  ('lâmpadas', 'Materiais de Manutenção'),
  ('fita isolante', 'Materiais de Manutenção'),
  ('fita veda rosca', 'Materiais de Manutenção'),
  ('cola de cano', 'Materiais de Manutenção'),
  ('silicone', 'Materiais de Manutenção'),
  ('lubrificantes', 'Materiais de Manutenção'),
  ('antioxidantes', 'Materiais de Manutenção'),
  ('peças de reposição', 'Materiais de Manutenção'),
  ('tomadas', 'Materiais de Manutenção'),
  ('interruptores', 'Materiais de Manutenção'),
  ('outros materiais elétricos', 'Materiais de Manutenção'),
  ('outros materiais hidráulicos', 'Materiais de Manutenção'),
  ('tintas de parede', 'Materiais de Manutenção'),
  ('carrinho de mão', 'Materiais de Manutenção'),
  ('detergente', 'Materiais de limpeza'),
  ('álcool', 'Materiais de limpeza'),
  ('água sanitária', 'Materiais de limpeza'),
  ('desinfetante', 'Materiais de limpeza'),
  ('veja multiuso', 'Materiais de limpeza'),
  ('limpa vidros', 'Materiais de limpeza'),
  ('baldes', 'Materiais de limpeza'),
  ('vassouras', 'Materiais de limpeza'),
  ('rodos', 'Materiais de limpeza'),
  ('sabão líquido', 'Materiais de limpeza'),
  ('sabão em pó', 'Materiais de limpeza'),
  ('sabão em barra', 'Materiais de limpeza'),
  ('café', 'Alimentos'),
  ('chocolate', 'Alimentos'),
  ('farinha de trigo', 'Alimentos'),
  ('manteiga', 'Alimentos'),
  ('margarina', 'Alimentos'),
  ('requeijão', 'Alimentos'),
  ('cream cheese', 'Alimentos'),
  ('croissants', 'Alimentos'),
  ('pães', 'Alimentos'),
  ('açúcar', 'Alimentos'),
  ('sal', 'Alimentos'),
  ('adoçante', 'Alimentos'),
  ('mel', 'Alimentos'),
  ('linguiças', 'Alimentos'),
  ('bacon', 'Alimentos'),
  ('queijos', 'Alimentos'),
  ('presuntos', 'Alimentos'),
  ('farinha de tapioca', 'Alimentos'),
  ('farinha de cuscuz', 'Alimentos'),
  ('carnes', 'Alimentos'),
  ('camarões', 'Alimentos'),
  ('macaxeira', 'Alimentos'),
  ('batatas fritas', 'Alimentos'),
  ('massa de pastel', 'Alimentos'),
  ('bolinhos de bacalhau', 'Alimentos'),
  ('Vodka Smirnoff', 'Bebidas'),
  ('Vodka Absolut', 'Bebidas'),
  ('Cachaça', 'Bebidas'),
  ('Campari', 'Bebidas'),
  ('Gim Tanqueray', 'Bebidas'),
  ('Água de Coco', 'Bebidas'),
  ('Água com gás', 'Bebidas'),
  ('Água sem gás', 'Bebidas'),
  ('Refrigerante', 'Bebidas'),
  ('Cerveja', 'Bebidas'),
  ('Café expresso', 'Bebidas')
)
update cost_items ci
set category_id = pc.id
from seed s
join product_categories pc on lower(pc.name) = lower(s.category_name)
where lower(ci.name) = lower(s.item_name)
  and ci.is_product;

-- ===================== 077_unidades_conversoes_validade.sql =====================
-- Cadastro de produtos (PRD 5.1) — unidades/conversões e validade por lote.
-- Decisões do proprietário (16/10/2026): conversões valem de verdade em
-- compras e fichas técnicas; validade por lote com alerta.
--
-- Princípio: quantity/unit_cost de expense_items e amount_per_portion
-- das fichas continuam SEMPRE na unidade-base do item (todo leitor
-- existente segue valendo). O que o usuário digitou (24 garrafas a R$18)
-- fica em colunas informativas à parte.

-- "1 garrafa = 0,75 (unidade-base do item)".
create table inventory_item_unit_conversions (
  id uuid primary key default uuid_generate_v4(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  unit_name text not null,
  factor numeric(14,6) not null check (factor > 0),
  created_at timestamptz not null default now()
);
create unique index inventory_item_unit_conversions_uq on inventory_item_unit_conversions (inventory_item_id, lower(unit_name));

alter table inventory_item_unit_conversions enable row level security;
create policy "unit_conv_select_authenticated" on inventory_item_unit_conversions for select using (auth.uid() is not null);
create policy "unit_conv_admin_write" on inventory_item_unit_conversions for all using (is_admin()) with check (is_admin());

-- Custo por unidade-base pode ter muitas casas (ex.: R$0,024/ml).
alter table expense_items alter column unit_cost type numeric(14,6);
alter table expense_items
  add column purchase_quantity numeric(12,3),
  add column purchase_unit text,
  add column purchase_unit_cost numeric(14,6),
  add column expiry_date date;

-- Unidade em que a quantidade da ficha foi digitada (só exibição; o
-- valor guardado, amount_per_portion, é sempre na unidade-base).
alter table inventory_item_recipes add column display_unit text;

-- Validade: prazo do produto em dias (null = não se aplica) e quantos
-- dias antes do vencimento o sistema avisa.
alter table inventory_items
  add column shelf_life_days int check (shelf_life_days is null or shelf_life_days > 0),
  add column expiry_alert_days int not null default 7 check (expiry_alert_days >= 0);

-- ===================== 078_motor_lancamentos_automaticos.sql =====================
-- 078: motor de lançamentos automáticos (partidas dobradas) para TODO fato
-- contábil — compra/despesa (já existia, agora com item e café), consumo de
-- bar/frigobar (custo no estoque + receita no fechamento da conta +
-- recebimento no pagamento), baixa manual e ajuste de inventário. Tudo por
-- gatilho no banco, pra nenhum ponto de escrita poder esquecer.

-- ---------- Item de custo em cada linha do livro ----------
alter table ledger_entry_lines add column if not exists cost_item_id uuid references cost_items(id) on delete set null;
create index if not exists ledger_entry_lines_cost_item_idx on ledger_entry_lines (cost_item_id);

-- Núcleo do lançamento (sem checagem de usuário — usado por gatilhos).
create or replace function post_ledger_entry_core(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb,
  p_created_by uuid
) returns uuid as $$
declare
  v_entry_id uuid;
  v_total_debito numeric := 0;
  v_total_credito numeric := 0;
  v_line jsonb;
  v_line_count int;
begin
  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_line_count < 2 then
    raise exception 'Um lançamento precisa de pelo menos 2 linhas (1 débito e 1 crédito).';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line->>'direction') = 'debito' then
      v_total_debito := v_total_debito + (v_line->>'amount')::numeric;
    elsif (v_line->>'direction') = 'credito' then
      v_total_credito := v_total_credito + (v_line->>'amount')::numeric;
    else
      raise exception 'direction inválida: %', v_line->>'direction';
    end if;
  end loop;

  if abs(v_total_debito - v_total_credito) > 0.01 then
    raise exception 'Lançamento desbalanceado: débitos % ≠ créditos %', v_total_debito, v_total_credito;
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, created_by)
  values (p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, p_created_by)
  returning id into v_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, cost_item_id, direction, amount)
  select
    v_entry_id,
    la.id,
    nullif(elem->>'cost_center_id', '')::uuid,
    nullif(elem->>'cost_item_id', '')::uuid,
    (elem->>'direction')::ledger_entry_direction,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_lines) elem
  join ledger_accounts la on la.code = (elem->>'account_code');

  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(*) from ledger_entry_lines where entry_id = v_entry_id) then
    raise exception 'Uma ou mais contas (account_code) não foram encontradas no plano de contas.';
  end if;

  return v_entry_id;
end;
$$ language plpgsql security definer;
revoke execute on function post_ledger_entry_core(date, date, date, text, text, text, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function post_ledger_entry(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
) returns uuid as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  return post_ledger_entry_core(p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, p_lines, auth.uid());
end;
$$ language plpgsql security definer;

create or replace function reverse_ledger_entry_core(p_entry_id uuid, p_reason text, p_created_by uuid) returns uuid as $$
declare
  v_new_entry_id uuid;
  v_original ledger_entries%rowtype;
begin
  select * into v_original from ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;
  if v_original.status = 'estornado' then
    raise exception 'Este lançamento já foi estornado.';
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, reverses_entry_id, created_by)
  values ((now() at time zone 'America/Sao_Paulo')::date, v_original.document_date, v_original.cash_date, coalesce(p_reason, 'Estorno de: ' || v_original.description), 'estorno', v_original.source_type, v_original.source_id, p_entry_id, p_created_by)
  returning id into v_new_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, cost_item_id, direction, amount)
  select v_new_entry_id, l.account_id, l.cost_center_id, l.cost_item_id,
    (case when l.direction = 'debito' then 'credito' else 'debito' end)::ledger_entry_direction, l.amount
  from ledger_entry_lines l
  where l.entry_id = p_entry_id;

  update ledger_entries set status = 'estornado' where id = p_entry_id;
  return v_new_entry_id;
end;
$$ language plpgsql security definer;
revoke execute on function reverse_ledger_entry_core(uuid, text, uuid) from public, anon, authenticated;

create or replace function reverse_ledger_entry(p_entry_id uuid, p_reason text) returns uuid as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  return reverse_ledger_entry_core(p_entry_id, p_reason, auth.uid());
end;
$$ language plpgsql security definer;

-- ---------- Colunas novas ----------
-- Destino do consumo/baixa: centro de custo onde o ativo foi consumido.
alter table inventory_movements add column if not exists consumption_center_id uuid references cost_centers(id) on delete set null;
-- Baixa manual por perda/quebra (vai pra "Perdas e desperdícios") em vez de consumo.
alter table inventory_movements add column if not exists is_loss boolean not null default false;
-- Linha de compra destinada ao café da manhã: custo reconhecido na compra, não entra no estoque.
alter table expense_items add column if not exists for_breakfast boolean not null default false;
-- Rateio próprio desta linha de despesa (substitui o rateio padrão do item de custo): [{center_id, alloc_pct}].
alter table expense_items add column if not exists center_split jsonb;

-- Gatilho BEFORE: carimba o centro de consumo vindo das funções de bar/frigobar.
create or replace function set_movement_consumption_center() returns trigger as $$
declare
  v_name text;
begin
  if new.consumption_center_id is null and new.movement_type = 'baixa_consumo_hospede' then
    v_name := nullif(current_setting('app.consumption_center', true), '');
    if v_name is not null then
      select id into new.consumption_center_id from cost_centers where name = v_name;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists inventory_movements_consumption_center on inventory_movements;
create trigger inventory_movements_consumption_center
before insert on inventory_movements
for each row execute function set_movement_consumption_center();

-- ---------- Lançamento automático de cada movimento de estoque ----------
create or replace function post_inventory_movement_ledger() returns trigger as $$
declare
  v_cost_item_id uuid;
  v_ledger_code text;
  v_stock_account text;
  v_counter text;
  v_center uuid;
  v_center_name text;
  v_value numeric;
  v_item_name text;
  v_origin text;
  v_desc text;
  v_date date;
  v_lines jsonb;
begin
  if new.movement_type = 'compra' then
    return new;
  end if;
  v_value := round(abs(new.total_value), 2);
  if v_value <= 0 then
    return new;
  end if;

  select ci.id, ci.ledger_account_code into v_cost_item_id, v_ledger_code
  from cost_items ci where ci.inventory_item_id = new.inventory_item_id limit 1;
  v_stock_account := coalesce(v_ledger_code, 'estoque-outros');
  select name into v_item_name from inventory_items where id = new.inventory_item_id;
  v_date := (new.created_at at time zone 'America/Sao_Paulo')::date;
  v_center := new.consumption_center_id;
  select name into v_center_name from cost_centers where id = v_center;

  if new.movement_type = 'baixa_consumo_hospede' then
    v_origin := 'consumo';
    v_desc := case when new.total_value < 0 then 'Consumo de ' else 'Estorno de consumo de ' end
      || coalesce(lower(v_center_name), 'bar/frigobar') || ' — ' || coalesce(v_item_name, 'item');
    if v_center_name = 'Frigobar' then
      v_counter := 'cmv-bebidas-frigobar';
    else
      v_counter := case v_stock_account
        when 'estoque-bebidas' then 'cmv-bebidas-bar'
        when 'estoque-alimentos' then 'custo-petiscos-bar'
        else 'custo-drinks-bar' end;
    end if;
  elsif new.movement_type = 'baixa_manual' then
    v_origin := 'baixa-manual';
    if new.is_loss then
      v_desc := 'Perda/quebra de estoque — ' || coalesce(v_item_name, 'item');
      v_counter := 'perdas-estoque';
    else
      v_desc := 'Baixa manual de estoque — ' || coalesce(v_item_name, 'item') || coalesce(' (' || v_center_name || ')', '');
      v_counter := case v_center_name
        when 'Café da manhã' then 'custo-cafe-manha'
        when 'Frigobar' then 'cmv-bebidas-frigobar'
        when 'Hospedagem' then 'materiais-limpeza-hospedagem'
        when 'Administração e áreas comuns' then 'material-administrativo'
        when 'Bar de piscina' then (case v_stock_account
          when 'estoque-bebidas' then 'cmv-bebidas-bar'
          when 'estoque-alimentos' then 'custo-petiscos-bar'
          else 'custo-drinks-bar' end)
        else 'perdas-estoque' end;
    end if;
  elsif new.movement_type = 'ajuste_contagem' then
    v_origin := 'inventario';
    v_desc := case when new.total_value < 0 then 'Ajuste de inventário (falta) — ' else 'Ajuste de inventário (sobra) — ' end || coalesce(v_item_name, 'item');
    v_counter := 'perdas-estoque';
  else
    return new;
  end if;

  -- Perdas/ajustes sem destino explícito: usa o centro principal do item.
  if v_center is null and v_cost_item_id is not null then
    select center_id into v_center from cost_item_centers where cost_item_id = v_cost_item_id order by alloc_pct desc limit 1;
  end if;

  if new.total_value < 0 then
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_counter, 'cost_center_id', v_center, 'cost_item_id', v_cost_item_id, 'direction', 'debito', 'amount', v_value),
      jsonb_build_object('account_code', v_stock_account, 'cost_center_id', null, 'cost_item_id', v_cost_item_id, 'direction', 'credito', 'amount', v_value));
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_stock_account, 'cost_center_id', null, 'cost_item_id', v_cost_item_id, 'direction', 'debito', 'amount', v_value),
      jsonb_build_object('account_code', v_counter, 'cost_center_id', v_center, 'cost_item_id', v_cost_item_id, 'direction', 'credito', 'amount', v_value));
  end if;

  perform post_ledger_entry_core(v_date, v_date, null, v_desc, v_origin, 'inventory_movements', new.id, v_lines, new.created_by);
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists inventory_movements_post_ledger on inventory_movements;
create trigger inventory_movements_post_ledger
after insert on inventory_movements
for each row execute function post_inventory_movement_ledger();

-- ---------- Receita do consumo (fechamento) e recebimento (pagamento) ----------
create or replace function post_room_bill_ledger() returns trigger as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_amount numeric;
  v_bar_center uuid;
  v_frigo_center uuid;
  v_bar_total numeric := 0;
  v_service numeric;
  v_rec record;
  v_entry_id uuid;
  v_suite text;
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cash text;
begin
  if new.status = old.status then
    return new;
  end if;

  select number into v_suite from rooms where id = new.room_id;
  select id into v_bar_center from cost_centers where name = 'Bar de piscina';
  select id into v_frigo_center from cost_centers where name = 'Frigobar';

  if new.status = 'fechada' then
    for v_rec in
      select
        case
          when pi.category = 'Petiscos' then 'receita-petiscos-bar'
          when lower(pi.name) in ('água com gás', 'água sem gás', 'água de coco', 'café expresso', 'campari', 'cerveja', 'refrigerante') then 'receita-bebidas-bar'
          else 'receita-drinks-bar'
        end as account_code,
        sum(bci.quantity * bci.price_snapshot) as amount
      from bar_comanda_items bci
      join bar_comandas c on c.id = bci.comanda_id
      join poolbar_items pi on pi.id = bci.poolbar_item_id
      where c.bill_id = new.id and c.status <> 'cancelada' and bci.quantity > 0
      group by 1
    loop
      v_amount := round(v_rec.amount, 2);
      if v_amount > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', v_rec.account_code, 'cost_center_id', v_bar_center, 'direction', 'credito', 'amount', v_amount));
        v_total := v_total + v_amount;
        v_bar_total := v_bar_total + v_amount;
      end if;
    end loop;

    select round(coalesce(sum(quantity * price_snapshot), 0), 2) into v_amount from room_bill_minibar_items where bill_id = new.id;
    if v_amount > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'receita-bebidas-frigobar', 'cost_center_id', v_frigo_center, 'direction', 'credito', 'amount', v_amount));
      v_total := v_total + v_amount;
    end if;

    if v_bar_total > 0 and not coalesce(new.service_charge_waived, false) then
      v_service := round(v_bar_total * 0.10, 2);
      if v_service > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'salarios-a-pagar', 'cost_center_id', null, 'direction', 'credito', 'amount', v_service));
        v_total := v_total + v_service;
      end if;
    end if;

    if v_total > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('account_code', 'consumos-a-liquidar', 'cost_center_id', null, 'direction', 'debito', 'amount', v_total));
      perform post_ledger_entry_core(v_date, v_date, null, 'Consumo de bar/frigobar — suíte ' || coalesce(v_suite, '?') || ' (conta fechada)', 'consumo-fechamento', 'room_bills', new.id, v_lines, null);
    end if;

  elsif old.status = 'fechada' and new.status = 'reaberta' then
    for v_entry_id in
      select id from ledger_entries where source_type = 'room_bills' and source_id = new.id and origin = 'consumo-fechamento' and status = 'confirmado'
    loop
      perform reverse_ledger_entry_core(v_entry_id, 'Conta reaberta — estorno da receita do consumo (suíte ' || coalesce(v_suite, '?') || ')', null);
    end loop;

  elsif new.status = 'paga' then
    select coalesce(sum(l.amount), 0) into v_total
    from ledger_entries e
    join ledger_entry_lines l on l.entry_id = e.id
    join ledger_accounts a on a.id = l.account_id
    where e.source_type = 'room_bills' and e.source_id = new.id and e.origin = 'consumo-fechamento'
      and e.status = 'confirmado' and a.code = 'consumos-a-liquidar' and l.direction = 'debito';
    if v_total > 0 then
      v_cash := case when new.payment_method = 'dinheiro' then 'caixa' else 'banco' end;
      perform post_ledger_entry_core(v_date, v_date, v_date,
        'Recebimento do consumo — suíte ' || coalesce(v_suite, '?') || coalesce(' (' || new.payment_method::text || ')', ''),
        'recebimento', 'room_bills', new.id,
        jsonb_build_array(
          jsonb_build_object('account_code', v_cash, 'cost_center_id', null, 'direction', 'debito', 'amount', v_total),
          jsonb_build_object('account_code', 'consumos-a-liquidar', 'cost_center_id', null, 'direction', 'credito', 'amount', v_total)),
        null);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists room_bills_post_ledger on room_bills;
create trigger room_bills_post_ledger
after update of status on room_bills
for each row execute function post_room_bill_ledger();

-- ---------- Funções que baixam estoque, agora carimbando o centro de consumo ----------
create or replace function create_movement_from_expense_item() returns trigger as $$
declare
  v_inventory_item_id uuid;
begin
  if new.cost_item_id is not null then
    select inventory_item_id into v_inventory_item_id from cost_items where id = new.cost_item_id;
    if v_inventory_item_id is not null and not new.for_breakfast then
      insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_expense_item_id, created_by)
      values (
        v_inventory_item_id,
        'compra',
        new.quantity,
        new.id,
        (select created_by from expenses where id = new.expense_id)
      );

      update purchase_requests
      set status = 'atendido', updated_at = now()
      where inventory_item_id = v_inventory_item_id and status = 'pendente';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace function submit_comanda(p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
returns uuid as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_comanda_id uuid;
  v_next_seq int;
  v_next_monthly int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  select id, status into v_bill_id, v_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_bill_id, v_bill_status;
  end if;

  if v_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  select coalesce(max(sequence_number), 0) + 1 into v_next_seq
  from bar_comandas where bill_id = v_bill_id;

  select coalesce(max(monthly_number), 0) + 1 into v_next_monthly
  from bar_comandas
  where created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  insert into bar_comandas (room_id, bill_id, sequence_number, monthly_number, status, created_by, last_action_by)
  values (p_room_id, v_bill_id, v_next_seq, v_next_monthly, 'original', auth.uid(), auth.uid())
  returning id into v_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select v_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  -- Baixa de estoque no momento do pedido (Módulo Contábil Leva 4) — via
  -- ficha técnica, mesma soma por ingrediente de sempre.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
    'Baixa automática ao registrar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = v_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  return v_comanda_id;
end;
$$ language plpgsql security definer;

create or replace function edit_comanda(p_comanda_id uuid, p_room_id uuid, p_items jsonb, p_guest_slot room_bill_guest_slot default 'unica')
returns void as $$
declare
  v_old_bill_id uuid;
  v_old_bill_status room_bill_status;
  v_old_comanda_status comanda_status;
  v_old_seq int;
  v_new_bill_id uuid;
  v_new_bill_status room_bill_status;
  v_next_seq int;
  v_item jsonb;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  select c.bill_id, c.status, c.sequence_number, b.status
    into v_old_bill_id, v_old_comanda_status, v_old_seq, v_old_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_old_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_old_comanda_status = 'cancelada' then
    raise exception 'Comanda cancelada não pode ser editada.';
  end if;
  if v_old_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  select id, status into v_new_bill_id, v_new_bill_status
  from room_bills where room_id = p_room_id and guest_slot = p_guest_slot and status <> 'paga'
  for update;

  if v_new_bill_id is null then
    insert into room_bills (room_id, status, guest_slot) values (p_room_id, 'aberta', p_guest_slot)
    returning id, status into v_new_bill_id, v_new_bill_status;
  end if;

  if v_new_bill_status = 'fechada' then
    raise exception 'A conta deste quarto está fechada.';
  end if;

  if v_new_bill_id <> v_old_bill_id then
    select coalesce(max(sequence_number), 0) + 1 into v_next_seq
    from bar_comandas where bill_id = v_new_bill_id;
  else
    v_next_seq := v_old_seq;
  end if;

  update bar_comandas
  set room_id = p_room_id,
      bill_id = v_new_bill_id,
      sequence_number = v_next_seq,
      status = 'editada',
      last_action_by = auth.uid(),
      last_action_at = now()
  where id = p_comanda_id;

  -- Estorna o estoque dos itens ANTIGOS (já baixado quando a comanda foi
  -- lançada/editada da última vez) antes de substituí-los.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    sum(bci.quantity * r.portions_count * r.amount_per_portion), v_old_bill_id,
    'Estorno de estoque — comanda editada'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;

  delete from bar_comanda_items where comanda_id = p_comanda_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::int > 0 then
      insert into bar_comanda_items (comanda_id, poolbar_item_id, quantity, price_snapshot)
      select p_comanda_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::int, pi.price
      from poolbar_items pi where pi.id = (v_item->>'item_id')::uuid;
    end if;
  end loop;

  -- Baixa o estoque dos itens NOVOS.
  insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
  select r.inventory_item_id, 'baixa_consumo_hospede',
    -sum(bci.quantity * r.portions_count * r.amount_per_portion), v_new_bill_id,
    'Baixa automática ao editar a comanda'
  from bar_comanda_items bci
  join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
  where bci.comanda_id = p_comanda_id and bci.quantity > 0
  group by r.inventory_item_id;
end;
$$ language plpgsql security definer;

create or replace function cancel_comanda(p_comanda_id uuid, p_ingredients_recovered boolean)
returns void as $$
declare
  v_bill_id uuid;
  v_bill_status room_bill_status;
  v_old_status comanda_status;
begin
  if not is_camareira() then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Bar de piscina', true);

  select c.bill_id, c.status, b.status into v_bill_id, v_old_status, v_bill_status
  from bar_comandas c
  join room_bills b on b.id = c.bill_id
  where c.id = p_comanda_id
  for update of c;

  if v_bill_id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_bill_status not in ('aberta', 'reaberta') then
    raise exception 'A conta deste quarto está fechada ou já foi paga.';
  end if;

  update bar_comandas
  set status = 'cancelada', last_action_by = auth.uid(), last_action_at = now()
  where id = p_comanda_id and status <> 'cancelada';

  if v_old_status <> 'cancelada' and p_ingredients_recovered then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede',
      sum(bci.quantity * r.portions_count * r.amount_per_portion), v_bill_id,
      'Estorno de estoque — comanda cancelada (ingredientes recuperados)'
    from bar_comanda_items bci
    join inventory_item_recipes r on r.poolbar_item_id = bci.poolbar_item_id
    where bci.comanda_id = p_comanda_id and bci.quantity > 0
    group by r.inventory_item_id;
  end if;
end;
$$ language plpgsql security definer;

create or replace function set_minibar_consumption(p_bill_id uuid, p_minibar_item_id uuid, p_quantity int)
returns void as $$
declare
  v_bill_status room_bill_status;
  v_price numeric;
  v_old_quantity int;
  v_new_quantity int;
  v_delta int;
begin
  if not (is_camareira() or is_admin()) then
    raise exception 'not authorized';
  end if;
  -- Centro de custo onde este consumo acontece (lido pelo gatilho que lança a contabilidade).
  perform set_config('app.consumption_center', 'Frigobar', true);

  select status into v_bill_status from room_bills where id = p_bill_id for update;
  if v_bill_status is null then
    raise exception 'Conta não encontrada.';
  end if;
  if v_bill_status = 'fechada' then
    raise exception 'A conta desta suíte está fechada. Não é possível registrar consumo.';
  end if;

  select price into v_price from minibar_items where id = p_minibar_item_id;
  if v_price is null then
    raise exception 'Item de frigobar não encontrado.';
  end if;

  select quantity into v_old_quantity
  from room_bill_minibar_items
  where bill_id = p_bill_id and minibar_item_id = p_minibar_item_id
  for update;
  v_old_quantity := coalesce(v_old_quantity, 0);
  v_new_quantity := greatest(0, p_quantity);

  insert into room_bill_minibar_items (bill_id, minibar_item_id, quantity, price_snapshot, updated_at)
  values (p_bill_id, p_minibar_item_id, v_new_quantity, v_price, now())
  on conflict (bill_id, minibar_item_id)
  do update set quantity = excluded.quantity, price_snapshot = excluded.price_snapshot, updated_at = excluded.updated_at;

  v_delta := v_new_quantity - v_old_quantity;
  if v_delta <> 0 then
    insert into inventory_movements (inventory_item_id, movement_type, quantity, reference_room_bill_id, notes)
    select r.inventory_item_id, 'baixa_consumo_hospede', -(v_delta * r.portions_count * r.amount_per_portion), p_bill_id,
      case when v_delta > 0
        then 'Baixa automática ao lançar consumo de frigobar'
        else 'Estorno de estoque — frigobar reduzido'
      end
    from inventory_item_recipes r
    where r.minibar_item_id = p_minibar_item_id;
  end if;
end;
$$ language plpgsql security definer;

-- ===================== 079_reclassifica_cadastro_de_despesas.sql =====================
-- 079: reclassifica o antigo "Cadastro de despesas" (que na prática tinha produtos
-- e ferramentas) e liga TODO produto/despesa a uma conta do plano de contas.

-- Categorias novas
insert into product_categories (name, position)
select v.name, (select coalesce(max(position), 0) from product_categories) + v.ord
from (values ('Utensílios e descartáveis', 1), ('Jardinagem', 2)) as v(name, ord)
where not exists (select 1 from product_categories pc where pc.name = v.name);

-- Categoria de ativo permanente para ferramentas
insert into asset_categories (name)
select 'Ferramentas e utensílios duráveis'
where not exists (select 1 from asset_categories where name = 'Ferramentas e utensílios duráveis');

-- 1) Conta do plano de contas dos produtos que já existiam, pela categoria
update cost_items ci set ledger_account_code = case pc.name
    when 'Alimentos' then 'estoque-alimentos'
    when 'Bebidas' then 'estoque-bebidas'
    when 'Enxoval de cama e banho' then 'estoque-limpeza'
    when 'Materiais das suítes' then 'estoque-limpeza'
    when 'Materiais de limpeza' then 'estoque-limpeza'
    else 'estoque-outros' end
from product_categories pc
where ci.category_id = pc.id and ci.is_product and ci.ledger_account_code is null;
update cost_items set ledger_account_code = 'estoque-alimentos'
where is_product and ledger_account_code is null and name ilike 'ovo %';
update cost_items set ledger_account_code = 'estoque-outros' where is_product and ledger_account_code is null;

-- 2) Despesas de verdade: só ligam à conta
update cost_items ci set ledger_account_code = m.code
from (values ('água', 'agua-esgoto'), ('luz', 'energia-eletrica'), ('gás', 'gas'), ('internet', 'internet-telefonia'), ('dedetização', 'limpeza-areas-comuns'), ('limpeza coqueiros', 'jardinagem'), ('encargos', 'mao-de-obra-operacional'), ('plano de saúde', 'mao-de-obra-operacional'), ('cesta básica', 'mao-de-obra-operacional'), ('salário das camareiras', 'mao-de-obra-operacional'), ('salário dos funcionários de manutenção', 'mao-de-obra-operacional'), ('transporte', 'outras-despesas'), ('impostos e taxas', 'outras-despesas'), ('Contabilidade (Simone Perla)', 'contabilidade-servicos'), ('Financeiro (Márcia)', 'pessoal-administrativo'), ('Invictos (Comercial e Atendimento)', 'contabilidade-servicos'), ('Stays (CMS)', 'contabilidade-servicos'), ('outras honorários administrativos', 'contabilidade-servicos'), ('pró-labore', 'pessoal-administrativo')) as m(name, code)
where ci.name = m.name and not ci.is_product;

-- 3) Materiais, alimentos e descartáveis -> viram produtos (estoque centralizado)
do $$
declare
  r record;
  v_inv uuid;
  v_cat uuid;
begin
  for r in
    select * from (values ('bolos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('brioches', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('frutas', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('legumes', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('verduras', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('ovos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('pimenta', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('salgadinhos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('temperos', 'Alimentos', 'ingrediente_receita', 'estoque-alimentos'), ('canudos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('mexedores de drink', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('palitos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('guardanapos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('papéis toalha', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('copos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('pratos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('pires', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('talheres', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('taças', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('xícaras', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('jogos americanos', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('panos de prato', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('utensílios de cozinha', 'Utensílios e descartáveis', 'material_consumo', 'estoque-outros'), ('borrifadores', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('buchas', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('estopas', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('panos de limpeza', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('outros materiais de limpeza', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('perfume de ambiente', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('escovão', 'Materiais de limpeza', 'material_limpeza', 'estoque-limpeza'), ('areia', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('argamassa', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('cabos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('caibros', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('canos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('cimento', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('colas em geral', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conduites', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conectores de mangueiras', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conectores em geral', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('conexões hidráulicas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('eletrodutos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('fio elétrico', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('impermeabilizantes', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('linhas de madeira', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('lixas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('parafusos', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('porcas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('prendedores de toldo', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('rejunte', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('ripas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('tábuas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('telhas', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('toras de eucalipto', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('outros materiais de manutenção', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('mangueiras', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('aspersores', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('filtros', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('torneiras de jardim', 'Materiais de Manutenção', 'material_consumo', 'estoque-outros'), ('adubo', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('plantas', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('remédios de plantas', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('outros materiais de jardinagem', 'Jardinagem', 'material_consumo', 'estoque-outros'), ('outros materiais de irrigação', 'Jardinagem', 'material_consumo', 'estoque-outros')) as m(name, category, ptype, account)
  loop
    if exists (select 1 from cost_items where name = r.name and not is_product) then
      select id into v_cat from product_categories where name = r.category;
      -- categorias antigas ('Materiais de Manutenção') já existem; as demais acabaram de ser criadas acima
      insert into inventory_items (name, unit) values (r.name, 'un') returning id into v_inv;
      update cost_items
      set is_product = true, is_inventory = true, inventory_item_id = v_inv,
          category_id = v_cat, product_type = r.ptype::product_type, ledger_account_code = r.account
      where name = r.name and not is_product;
    end if;
  end loop;
end $$;

-- 4) Ferramentas e equipamentos -> catálogo do ativo permanente
do $$
declare
  r record;
  v_cat uuid;
  v_id uuid;
begin
  select id into v_cat from asset_categories where name = 'Ferramentas e utensílios duráveis';
  for r in select unnest(array['alicates', 'chaves allen', 'chaves de cano', 'chaves de fenda', 'chaves estrela', 'chaves inglesas', 'martelos', 'trenas', 'serrinha', 'escada', 'medidores em geral', 'outras ferramentas de manutenção']) as name loop
    select id into v_id from cost_items where name = r.name and not is_product;
    if v_id is not null then
      insert into fixed_asset_catalog_items (name, category_id)
      select r.name, v_cat
      where not exists (select 1 from fixed_asset_catalog_items where name = r.name and category_id = v_cat);
      if exists (select 1 from expense_items where cost_item_id = v_id) then
        update cost_items set active = false where id = v_id;
      else
        delete from cost_items where id = v_id;
      end if;
    end if;
  end loop;
end $$;

-- ===================== 080_fonte_unica_de_rateio.sql =====================
-- 080: UMA fonte de rateio só. O rateio por lançamento (expense_items.center_split)
-- sai; o rateio do item de custo (cost_item_centers) é o único, editável no
-- cadastro e no Demonstrativo de Custos. Perdas e ajustes de inventário passam
-- a seguir esse rateio (antes usavam só o centro principal).
alter table expense_items drop column if exists center_split;

create or replace function post_inventory_movement_ledger() returns trigger as $$
declare
  v_cost_item_id uuid;
  v_ledger_code text;
  v_stock_account text;
  v_counter text;
  v_center uuid;
  v_center_name text;
  v_value numeric;
  v_item_name text;
  v_origin text;
  v_desc text;
  v_date date;
  v_lines jsonb;
  v_counter_lines jsonb;
  v_rec record;
  v_part numeric;
  v_acc numeric;
  v_i int;
begin
  if new.movement_type = 'compra' then
    return new;
  end if;
  v_value := round(abs(new.total_value), 2);
  if v_value <= 0 then
    return new;
  end if;

  select ci.id, ci.ledger_account_code into v_cost_item_id, v_ledger_code
  from cost_items ci where ci.inventory_item_id = new.inventory_item_id limit 1;
  v_stock_account := coalesce(v_ledger_code, 'estoque-outros');
  select name into v_item_name from inventory_items where id = new.inventory_item_id;
  v_date := (new.created_at at time zone 'America/Sao_Paulo')::date;
  v_center := new.consumption_center_id;
  select name into v_center_name from cost_centers where id = v_center;

  if new.movement_type = 'baixa_consumo_hospede' then
    v_origin := 'consumo';
    v_desc := case when new.total_value < 0 then 'Consumo de ' else 'Estorno de consumo de ' end
      || coalesce(lower(v_center_name), 'bar/frigobar') || ' — ' || coalesce(v_item_name, 'item');
    if v_center_name = 'Frigobar' then
      v_counter := 'cmv-bebidas-frigobar';
    else
      v_counter := case v_stock_account
        when 'estoque-bebidas' then 'cmv-bebidas-bar'
        when 'estoque-alimentos' then 'custo-petiscos-bar'
        else 'custo-drinks-bar' end;
    end if;
  elsif new.movement_type = 'baixa_manual' then
    v_origin := 'baixa-manual';
    if new.is_loss then
      v_desc := 'Perda/quebra de estoque — ' || coalesce(v_item_name, 'item');
      v_counter := 'perdas-estoque';
    else
      v_desc := 'Baixa manual de estoque — ' || coalesce(v_item_name, 'item') || coalesce(' (' || v_center_name || ')', '');
      v_counter := case v_center_name
        when 'Café da manhã' then 'custo-cafe-manha'
        when 'Frigobar' then 'cmv-bebidas-frigobar'
        when 'Hospedagem' then 'materiais-limpeza-hospedagem'
        when 'Administração e áreas comuns' then 'material-administrativo'
        when 'Bar de piscina' then (case v_stock_account
          when 'estoque-bebidas' then 'cmv-bebidas-bar'
          when 'estoque-alimentos' then 'custo-petiscos-bar'
          else 'custo-drinks-bar' end)
        else 'perdas-estoque' end;
    end if;
  elsif new.movement_type = 'ajuste_contagem' then
    v_origin := 'inventario';
    v_desc := case when new.total_value < 0 then 'Ajuste de inventário (falta) — ' else 'Ajuste de inventário (sobra) — ' end || coalesce(v_item_name, 'item');
    v_counter := 'perdas-estoque';
  else
    return new;
  end if;

  -- Contrapartida (custo/perda): se o destino foi escolhido na baixa, vai inteira
  -- pra esse centro; senão (perda, ajuste de inventário) segue o RATEIO do item
  -- de custo — a ÚNICA fonte de rateio do sistema (cost_item_centers).
  v_counter_lines := '[]'::jsonb;
  if v_center is not null or v_cost_item_id is null then
    v_counter_lines := jsonb_build_array(jsonb_build_object('center', v_center, 'amount', v_value));
  else
    v_acc := 0;
    for v_rec in select center_id, alloc_pct from cost_item_centers where cost_item_id = v_cost_item_id order by alloc_pct desc, center_id loop
      v_part := round(v_value * v_rec.alloc_pct / 100, 2);
      v_acc := v_acc + v_part;
      v_counter_lines := v_counter_lines || jsonb_build_array(jsonb_build_object('center', v_rec.center_id, 'amount', v_part));
    end loop;
    if jsonb_array_length(v_counter_lines) = 0 then
      v_counter_lines := jsonb_build_array(jsonb_build_object('center', null, 'amount', v_value));
    elsif v_acc <> v_value then
      -- sobra de arredondamento vai na primeira linha (a de maior percentual)
      v_counter_lines := jsonb_set(v_counter_lines, '{0,amount}', to_jsonb(((v_counter_lines->0->>'amount')::numeric) + (v_value - v_acc)));
    end if;
  end if;

  v_lines := '[]'::jsonb;
  for v_i in 0 .. jsonb_array_length(v_counter_lines) - 1 loop
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_code', v_counter,
      'cost_center_id', v_counter_lines->v_i->>'center',
      'cost_item_id', v_cost_item_id,
      'direction', case when new.total_value < 0 then 'debito' else 'credito' end,
      'amount', (v_counter_lines->v_i->>'amount')::numeric));
  end loop;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_code', v_stock_account,
    'cost_center_id', null,
    'cost_item_id', v_cost_item_id,
    'direction', case when new.total_value < 0 then 'credito' else 'debito' end,
    'amount', v_value));

  perform post_ledger_entry_core(v_date, v_date, null, v_desc, v_origin, 'inventory_movements', new.id, v_lines, new.created_by);
  return new;
end;
$$ language plpgsql security definer;

-- ===================== 082_gerente_operacional_acessos.sql =====================
-- 082: o que o gerente operacional pode ler/gravar no banco. Ele NÃO vira
-- admin: só recebe as permissões das telas que usa (planejamento diário,
-- chegadas e saídas, mesas do café, consumo de bar/frigobar — só leitura —,
-- comissões, lançar compra, lista de compras, validade e baixa de estoque).

create or replace function is_gerente() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'gerente_operacional' and active = true
  );
$$ language sql security definer stable;

create or replace function is_admin_or_gerente() returns boolean as $$
  select is_admin() or is_gerente();
$$ language sql security definer stable;

-- 1) Políticas que já existem e passam a valer também pro gerente.
do $$
declare
  r record;
  v_using text;
  v_check text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (values
        -- planejamento diário
        ('daily_room_tasks', 'drt_admin_all'),
        ('daily_room_task_checks', 'drtc_admin_all'),
        ('daily_room_task_occurrences', 'drto_admin_all'),
        ('daily_room_task_exclusions', 'drte_admin_insert'),
        ('daily_room_task_exclusions', 'drte_admin_delete'),
        -- chegadas e saídas
        ('daily_arrivals', 'da_admin_write'),
        ('daily_arrivals', 'da_admin_update'),
        ('daily_arrivals', 'da_admin_delete'),
        ('daily_departures', 'dd_admin_write'),
        ('daily_departures', 'dd_admin_update'),
        ('daily_departures', 'dd_admin_delete'),
        -- mesas do café
        ('daily_breakfast', 'db_admin_write'),
        ('daily_breakfast', 'db_admin_update'),
        ('daily_breakfast', 'db_admin_delete'),
        ('daily_breakfast_settings', 'dbs_admin_write'),
        ('daily_breakfast_settings', 'dbs_admin_update'),
        ('daily_breakfast_settings', 'dbs_admin_delete'),
        ('daily_breakfast_room_assignments', 'dbra_admin_write'),
        ('daily_breakfast_room_assignments', 'dbra_admin_update'),
        ('daily_breakfast_room_assignments', 'dbra_admin_delete'),
        ('daily_breakfast_room_exclusions', 'dbre_admin_insert'),
        ('daily_breakfast_room_exclusions', 'dbre_admin_delete'),
        ('breakfast_tables', 'bt_admin_update'),
        -- comissões
        ('commission_settings', 'cs_admin_update'),
        ('commission_statements', 'cst_admin_all'),
        ('profiles', 'profiles_select_own_or_admin'),
        -- lançar compra / lista de compras / baixa de estoque / validade
        ('expenses', 'expenses_select_admin_manutencao'),
        ('expenses', 'expenses_insert_admin_manutencao'),
        ('expense_items', 'exp_items_select_admin_manutencao'),
        ('expense_items', 'exp_items_insert_admin_manutencao'),
        ('suppliers', 'suppliers_insert_admin_manutencao'),
        ('fixed_assets', 'fixed_assets_admin_all'),
        ('inventory_movements', 'inv_mov_insert_baixa_manual'),
        ('inventory_suggestion_dismissals', 'inv_suggestion_dismissals_admin_all'),
        ('purchase_requests', 'purchase_req_select_own_or_admin')
      )
  loop
    v_using := case when r.qual is not null then 'using (' || replace(r.qual, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    v_check := case when r.with_check is not null then 'with check (' || replace(r.with_check, 'is_admin()', 'is_admin_or_gerente()') || ')' else '' end;
    execute format('alter policy %I on %I.%I %s %s', r.policyname, r.schemaname, r.tablename, v_using, v_check);
  end loop;
end $$;

-- 2) Telas só de leitura pro gerente (consumo de bar e frigobar, detalhe de
-- serviço, comissões): políticas novas apenas de SELECT.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bar_comandas', 'bar_comanda_items', 'room_bills', 'room_bill_minibar_items',
    'daily_room_task_occurrence_photos'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_gerente_select', t);
    execute format('create policy %I on %I for select using (is_gerente())', t || '_gerente_select', t);
  end loop;
end $$;

-- 3) Nota de qualidade de uma camareira (comissões): o gerente não pode editar
-- o perfil inteiro (senão poderia mudar o próprio papel), só esta nota.
create or replace function set_service_quality_score(p_id uuid, p_score int) returns void as $$
begin
  if not is_admin_or_gerente() then
    raise exception 'not authorized';
  end if;
  if p_score < 0 or p_score > 10 then
    raise exception 'Nota inválida.';
  end if;
  update profiles set service_quality_score = p_score where id = p_id and role = 'camareira';
end;
$$ language plpgsql security definer;

commit;
