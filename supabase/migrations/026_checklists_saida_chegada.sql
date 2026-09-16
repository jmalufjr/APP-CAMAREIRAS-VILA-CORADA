-- ============================================================================
-- Migração: "Preparação Chegada" (valor de enum `preparacao`, sem mudar)
-- renomeado para "Saída com Chegada" (só o rótulo, em src/lib/task-type.ts)
-- + dois checklists novos: "Somente Chegada" e "Somente Saída".
-- IMPORTANTE: o Postgres não permite usar um valor de enum recém-criado na
-- mesma transação/execução em que ele foi adicionado. Rode a ETAPA 1,
-- espere terminar, e só depois rode a ETAPA 2 em uma nova execução.
-- ============================================================================

-- ---------- ETAPA 1 (rode sozinha, clique em "Run") ----------
alter type checklist_type add value 'somente_chegada';
alter type checklist_type add value 'somente_saida';


-- ---------- ETAPA 2 (rode depois, em uma nova execução) ----------

-- "Saída com Chegada" (type = 'preparacao') ganha 2 itens novos no início,
-- sobre pertences esquecidos/itens do quarto — os 20 itens existentes
-- deslocam +2 de posição para abrir espaço.
update checklist_items set position = position + 2 where type = 'preparacao';

insert into checklist_items (type, label, description, position) values
  ('preparacao', 'Verificar pertences esquecidos', 'Conferir armários, gavetas, cofre, banheiro e criados-mudos em busca de objetos esquecidos pelo hóspede que saiu.', 1),
  ('preparacao', 'Conferir itens do quarto', 'Confirmar que chaves, controles remotos, adaptadores e demais itens do quarto não foram levados pelo hóspede.', 2);

update checklist_items
set description = 'Confirmar que o quarto está pronto para ficar disponível e registrar qualquer ocorrência antes da liberação.'
where type = 'preparacao' and label = 'Liberar o quarto';

-- "Somente Saída": mesmos 22 itens de "Saída com Chegada" (quarto passa por
-- limpeza completa de qualquer forma, pois pode receber reserva de última
-- hora — só não ganha itens de boas-vindas, que dependem de saber quando o
-- próximo hóspede chega).
insert into checklist_items (type, label, description, position) values
  ('somente_saida', 'Verificar pertences esquecidos', 'Conferir armários, gavetas, cofre, banheiro e criados-mudos em busca de objetos esquecidos pelo hóspede que saiu.', 1),
  ('somente_saida', 'Conferir itens do quarto', 'Confirmar que chaves, controles remotos, adaptadores e demais itens do quarto não foram levados pelo hóspede.', 2),
  ('somente_saida', 'Ventilar o quarto', 'Eliminar odores e deixar o ambiente arejado durante a arrumação.', 3),
  ('somente_saida', 'Retirar o lixo', 'Esvaziar todas as lixeiras e colocar sacos novos.', 4),
  ('somente_saida', 'Limpar superfícies', 'Criados-mudos, mesas, bancada, cabeceira, prateleiras e demais superfícies.', 5),
  ('somente_saida', 'Limpar espelhos e vidros', 'Verificar marcas, manchas e resíduos.', 6),
  ('somente_saida', 'Limpar o piso', 'Remover cabelos, areia, poeira e demais resíduos; limpar conforme o piso.', 7),
  ('somente_saida', 'Arrumar a cama', 'Roupa limpa, sem manchas ou cabelos; cama bem esticada e apresentação padronizada.', 8),
  ('somente_saida', 'Conferir travesseiros e protetores', 'Limpeza, odor, conservação e quantidade adequada.', 9),
  ('somente_saida', 'Conferir cortinas e tecidos', 'Verificar poeira, manchas, cabelos e funcionamento.', 10),
  ('somente_saida', 'Higienizar o banheiro', 'Vaso, pia, bancada, metais, box, chuveiro e demais superfícies.', 11),
  ('somente_saida', 'Conferir toalhas', 'Quantidade correta, limpeza, manchas, fios soltos e conservação.', 12),
  ('somente_saida', 'Repor amenities', 'Sabonete, shampoo, condicionador, papel higiênico e demais itens.', 13),
  ('somente_saida', 'Conferir água e metais', 'Chuveiro, torneiras e descarga: funcionamento, vazamentos, pressão e temperatura.', 14),
  ('somente_saida', 'Conferir iluminação', 'Testar lâmpadas, luminárias, abajures e interruptores.', 15),
  ('somente_saida', 'Testar ar-condicionado', 'Funcionamento, controle remoto, temperatura e ruídos anormais.', 16),
  ('somente_saida', 'Conferir minibar', 'Limpeza, funcionamento, temperatura, estoque e validade.', 17),
  ('somente_saida', 'Conferir equipamentos', 'TV, controle, secador, tomadas e demais equipamentos do quarto.', 18),
  ('somente_saida', 'Procurar problemas de manutenção', 'Mofo, infiltração, vazamentos, pintura, ferragens, trincas, cupins ou danos.', 19),
  ('somente_saida', 'Conferir varanda/área externa', 'Piso, móveis, portas, vidros e ausência de folhas, areia ou insetos.', 20),
  ('somente_saida', 'Inspeção final', 'Quarto visualmente impecável, organizado e conforme o padrão da pousada.', 21),
  ('somente_saida', 'Liberar o quarto', 'Confirmar que o quarto está pronto para ficar disponível e registrar qualquer ocorrência antes da liberação.', 22);

-- "Somente Chegada": quarto já foi limpo por completo numa "Somente Saída"
-- anterior (ou ficou vago), então os itens de limpeza viram uma revisão
-- mais leve; sem itens de pertences esquecidos (ninguém está saindo); ganha
-- itens de boas-vindas (chocolate, flor, cheirinho) e ênfase em testar o
-- funcionamento dos aparelhos antes da chegada.
insert into checklist_items (type, label, description, position) values
  ('somente_chegada', 'Ventilar o quarto', 'Eliminar odores e deixar o ambiente arejado antes da chegada.', 1),
  ('somente_chegada', 'Revisar lixeiras', 'Conferir se estão vazias e com sacos novos.', 2),
  ('somente_chegada', 'Revisar superfícies', 'Criados-mudos, mesas, bancada, cabeceira e prateleiras; o quarto já foi limpo na saída, repassar um pano se necessário.', 3),
  ('somente_chegada', 'Revisar espelhos e vidros', 'Conferir manchas ou resíduos; repassar se necessário.', 4),
  ('somente_chegada', 'Revisar o piso', 'Conferir resíduos; passar pano ou aspirador rapidamente se necessário.', 5),
  ('somente_chegada', 'Revisar arrumação da cama', 'Conferir se a cama está bem apresentada; ajustar se necessário.', 6),
  ('somente_chegada', 'Conferir travesseiros e protetores', 'Limpeza, odor, conservação e quantidade adequada.', 7),
  ('somente_chegada', 'Conferir cortinas e tecidos', 'Verificar poeira, manchas, cabelos e funcionamento.', 8),
  ('somente_chegada', 'Revisar o banheiro', 'Conferir limpeza geral de vaso, pia, box e chuveiro; repassar detalhes se necessário.', 9),
  ('somente_chegada', 'Conferir toalhas', 'Quantidade correta, limpeza, manchas, fios soltos e conservação.', 10),
  ('somente_chegada', 'Repor amenities', 'Sabonete, shampoo, condicionador, papel higiênico e demais itens.', 11),
  ('somente_chegada', 'Conferir água e metais', 'Chuveiro, torneiras e descarga: funcionamento, vazamentos, pressão e temperatura.', 12),
  ('somente_chegada', 'Conferir iluminação', 'Testar lâmpadas, luminárias, abajures e interruptores.', 13),
  ('somente_chegada', 'Testar ar-condicionado', 'Funcionamento, controle remoto, temperatura e ruídos anormais.', 14),
  ('somente_chegada', 'Conferir minibar', 'Limpeza, funcionamento, temperatura, estoque e validade.', 15),
  ('somente_chegada', 'Conferir equipamentos', 'TV, controle, secador, tomadas e demais equipamentos; testar o funcionamento de cada um antes da chegada.', 16),
  ('somente_chegada', 'Procurar problemas de manutenção', 'Mofo, infiltração, vazamentos, pintura, ferragens, trincas, cupins ou danos surgidos durante o período vago.', 17),
  ('somente_chegada', 'Conferir varanda/área externa', 'Piso, móveis, portas, vidros e ausência de folhas, areia ou insetos.', 18),
  ('somente_chegada', 'Colocar chocolates de boas-vindas', 'Dispor os chocolates sobre a cama ou criado-mudo.', 19),
  ('somente_chegada', 'Colocar flor no quarto', 'Dispor a flor de boas-vindas em local visível do quarto.', 20),
  ('somente_chegada', 'Passar cheirinho no quarto', 'Borrifar o aromatizador padrão da pousada para deixar o ambiente agradável para a chegada.', 21),
  ('somente_chegada', 'Inspeção final', 'Quarto visualmente impecável, organizado e conforme o padrão da pousada.', 22),
  ('somente_chegada', 'Liberar o quarto', 'Confirmar que o quarto está pronto para receber o hóspede e registrar qualquer ocorrência antes da liberação.', 23);

-- Associa todos os itens novos (os 2 novos de "preparacao" + todos os de
-- "somente_saida"/"somente_chegada") a todos os quartos já cadastrados,
-- igual já é feito para os demais tipos.
insert into room_checklist_items (room_id, checklist_item_id, position)
select r.id, ci.id, ci.position
from rooms r
cross join checklist_items ci
where ci.type in ('somente_saida', 'somente_chegada')
   or (ci.type = 'preparacao' and ci.label in ('Verificar pertences esquecidos', 'Conferir itens do quarto'));
