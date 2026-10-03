-- Rastreamento de "quebra de estoque" (variação entre saldo no sistema e
-- contagem física) por item, com média móvel de 12 meses que descarta
-- outliers — ver PRD_compras.md seção 18 pro raciocínio completo.
--
-- Modelo: cada contagem FECHADA grava, por item, três números congelados
-- no momento do fechamento (nunca recalculados depois, mesmo que os
-- limites configuráveis mudem — são fatos históricos sobre o que
-- aconteceu naquela contagem específica):
--   - quebra_pct: % de diferença (saldo sistema → contagem física),
--     com o mesmo sinal da diferença.
--   - quebra_12m_pct: média de quebra_pct das contagens fechadas do
--     mesmo item nos últimos 12 meses ANTES desta, excluindo as que
--     tiverem índice_relativo_pct maior que o limite atual do item.
--   - indice_relativo_pct: |quebra_pct ÷ quebra_12m_pct| × 100 —
--     sempre positivo, mostra o quão fora do padrão esta contagem ficou.
--
-- Os dois limites configuráveis (quanto de quebra é aceitável, e quanto
-- de desvio em relação à média é aceitável antes de virar outlier) ficam
-- no item, editáveis a qualquer momento — mudar o limite só afeta quais
-- contagens futuras tratam uma contagem antiga como outlier, nunca
-- reescreve os números já congelados.

alter table inventory_items
  add column quebra_maxima_admitida_pct numeric(6,2) not null default 20 check (quebra_maxima_admitida_pct > 0),
  add column indice_relativo_maximo_pct numeric(6,2) not null default 200 check (indice_relativo_maximo_pct > 0);

alter table inventory_count_lines
  add column quebra_pct numeric(8,2),
  add column quebra_12m_pct numeric(8,2),
  add column indice_relativo_pct numeric(8,2);

-- View de leitura: uma linha por contagem FECHADA, com o nome do item,
-- a categoria, os limites ATUAIS do item (não congelados — é intencional,
-- ver nota acima) e a data da contagem anterior do mesmo item via
-- LAG(), pra nunca precisar calcular isso em JavaScript em três lugares
-- diferentes (tela de contagem, Histórico, Resumo Executivo).
create view inventory_count_line_history
with (security_invoker = true) as
select
  cl.id,
  cl.session_id,
  cl.inventory_item_id,
  ii.name as item_name,
  ii.unit,
  ec.name as category_name,
  cl.theoretical_qty,
  cl.counted_qty,
  (cl.counted_qty - cl.theoretical_qty) as diferenca,
  cl.quebra_pct,
  cl.quebra_12m_pct,
  cl.indice_relativo_pct,
  ii.quebra_maxima_admitida_pct,
  ii.indice_relativo_maximo_pct,
  cs.closed_at,
  lag(cs.closed_at) over (partition by cl.inventory_item_id order by cs.closed_at) as previous_count_date
from inventory_count_lines cl
join inventory_count_sessions cs on cs.id = cl.session_id
join inventory_items ii on ii.id = cl.inventory_item_id
join expense_categories ec on ec.id = ii.category_id
where cs.status = 'concluida' and cl.counted_qty is not null;
