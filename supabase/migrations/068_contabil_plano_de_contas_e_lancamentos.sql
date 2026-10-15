-- Módulo Contábil — Leva 1: plano de contas contábil (Ativo/Passivo/
-- Receita/Custo/Despesa) + motor de partidas dobradas (o "livro-razão"
-- por trás). Ver PRD_compras&contabil.md seção 22 pro documento
-- original e as decisões tomadas antes desta leva.
--
-- Esta leva é só a fundação: nenhuma tela existente (compras, comandas,
-- consumo por quartos, estoque) passa a gravar lançamento nenhum ainda —
-- isso é só um motor novo, testável sozinho, que as próximas levas vão
-- chamar.
--
-- Duas contas contábeis (dimensão "que TIPO de movimento é isso") nunca
-- se confundem com centro de custo (dimensão "de qual PARTE da pousada
-- é isso") — um lançamento carrega as duas, a segunda só quando faz
-- sentido (nem todo lançamento tem centro, ex.: pagar um fornecedor).

create type ledger_account_group as enum ('ativo', 'passivo', 'receita', 'custo', 'despesa');
create type ledger_entry_status as enum ('confirmado', 'estornado');
create type ledger_entry_direction as enum ('debito', 'credito');

-- Plano de contas contábil — editável pelo admin, mas começa com a
-- estrutura inteira do documento (seção 6). `code` é um identificador
-- estável em texto (nunca muda, usado pelo código do app pra saber qual
-- conta usar em cada lançamento automático); `display_code` é só o
-- "1.01" que aparece pro usuário no balancete/livro-razão, puramente
-- cosmético. `requires_cost_center` indica se um lançamento nessa conta
-- PRECISA informar também um centro de custo (ex.: toda despesa/custo
-- precisa; Caixa/Banco/Fornecedores a pagar não precisam).
create table ledger_accounts (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  display_code text,
  name text not null,
  account_group ledger_account_group not null,
  requires_cost_center boolean not null default false,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Item de custo → centro de custo, direto (sem a camada de subcentro —
-- ver migration 069, que remove os subcentros). Fica junto desta
-- migration só pelo número sequencial; a tabela em si só é criada e
-- populada na 069, que mexe no Plano de Contas já existente.

-- Um "lançamento" é 1 evento econômico (uma compra, uma venda, um
-- pagamento) que gera 2 ou mais linhas (débito/crédito). Nunca é
-- apagado depois de confirmado — uma correção sempre nasce como um novo
-- lançamento de estorno (reverses_entry_id), nunca um DELETE/UPDATE no
-- lançamento original.
create table ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_date date not null, -- data de competência
  document_date date, -- data do documento (nota fiscal, recibo etc.), quando houver
  cash_date date, -- data de caixa (pagamento/recebimento), quando houver
  description text not null,
  origin text not null, -- de onde veio: 'compra' | 'despesa' | 'venda_bar' | 'venda_frigobar' | 'pagamento' | 'recebimento' | 'perda_estoque' | 'ajuste_contagem' | 'manual' | 'estorno' etc. — texto livre de propósito, cresce sem precisar de migration nova
  source_type text, -- nome da tabela de origem (ex.: 'expenses', 'bar_comandas'), quando o lançamento foi gerado automaticamente por outra tela
  source_id uuid, -- id da linha de origem nessa tabela — sem FK de verdade, já que aponta pra tabelas diferentes conforme source_type
  status ledger_entry_status not null default 'confirmado',
  reverses_entry_id uuid references ledger_entries(id) on delete set null, -- quando este lançamento É o estorno de outro
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ledger_entries_source_idx on ledger_entries (source_type, source_id);
create index ledger_entries_entry_date_idx on ledger_entries (entry_date);

-- Uma linha = 1 débito OU 1 crédito, numa conta, com centro de custo
-- opcional. A soma dos débitos de um lançamento sempre bate com a soma
-- dos créditos — garantido pela função post_ledger_entry abaixo, nunca
-- confiado a um INSERT direto.
create table ledger_entry_lines (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references ledger_entries(id) on delete cascade,
  account_id uuid not null references ledger_accounts(id),
  cost_center_id uuid references cost_centers(id),
  direction ledger_entry_direction not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index ledger_entry_lines_entry_idx on ledger_entry_lines (entry_id);
create index ledger_entry_lines_account_idx on ledger_entry_lines (account_id);

-- Único jeito de criar um lançamento — nunca INSERT direto em
-- ledger_entries/ledger_entry_lines pelo client (mesmo padrão
-- `security definer` já usado em todo o projeto pra transição de
-- estado sensível). Recebe as linhas como JSON
-- ([{account_code, cost_center_id, direction, amount}, ...]), confere
-- que débitos somam igual a créditos (com 1 centavo de tolerância, pra
-- arredondamento de ponto flutuante nunca travar um lançamento válido)
-- e só então grava o lançamento inteiro, atômico. Qualquer papel
-- autenticado pode chamar (as próprias Server Actions de cada tela é
-- que decidem quando chamar isso, então a autorização de fato já
-- aconteceu antes — ex.: só uma camareira pode fechar uma comanda, e
-- é a Server Action de fechar a comanda que, por baixo, chama esta
-- função).
create or replace function post_ledger_entry(
  p_entry_date date,
  p_document_date date,
  p_cash_date date,
  p_description text,
  p_origin text,
  p_source_type text,
  p_source_id uuid,
  p_lines jsonb
) returns uuid as $$
declare
  v_entry_id uuid;
  v_total_debito numeric := 0;
  v_total_credito numeric := 0;
  v_line jsonb;
  v_line_count int;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select count(*) into v_line_count from jsonb_array_elements(p_lines);
  if v_line_count < 2 then
    raise exception 'Um lançamento precisa de pelo menos 2 linhas (1 débito e 1 crédito).';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line->>'direction') = 'debito' then
      v_total_debito := v_total_debito + (v_line->>'amount')::numeric;
    elsif (v_line->>'direction') = 'credito' then
      v_total_credito := v_total_credito + (v_line->>'amount')::numeric;
    else
      raise exception 'direction inválida: %', v_line->>'direction';
    end if;
  end loop;

  if abs(v_total_debito - v_total_credito) > 0.01 then
    raise exception 'Lançamento desbalanceado: débitos % ≠ créditos %', v_total_debito, v_total_credito;
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, created_by)
  values (p_entry_date, p_document_date, p_cash_date, p_description, p_origin, p_source_type, p_source_id, auth.uid())
  returning id into v_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, direction, amount)
  select
    v_entry_id,
    la.id,
    nullif(elem->>'cost_center_id', '')::uuid,
    (elem->>'direction')::ledger_entry_direction,
    (elem->>'amount')::numeric
  from jsonb_array_elements(p_lines) elem
  join ledger_accounts la on la.code = (elem->>'account_code');

  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(*) from ledger_entry_lines where entry_id = v_entry_id) then
    raise exception 'Uma ou mais contas (account_code) não foram encontradas no plano de contas.';
  end if;

  return v_entry_id;
end;
$$ language plpgsql security definer;

-- Estorna um lançamento confirmado: marca o original como 'estornado' e
-- cria um novo lançamento espelhado (débito↔crédito invertidos em
-- relação ao original), preservando o histórico dos dois — nunca
-- apaga/edita o lançamento original.
create or replace function reverse_ledger_entry(p_entry_id uuid, p_reason text) returns uuid as $$
declare
  v_new_entry_id uuid;
  v_original ledger_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_original from ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado.';
  end if;
  if v_original.status = 'estornado' then
    raise exception 'Este lançamento já foi estornado.';
  end if;

  insert into ledger_entries (entry_date, document_date, cash_date, description, origin, source_type, source_id, reverses_entry_id, created_by)
  values (current_date, v_original.document_date, v_original.cash_date, coalesce(p_reason, 'Estorno de: ' || v_original.description), 'estorno', v_original.source_type, v_original.source_id, p_entry_id, auth.uid())
  returning id into v_new_entry_id;

  insert into ledger_entry_lines (entry_id, account_id, cost_center_id, direction, amount)
  select
    v_new_entry_id,
    l.account_id,
    l.cost_center_id,
    (case when l.direction = 'debito' then 'credito' else 'debito' end)::ledger_entry_direction,
    l.amount
  from ledger_entry_lines l
  where l.entry_id = p_entry_id;

  update ledger_entries set status = 'estornado' where id = p_entry_id;

  return v_new_entry_id;
end;
$$ language plpgsql security definer;

alter table ledger_accounts enable row level security;
alter table ledger_entries enable row level security;
alter table ledger_entry_lines enable row level security;

create policy "ledger_accounts_select_authenticated" on ledger_accounts for select using (auth.uid() is not null);
create policy "ledger_accounts_admin_write" on ledger_accounts for all using (is_admin()) with check (is_admin());

-- Ninguém grava direto em ledger_entries/ledger_entry_lines — sempre via
-- post_ledger_entry/reverse_ledger_entry (security definer). A leitura é
-- liberada pra qualquer autenticado (o acesso de verdade é controlado
-- nas telas, já que por ora só o admin tem tela que usa isso).
create policy "ledger_entries_select_authenticated" on ledger_entries for select using (auth.uid() is not null);
create policy "ledger_entry_lines_select_authenticated" on ledger_entry_lines for select using (auth.uid() is not null);

-- Plano de contas contábil inicial (PRD_compras&contabil.md seção 22.1,
-- seção 6). `requires_cost_center`: contas de Ativo/Passivo "de
-- posição" (Caixa, Banco, Estoques, Fornecedores a pagar etc.) não
-- precisam de centro; Receita/Custo/Despesa sempre fazem mais sentido
-- com centro, pra alimentar os relatórios por centro.
insert into ledger_accounts (code, display_code, name, account_group, requires_cost_center) values
  ('caixa', '1.01', 'Caixa', 'ativo', false),
  ('banco', '1.02', 'Banco', 'ativo', false),
  ('consumos-a-liquidar', '1.03', 'Consumos de bar/frigobar a liquidar no checkout', 'ativo', false),
  ('estoque-bebidas', '1.04', 'Estoque Central de bebidas', 'ativo', false),
  ('estoque-alimentos', '1.05', 'Estoque Central de alimentos/ingredientes', 'ativo', false),
  ('estoque-limpeza', '1.06', 'Estoque de materiais de limpeza e amenidades', 'ativo', false),
  ('estoque-outros', '1.07', 'Outros estoques operacionais', 'ativo', false),
  ('equipamentos-imobilizado', '1.08', 'Equipamentos e imobilizado', 'ativo', false),
  ('depreciacao-acumulada', '1.09', 'Depreciação acumulada', 'ativo', false),

  ('fornecedores-a-pagar', '2.01', 'Fornecedores a pagar', 'passivo', false),
  ('despesas-a-pagar', '2.02', 'Despesas operacionais a pagar', 'passivo', false),
  ('salarios-a-pagar', '2.03', 'Salários/encargos a pagar', 'passivo', false),
  ('tributos-a-pagar', '2.04', 'Tributos e taxas a pagar', 'passivo', false),
  ('outras-obrigacoes', '2.05', 'Outras obrigações operacionais', 'passivo', false),

  ('receita-bebidas-bar', '3.01', 'Receita de bebidas — Bar da piscina', 'receita', true),
  ('receita-petiscos-bar', '3.02', 'Receita de petiscos — Bar da piscina', 'receita', true),
  ('receita-drinks-bar', '3.03', 'Receita de drinks — Bar da piscina', 'receita', true),
  ('receita-bebidas-frigobar', '3.04', 'Receita de bebidas — Frigobar', 'receita', true),
  ('descontos-bar-frigobar', '3.05', 'Descontos concedidos no bar/frigobar', 'receita', true),
  ('cancelamentos-bar-frigobar', '3.06', 'Cancelamentos/devoluções do bar/frigobar', 'receita', true),

  ('cmv-bebidas-bar', '4.01', 'CMV de bebidas — Bar da piscina', 'custo', true),
  ('custo-petiscos-bar', '4.02', 'Custo de ingredientes/petiscos — Bar da piscina', 'custo', true),
  ('custo-drinks-bar', '4.03', 'Custo de ingredientes/drinks — Bar da piscina', 'custo', true),
  ('cmv-bebidas-frigobar', '4.04', 'CMV de bebidas — Frigobar', 'custo', true),
  ('custo-cafe-manha', '4.05', 'Custo de alimentos e bebidas consumidos — Café da manhã', 'custo', true),
  ('materiais-limpeza-hospedagem', '4.06', 'Materiais de limpeza e amenidades — Hospedagem', 'custo', true),
  ('lavanderia-hospedagem', '4.07', 'Lavanderia — Hospedagem', 'custo', true),
  ('mao-de-obra-operacional', '4.08', 'Mão de obra operacional', 'custo', true),
  ('perdas-estoque', '4.09', 'Perdas e desperdícios de estoque', 'custo', true),

  ('energia-eletrica', '5.01', 'Energia elétrica', 'despesa', true),
  ('agua-esgoto', '5.02', 'Água e esgoto', 'despesa', true),
  ('gas', '5.03', 'Gás', 'despesa', true),
  ('internet-telefonia', '5.04', 'Internet e telefonia', 'despesa', true),
  ('manutencao', '5.05', 'Manutenção', 'despesa', true),
  ('jardinagem', '5.06', 'Jardinagem', 'despesa', true),
  ('piscina', '5.07', 'Piscina', 'despesa', true),
  ('limpeza-areas-comuns', '5.08', 'Limpeza de áreas comuns', 'despesa', true),
  ('contabilidade-servicos', '5.09', 'Contabilidade e serviços profissionais', 'despesa', true),
  ('material-administrativo', '5.10', 'Material administrativo', 'despesa', true),
  ('tarifas-bancarias', '5.11', 'Tarifas bancárias', 'despesa', false),
  ('despesas-financeiras', '5.12', 'Despesas financeiras', 'despesa', false),
  ('pessoal-administrativo', '5.13', 'Despesas com pessoal administrativo', 'despesa', true),
  ('outras-despesas', '5.14', 'Outras despesas operacionais', 'despesa', true);
