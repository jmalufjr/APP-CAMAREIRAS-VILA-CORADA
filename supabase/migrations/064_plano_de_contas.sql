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
