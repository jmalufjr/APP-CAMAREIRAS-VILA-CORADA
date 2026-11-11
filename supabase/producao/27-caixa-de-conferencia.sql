-- Caixa de conferencia de compras (PRD_modelo_simplificado.md): notas que
-- chegam do WhatsApp (exportacao da conversa ou, depois, numero oficial)
-- esperam aqui a conferencia do financeiro antes de virar compra.
create table if not exists purchase_inbox (
  id uuid primary key default uuid_generate_v4(),
  source text not null default 'whatsapp_export' check (source in ('whatsapp_export','whatsapp_oficial')),
  -- Impede importar duas vezes a mesma mensagem (exportacoes se sobrepoem).
  dedupe_key text not null unique,
  sender text,
  message_date date not null,
  message_time text,
  note_text text,
  image_storage_path text,
  ai_status text not null default 'pendente' check (ai_status in ('pendente','lida','erro')),
  ai_error text,
  ai_data jsonb,
  status text not null default 'aguardando' check (status in ('aguardando','lancada','descartada')),
  purchase_id uuid references purchases(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchase_inbox_status_idx on purchase_inbox (status, message_date);

alter table purchase_inbox enable row level security;
drop policy if exists purchase_inbox_rw on purchase_inbox;
create policy purchase_inbox_rw on purchase_inbox for all using (is_admin_or_gerente()) with check (is_admin_or_gerente());
