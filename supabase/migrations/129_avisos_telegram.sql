-- Avisos de nova ocorrência de manutenção pelo Telegram (substitui o aviso push do navegador).

-- Conversas do Telegram ligadas a um usuário (uma pessoa pode ligar mais de uma conversa/aparelho).
create table if not exists telegram_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  chat_id bigint not null unique,
  created_at timestamptz not null default now()
);
create index if not exists telegram_links_user_idx on telegram_links (user_id);

-- Códigos de ligação de uso único (valem 15 minutos): vão no link "Ativar no Telegram".
create table if not exists telegram_link_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null
);

-- Controle do aviso de cada ocorrência em cada conversa: último envio, quantidade e se a pessoa
-- já tocou em "Estou ciente". Enquanto não tocar, o lembrete se repete.
create table if not exists telegram_alerts (
  id uuid primary key default uuid_generate_v4(),
  occurrence_id uuid not null references daily_room_task_occurrences(id) on delete cascade,
  link_id uuid not null references telegram_links(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  send_count int not null default 1,
  last_message_id bigint,
  acknowledged_at timestamptz,
  unique (occurrence_id, link_id)
);

-- Só o servidor (chave de serviço) lê e escreve nestas tabelas.
alter table telegram_links enable row level security;
alter table telegram_link_tokens enable row level security;
alter table telegram_alerts enable row level security;
