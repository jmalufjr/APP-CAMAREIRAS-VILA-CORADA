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
