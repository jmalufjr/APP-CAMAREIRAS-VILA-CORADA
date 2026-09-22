-- Comissão de serviços nas suítes e no café (ver CLAUDE.md Parte 34):
-- nota de qualidade do serviço de cada camareira, um valor único e
-- contínuo por camareira (não é "por mês") — começa em 5, editável pelo
-- admin a qualquer momento, entre 0 e 10.
alter table profiles add column service_quality_score integer not null default 5;
alter table profiles add constraint profiles_service_quality_score_range
  check (service_quality_score between 0 and 10);

-- Demonstrativo de comissão de serviços nas suítes e no café, gerado sob
-- demanda pelo admin (botão "Calcular comissão do mês passado" em
-- /dashboard/comissoes): captura a nota de cada camareira NO MOMENTO do
-- clique, junto com o percentual de serviços e o valor do pote do mês
-- fechado (ambos já naturalmente estáveis — dados de um mês passado não
-- mudam mais, por isso não precisam de congelamento próprio, diferente da
-- nota, que é editável a qualquer momento e por isso precisa ser
-- capturada). Recalcular substitui as linhas daquele mês. A comissão de
-- bar (10%) do mesmo mês não é gravada aqui — é recalculada ao vivo a
-- cada exibição/PDF a partir de bar_comanda_items, já que também é
-- naturalmente estável para um mês fechado.
create table commission_statements (
  id uuid primary key default uuid_generate_v4(),
  month date not null,
  camareira_id uuid references profiles(id) on delete set null,
  camareira_name text not null,
  service_percentage numeric(6,3) not null default 0,
  score integer not null,
  suites_cafe_amount numeric(10,2) not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid references profiles(id) on delete set null,
  unique (month, camareira_id)
);

alter table commission_statements enable row level security;
create policy "cst_admin_all" on commission_statements for all using (is_admin()) with check (is_admin());
