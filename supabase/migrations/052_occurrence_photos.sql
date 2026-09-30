-- Fotos numa ocorrência de manutenção: a camareira pode anexar uma ou mais
-- fotos ao registrar uma ocorrência no checklist, em vez de (ou além de)
-- escrever uma descrição. As fotos ficam guardadas indefinidamente, mesmo
-- depois da ocorrência ser resolvida (viram histórico da tarefa) — só são
-- apagadas se a camareira remover a foto ou a ocorrência inteira antes de
-- liberar a suíte.
create table daily_room_task_occurrence_photos (
  id uuid primary key default uuid_generate_v4(),
  occurrence_id uuid not null references daily_room_task_occurrences(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bug real pré-existente, encontrado ao testar esta mesma parte: nunca
-- existiu uma policy de DELETE pra camareira em daily_room_task_occurrences
-- — o botão "X" de apagar uma ocorrência inteira sempre falhava
-- silenciosamente (RLS bloqueava, 0 linhas afetadas, sem erro nenhum).
create policy "drto_camareira_delete" on daily_room_task_occurrences for delete
  using (exists (select 1 from daily_room_tasks t where t.id = daily_room_task_id and t.assigned_to = auth.uid()));

alter table daily_room_task_occurrence_photos enable row level security;

create policy "drtop_admin_all" on daily_room_task_occurrence_photos for all using (is_admin()) with check (is_admin());
create policy "drtop_camareira_select" on daily_room_task_occurrence_photos for select
  using (exists (
    select 1 from daily_room_task_occurrences o
    join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = occurrence_id and t.assigned_to = auth.uid()
  ));
create policy "drtop_camareira_insert" on daily_room_task_occurrence_photos for insert
  with check (exists (
    select 1 from daily_room_task_occurrences o
    join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = occurrence_id and t.assigned_to = auth.uid()
  ));
create policy "drtop_camareira_delete" on daily_room_task_occurrence_photos for delete
  using (exists (
    select 1 from daily_room_task_occurrences o
    join daily_room_tasks t on t.id = o.daily_room_task_id
    where o.id = occurrence_id and t.assigned_to = auth.uid()
  ));
create policy "drtop_manutencao_select" on daily_room_task_occurrence_photos for select
  using (exists (
    select 1 from daily_room_task_occurrences o
    where o.id = occurrence_id and is_manutencao() and o.status <> 'resolvida'
  ));

-- Bucket privado pra guardar os arquivos das fotos — leitura sempre via URL
-- assinada gerada na hora pelo servidor (nunca um link permanente); upload
-- e leitura sempre pelo client admin/service-role dentro de Server Actions,
-- então nenhuma policy de storage.objects é necessária.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'occurrence-photos',
  'occurrence-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
