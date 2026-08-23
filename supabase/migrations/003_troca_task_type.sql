-- ============================================================================
-- Migração: novo tipo de trabalho "Troca" (troca de roupa de cama/toalhas)
-- IMPORTANTE: o Postgres não permite usar um valor de enum recém-criado na
-- mesma transação/execução em que ele foi adicionado. Rode a ETAPA 1,
-- espere terminar, e só depois rode a ETAPA 2 em uma nova execução.
-- ============================================================================

-- ---------- ETAPA 1 (rode sozinha, clique em "Run") ----------
alter type checklist_type add value 'troca';


-- ---------- ETAPA 2 (rode depois, em uma nova execução) ----------
-- Itens do checklist de troca
insert into checklist_items (type, label, description, position) values
  ('troca', 'Bater na porta e aguardar autorização', 'Confirmar com o hóspede antes de entrar no quarto.', 1),
  ('troca', 'Retirar roupa de cama usada', 'Recolher lençóis, fronhas e protetores usados.', 2),
  ('troca', 'Repor roupa de cama limpa', 'Cama arrumada com roupa limpa, sem manchas ou cabelos.', 3),
  ('troca', 'Retirar toalhas usadas', 'Recolher todas as toalhas do quarto e do banheiro.', 4),
  ('troca', 'Repor toalhas limpas', 'Quantidade correta, limpas e bem dobradas.', 5),
  ('troca', 'Retirar o lixo', 'Esvaziar lixeiras e colocar sacos novos.', 6),
  ('troca', 'Repor amenities básicos', 'Sabonete, papel higiênico e demais itens em falta.', 7),
  ('troca', 'Conferir organização geral', 'Ambiente arrumado, sem pertences fora do lugar.', 8),
  ('troca', 'Liberar o quarto', 'Registrar qualquer ocorrência antes da liberação.', 9);

-- Associa os novos itens a todos os quartos já cadastrados
insert into room_checklist_items (room_id, checklist_item_id, position)
select r.id, ci.id, ci.position
from rooms r
cross join checklist_items ci
where ci.type = 'troca';
