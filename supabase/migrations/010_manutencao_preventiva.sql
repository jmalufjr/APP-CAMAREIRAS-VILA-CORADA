-- ============================================================================
-- Migração: Manutenção Preventiva (categorias, itens e ciclo de conclusão).
-- Pode ser rodada de uma vez só (os enums usados aqui são todos novos, não
-- há adição de valor a enum já existente, então não precisa de duas etapas).
-- ============================================================================

create type maintenance_execution_type as enum ('nao_tecnico', 'tecnico');
create type maintenance_item_status as enum ('pendente', 'selecionada');

create table maintenance_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table maintenance_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references maintenance_categories(id) on delete cascade,
  label text not null,
  description text,
  execution_type maintenance_execution_type not null,
  periodicity_days int not null check (periodicity_days > 0),
  next_due_date date not null default current_date,
  status maintenance_item_status not null default 'pendente',
  selected_by uuid references profiles(id) on delete set null,
  selected_at timestamptz,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table maintenance_completions (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references maintenance_items(id) on delete cascade,
  due_date date not null,
  completed_by uuid references profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  external_technician_name text,
  created_at timestamptz not null default now()
);

alter table maintenance_categories enable row level security;
alter table maintenance_items enable row level security;
alter table maintenance_completions enable row level security;

create policy "mc_select_authenticated" on maintenance_categories for select using (auth.uid() is not null);
create policy "mc_admin_write" on maintenance_categories for insert with check (is_admin());
create policy "mc_admin_update" on maintenance_categories for update using (is_admin());
create policy "mc_admin_delete" on maintenance_categories for delete using (is_admin());

create policy "mi_select_authenticated" on maintenance_items for select using (auth.uid() is not null);
create policy "mi_admin_write" on maintenance_items for insert with check (is_admin());
create policy "mi_admin_update" on maintenance_items for update using (is_admin());
create policy "mi_admin_delete" on maintenance_items for delete using (is_admin());

create policy "mcomp_select_authenticated" on maintenance_completions for select using (auth.uid() is not null);

create or replace function claim_maintenance_category(cat_id uuid) returns void as $$
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  update maintenance_items
  set status = 'selecionada', selected_by = auth.uid(), selected_at = now()
  where category_id = cat_id
    and active = true
    and status = 'pendente'
    and next_due_date <= (current_date + 1);
end;
$$ language plpgsql security definer;

create or replace function complete_maintenance_nao_tecnico(cat_id uuid) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'nao_tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
  loop
    insert into maintenance_completions (item_id, due_date, completed_by)
    values (r.id, r.next_due_date, auth.uid());

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

create or replace function complete_maintenance_tecnico(cat_id uuid, external_name text) returns void as $$
declare
  r record;
begin
  if not is_manutencao() then
    raise exception 'not authorized';
  end if;
  if external_name is null or btrim(external_name) = '' then
    raise exception 'external technician name is required';
  end if;

  for r in
    select id, next_due_date, periodicity_days
    from maintenance_items
    where category_id = cat_id
      and execution_type = 'tecnico'
      and status = 'selecionada'
      and selected_by = auth.uid()
  loop
    insert into maintenance_completions (item_id, due_date, completed_by, external_technician_name)
    values (r.id, r.next_due_date, auth.uid(), btrim(external_name));

    update maintenance_items
    set status = 'pendente', selected_by = null, selected_at = null,
        next_due_date = current_date + r.periodicity_days
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- ---------- Categorias e itens (seed inicial, baseado em boas práticas do setor) ----------
insert into maintenance_categories (name, position) values
  ('Ar condicionados', 1), ('Boiler da casa', 2), ('Boiler do prédio', 3),
  ('Bombas pressurizadoras', 4), ('Bomba de irrigação', 5), ('Cisterna', 6),
  ('Bomba do poço', 7), ('Fossa séptica prédio', 8), ('Fossa séptica chalés', 9);

with cat as (select id, name from maintenance_categories),
items(category, pos, label, description, execution_type, periodicity_days) as (
  values
    ('Ar condicionados', 1, 'Limpeza dos filtros', 'Remover poeira e resíduos dos filtros de ar para manter a eficiência e a qualidade do ar.', 'nao_tecnico', 30),
    ('Ar condicionados', 2, 'Limpeza externa das unidades condensadoras', 'Remover folhas, poeira e obstruções ao redor da unidade externa.', 'nao_tecnico', 90),
    ('Ar condicionados', 3, 'Verificação de ruídos e vazamentos aparentes', 'Observar ruídos anormais, gotejamento ou umidade ao redor do aparelho.', 'nao_tecnico', 30),
    ('Ar condicionados', 4, 'Verificação do dreno de condensado', 'Checar se o dreno está desobstruído e escoando corretamente.', 'nao_tecnico', 30),
    ('Ar condicionados', 5, 'Calibração do termostato', 'Conferir se a temperatura ajustada corresponde à temperatura real do ambiente.', 'nao_tecnico', 90),
    ('Ar condicionados', 6, 'Higienização completa (serpentinas e ventiladores)', 'Limpeza técnica interna para eliminar fungos, bactérias e sujeira acumulada.', 'tecnico', 180),
    ('Ar condicionados', 7, 'Verificação da carga de gás refrigerante', 'Medir pressão e completar gás refrigerante se necessário.', 'tecnico', 365),
    ('Ar condicionados', 8, 'Revisão elétrica e de disjuntores', 'Verificar conexões, fiação e proteção elétrica do equipamento.', 'tecnico', 365),
    ('Ar condicionados', 9, 'Lubrificação de motores e ventiladores', 'Lubrificar componentes móveis para reduzir desgaste e ruído.', 'tecnico', 180),
    ('Ar condicionados', 10, 'Inspeção geral pré-temporada de verão', 'Revisão completa antes do período de maior uso.', 'tecnico', 365),

    ('Boiler da casa', 1, 'Verificação visual de vazamentos', 'Inspecionar conexões e tanque em busca de umidade ou gotejamento.', 'nao_tecnico', 30),
    ('Boiler da casa', 2, 'Checagem da temperatura da água', 'Confirmar se a água está saindo na temperatura configurada.', 'nao_tecnico', 30),
    ('Boiler da casa', 3, 'Verificação da pressão e válvula de alívio', 'Testar o funcionamento da válvula de segurança.', 'nao_tecnico', 90),
    ('Boiler da casa', 4, 'Limpeza do filtro de entrada', 'Remover sedimentos do filtro de entrada de água.', 'nao_tecnico', 90),
    ('Boiler da casa', 5, 'Verificação do isolamento térmico da tubulação', 'Checar se o isolamento está íntegro para evitar perda de calor.', 'nao_tecnico', 180),
    ('Boiler da casa', 6, 'Troca do ânodo de sacrifício', 'Substituir o ânodo para evitar corrosão interna do tanque.', 'tecnico', 365),
    ('Boiler da casa', 7, 'Desincrustação e remoção de sedimentos do tanque', 'Limpeza interna para remover calcário e sedimentos acumulados.', 'tecnico', 365),
    ('Boiler da casa', 8, 'Inspeção do sistema de aquecimento/resistência', 'Verificar funcionamento e desgaste da resistência elétrica.', 'tecnico', 180),
    ('Boiler da casa', 9, 'Teste do termostato de segurança', 'Confirmar o corte automático em caso de superaquecimento.', 'tecnico', 180),
    ('Boiler da casa', 10, 'Inspeção geral pré-temporada de inverno', 'Revisão completa antes do período de maior uso.', 'tecnico', 365),

    ('Boiler do prédio', 1, 'Verificação visual de vazamentos', 'Inspecionar conexões e tanque em busca de umidade ou gotejamento.', 'nao_tecnico', 15),
    ('Boiler do prédio', 2, 'Checagem da pressão do sistema', 'Conferir o manômetro e comparar com a faixa recomendada.', 'nao_tecnico', 30),
    ('Boiler do prédio', 3, 'Purga de ar do sistema', 'Eliminar bolsões de ar que reduzem a eficiência do aquecimento.', 'nao_tecnico', 30),
    ('Boiler do prédio', 4, 'Limpeza do filtro/strainer', 'Remover resíduos acumulados no filtro de entrada.', 'nao_tecnico', 90),
    ('Boiler do prédio', 5, 'Verificação da válvula de segurança', 'Testar acionamento e vedação da válvula de alívio de pressão.', 'tecnico', 180),
    ('Boiler do prédio', 6, 'Análise da água e tratamento anticorrosivo', 'Verificar dureza e aplicar tratamento se necessário.', 'tecnico', 180),
    ('Boiler do prédio', 7, 'Inspeção da resistência/queimador', 'Checar desgaste e eficiência do elemento de aquecimento.', 'tecnico', 180),
    ('Boiler do prédio', 8, 'Verificação do quadro elétrico e comandos', 'Inspecionar fiação, contatores e proteções elétricas.', 'tecnico', 180),
    ('Boiler do prédio', 9, 'Desincrustação do tanque', 'Remoção de calcário e sedimentos acumulados no tanque.', 'tecnico', 365),
    ('Boiler do prédio', 10, 'Inspeção geral e certificação anual', 'Revisão completa de segurança e desempenho do equipamento.', 'tecnico', 365),

    ('Bombas pressurizadoras', 1, 'Verificação de ruídos e vibração anormal', 'Identificar sinais de desgaste em mancais ou desbalanceamento.', 'nao_tecnico', 15),
    ('Bombas pressurizadoras', 2, 'Checagem da pressão de trabalho', 'Conferir se a pressão está dentro da faixa configurada.', 'nao_tecnico', 15),
    ('Bombas pressurizadoras', 3, 'Verificação de vazamentos nas conexões', 'Inspecionar juntas, registros e tubulações próximas.', 'nao_tecnico', 30),
    ('Bombas pressurizadoras', 4, 'Limpeza do filtro de sucção', 'Remover resíduos que possam obstruir a sucção da bomba.', 'nao_tecnico', 90),
    ('Bombas pressurizadoras', 5, 'Teste do sistema de partida automática', 'Confirmar o acionamento automático conforme a demanda de pressão.', 'nao_tecnico', 90),
    ('Bombas pressurizadoras', 6, 'Verificação do pressostato/manômetro', 'Calibrar e testar a precisão dos instrumentos de pressão.', 'tecnico', 180),
    ('Bombas pressurizadoras', 7, 'Lubrificação e verificação do motor', 'Lubrificar rolamentos e checar aquecimento do motor.', 'tecnico', 180),
    ('Bombas pressurizadoras', 8, 'Verificação do quadro de comando elétrico', 'Inspecionar contatores, relés e proteções do painel.', 'tecnico', 180),
    ('Bombas pressurizadoras', 9, 'Verificação do tanque de expansão/hidropneumático', 'Checar pressurização e diafragma do tanque.', 'tecnico', 365),
    ('Bombas pressurizadoras', 10, 'Revisão geral anual', 'Inspeção completa de desempenho e segurança do sistema.', 'tecnico', 365),

    ('Bomba de irrigação', 1, 'Verificação visual de vazamentos', 'Inspecionar conexões e mangueiras da linha de irrigação.', 'nao_tecnico', 15),
    ('Bomba de irrigação', 2, 'Limpeza do filtro de irrigação', 'Remover resíduos e sedimentos que possam obstruir o filtro.', 'nao_tecnico', 30),
    ('Bomba de irrigação', 3, 'Teste do funcionamento do timer/programador', 'Confirmar horários e ciclos programados de irrigação.', 'nao_tecnico', 30),
    ('Bomba de irrigação', 4, 'Verificação de aspersores/gotejadores entupidos', 'Checar entupimentos e uniformidade da aspersão.', 'nao_tecnico', 30),
    ('Bomba de irrigação', 5, 'Verificação de ruídos e vibração da bomba', 'Identificar sinais de desgaste mecânico precoce.', 'nao_tecnico', 30),
    ('Bomba de irrigação', 6, 'Verificação do quadro elétrico', 'Inspecionar fiação e proteções do circuito de irrigação.', 'tecnico', 180),
    ('Bomba de irrigação', 7, 'Revisão do motor e rolamentos', 'Checar desgaste, aquecimento e lubrificação do motor.', 'tecnico', 180),
    ('Bomba de irrigação', 8, 'Verificação da válvula de pé/escorva', 'Testar a retenção de água e o processo de escorva da bomba.', 'tecnico', 180),
    ('Bomba de irrigação', 9, 'Calibração da pressão do sistema', 'Ajustar a pressão de operação para a rede de irrigação.', 'tecnico', 180),
    ('Bomba de irrigação', 10, 'Revisão geral pré-temporada seca', 'Inspeção completa antes do período de maior necessidade de rega.', 'tecnico', 365),

    ('Cisterna', 1, 'Verificação do nível e boia', 'Confirmar funcionamento correto da boia de nível.', 'nao_tecnico', 15),
    ('Cisterna', 2, 'Verificação de vazamentos visíveis', 'Inspecionar paredes externas e conexões da cisterna.', 'nao_tecnico', 30),
    ('Cisterna', 3, 'Verificação do funcionamento das bombas de recalque', 'Testar acionamento e vazão das bombas.', 'nao_tecnico', 30),
    ('Cisterna', 4, 'Verificação do sistema de extravasor', 'Checar se o extravasor está desobstruído.', 'nao_tecnico', 90),
    ('Cisterna', 5, 'Limpeza da tampa e vedação de acesso', 'Garantir vedação adequada contra contaminação externa.', 'nao_tecnico', 90),
    ('Cisterna', 6, 'Limpeza e higienização da cisterna', 'Esvaziamento, limpeza interna e desinfecção completa.', 'tecnico', 180),
    ('Cisterna', 7, 'Desinfecção com cloro conforme norma sanitária', 'Aplicação de cloro seguindo os parâmetros recomendados.', 'tecnico', 180),
    ('Cisterna', 8, 'Análise da qualidade da água', 'Coleta e análise laboratorial da água armazenada.', 'tecnico', 180),
    ('Cisterna', 9, 'Verificação estrutural (rachaduras/infiltrações)', 'Inspeção estrutural completa da caixa d''água.', 'tecnico', 365),
    ('Cisterna', 10, 'Revisão geral anual', 'Inspeção completa do sistema de armazenamento de água.', 'tecnico', 365),

    ('Bomba do poço', 1, 'Verificação de ruídos e vibração anormal', 'Identificar sinais de desgaste mecânico precoce.', 'nao_tecnico', 30),
    ('Bomba do poço', 2, 'Checagem da vazão de água', 'Confirmar se a vazão está de acordo com o esperado.', 'nao_tecnico', 30),
    ('Bomba do poço', 3, 'Verificação de vazamentos nas conexões', 'Inspecionar tubulações e registros próximos ao poço.', 'nao_tecnico', 30),
    ('Bomba do poço', 4, 'Verificação do quadro elétrico e boia de nível', 'Checar fiação, proteções e funcionamento da boia.', 'nao_tecnico', 30),
    ('Bomba do poço', 5, 'Verificação do reservatório de descarga', 'Checar nível e integridade do reservatório de recalque.', 'nao_tecnico', 90),
    ('Bomba do poço', 6, 'Teste do sistema de proteção contra funcionamento a seco', 'Confirmar que a bomba desliga automaticamente sem água.', 'tecnico', 180),
    ('Bomba do poço', 7, 'Análise da qualidade da água do poço', 'Coleta e análise laboratorial da água extraída.', 'tecnico', 180),
    ('Bomba do poço', 8, 'Revisão do motor submerso', 'Inspeção técnica do motor e vedações submersas.', 'tecnico', 365),
    ('Bomba do poço', 9, 'Verificação do cabo elétrico e conexões submersas', 'Checar isolamento e integridade das conexões subaquáticas.', 'tecnico', 365),
    ('Bomba do poço', 10, 'Revisão geral anual', 'Inspeção completa de desempenho e segurança do sistema.', 'tecnico', 365),

    ('Fossa séptica prédio', 1, 'Verificação visual de odores e vazamentos', 'Identificar odores anormais ou umidade ao redor da fossa.', 'nao_tecnico', 15),
    ('Fossa séptica prédio', 2, 'Verificação da caixa de gordura associada', 'Checar acúmulo de gordura e necessidade de limpeza.', 'nao_tecnico', 30),
    ('Fossa séptica prédio', 3, 'Verificação de entupimentos na tubulação', 'Checar escoamento normal nos ralos e tubulações associadas.', 'nao_tecnico', 30),
    ('Fossa séptica prédio', 4, 'Verificação do nível de lodo', 'Estimar visualmente o nível de lodo acumulado.', 'nao_tecnico', 90),
    ('Fossa séptica prédio', 5, 'Verificação de infiltrações no solo ao redor', 'Observar sinais de saturação ou infiltração no terreno.', 'nao_tecnico', 90),
    ('Fossa séptica prédio', 6, 'Inspeção do sistema de ventilação', 'Checar desobstrução dos tubos de ventilação da fossa.', 'tecnico', 180),
    ('Fossa séptica prédio', 7, 'Verificação do sumidouro/filtro anaeróbio', 'Inspecionar a etapa final de tratamento e infiltração.', 'tecnico', 180),
    ('Fossa séptica prédio', 8, 'Limpeza e remoção de lodo', 'Esgotamento e remoção do lodo acumulado por empresa especializada.', 'tecnico', 365),
    ('Fossa séptica prédio', 9, 'Análise de eficiência de tratamento', 'Avaliação técnica do desempenho do sistema de tratamento.', 'tecnico', 365),
    ('Fossa séptica prédio', 10, 'Revisão geral e licenciamento ambiental', 'Conferir conformidade com normas ambientais e sanitárias.', 'tecnico', 365),

    ('Fossa séptica chalés', 1, 'Verificação visual de odores e vazamentos', 'Identificar odores anormais ou umidade ao redor da fossa.', 'nao_tecnico', 15),
    ('Fossa séptica chalés', 2, 'Verificação da caixa de gordura associada', 'Checar acúmulo de gordura e necessidade de limpeza.', 'nao_tecnico', 30),
    ('Fossa séptica chalés', 3, 'Verificação de entupimentos na tubulação', 'Checar escoamento normal nos ralos e tubulações associadas.', 'nao_tecnico', 30),
    ('Fossa séptica chalés', 4, 'Verificação do nível de lodo', 'Estimar visualmente o nível de lodo acumulado.', 'nao_tecnico', 90),
    ('Fossa séptica chalés', 5, 'Verificação de infiltrações no solo ao redor', 'Observar sinais de saturação ou infiltração no terreno.', 'nao_tecnico', 90),
    ('Fossa séptica chalés', 6, 'Inspeção do sistema de ventilação', 'Checar desobstrução dos tubos de ventilação da fossa.', 'tecnico', 180),
    ('Fossa séptica chalés', 7, 'Verificação do sumidouro/filtro anaeróbio', 'Inspecionar a etapa final de tratamento e infiltração.', 'tecnico', 180),
    ('Fossa séptica chalés', 8, 'Limpeza e remoção de lodo', 'Esgotamento e remoção do lodo acumulado por empresa especializada.', 'tecnico', 365),
    ('Fossa séptica chalés', 9, 'Análise de eficiência de tratamento', 'Avaliação técnica do desempenho do sistema de tratamento.', 'tecnico', 365),
    ('Fossa séptica chalés', 10, 'Revisão geral e licenciamento ambiental', 'Conferir conformidade com normas ambientais e sanitárias.', 'tecnico', 365)
)
insert into maintenance_items (category_id, label, description, execution_type, periodicity_days, next_due_date, position)
select cat.id, items.label, items.description, items.execution_type::maintenance_execution_type, items.periodicity_days, current_date, items.pos
from items join cat on cat.name = items.category;
