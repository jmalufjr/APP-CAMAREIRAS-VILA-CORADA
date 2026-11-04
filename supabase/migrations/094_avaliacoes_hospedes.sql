-- Avaliacoes de hospedes (Stays): copia guardada no app (atualizada a cada sincronizacao), resposta
-- registrada pelo admin/gerente e temas citados nos comentarios (lidos pela IA).
create table if not exists guest_reviews (
  id text primary key,                       -- _id da avaliacao na Stays
  day date not null,
  channel text not null,                     -- bookingcom, airbnb, expedia, internal...
  suite_number text,
  guest_name text,
  reservation_code text,
  stays_status text,
  rating numeric(4,2),                       -- nota geral, 0 a 5
  items jsonb not null default '[]',         -- [{key,label,value}] notas por item (0 a 5)
  comments jsonb not null default '[]',      -- [{label,text}]
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  reply_text text,
  replied_by uuid references profiles(id) on delete set null,
  replied_at timestamptz,
  topics_read_at timestamptz                 -- quando a IA leu os comentarios (null = pendente)
);
create index if not exists guest_reviews_day_idx on guest_reviews (day desc);
create index if not exists guest_reviews_first_seen_idx on guest_reviews (first_seen_at desc);

create table if not exists guest_review_topics (
  id bigserial primary key,
  review_id text not null references guest_reviews(id) on delete cascade,
  label text not null,
  polarity text not null check (polarity in ('positivo', 'negativo'))
);
create index if not exists guest_review_topics_review_idx on guest_review_topics (review_id);

alter table guest_reviews enable row level security;
alter table guest_review_topics enable row level security;

-- Leitura para admin e gerente; toda escrita passa por Server Actions (client de servico).
drop policy if exists guest_reviews_select on guest_reviews;
create policy guest_reviews_select on guest_reviews for select using (is_admin_or_gerente());
drop policy if exists guest_review_topics_select on guest_review_topics;
create policy guest_review_topics_select on guest_review_topics for select using (is_admin_or_gerente());
