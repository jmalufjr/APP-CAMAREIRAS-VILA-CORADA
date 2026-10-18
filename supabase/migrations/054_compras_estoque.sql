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
