-- Avisos (notificações push) de nova ocorrência de manutenção, no celular de quem trabalha na manutenção e do administrador.

-- Aparelhos que ativaram os avisos (um por navegador/aparelho).
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Controle do aviso de cada ocorrência em cada aparelho: quando foi enviado por último, quantas vezes e se a pessoa
-- já dispensou a notificação (ou abriu o app por ela). Enquanto não dispensar, o lembrete se repete.
create table if not exists push_alerts (
  id uuid primary key default uuid_generate_v4(),
  occurrence_id uuid not null references daily_room_task_occurrences(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  send_count int not null default 1,
  acknowledged_at timestamptz,
  unique (occurrence_id, subscription_id)
);

-- Marca as ocorrências cujo primeiro aviso já saiu (as que já existem hoje não geram aviso).
alter table daily_room_task_occurrences add column if not exists push_notified_at timestamptz;
update daily_room_task_occurrences set push_notified_at = now() where push_notified_at is null;

-- Só o servidor (chave de serviço) lê e escreve nestas tabelas.
alter table push_subscriptions enable row level security;
alter table push_alerts enable row level security;
