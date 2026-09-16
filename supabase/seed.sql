-- ============================================================================
-- Camareiras Vila Corada - Dados iniciais (seed)
-- Execute depois do schema.sql
-- ============================================================================

-- ---------- 11 quartos numerados de 1 a 11 ----------
insert into rooms (number, name, position)
select n::text, 'Suíte ' || n, n
from generate_series(1, 11) as n;

-- ---------- Categorias de ocorrências (conforme PRD) ----------
insert into occurrence_categories (name, position) values
  ('Cama', 1), ('Cortina', 2), ('Parede quarto', 3), ('Parede banheiro', 4),
  ('Porta quarto', 5), ('Porta banheiro', 6), ('Janela banheiro', 7), ('Janela quarto', 8),
  ('Iluminação quarto', 9), ('Iluminação banheiro', 10), ('Tomada quarto', 11), ('Tomada banheiro', 12),
  ('Aparelho de TV', 13), ('Ar condicionado', 14), ('Secador de cabelo', 15), ('Máquina de café', 16),
  ('Pia', 17), ('Chuveiro', 18), ('Vaso sanitário', 19), ('Vidro do box', 20),
  ('Bancadas', 21), ('Piso quarto', 22), ('Piso banheiro', 23), ('Forro quarto', 24),
  ('Forro banheiro', 25), ('Ralo', 26), ('Espelho', 27),
  ('Mau cheiro quarto', 28), ('Mau cheiro banheiro', 29);

-- ---------- Itens de checklist de arrumação (base: "Check List.pdf") ----------
with items(pos, label, description) as (
  values
    (1, 'Ventilar o quarto', 'Eliminar odores e deixar o ambiente arejado durante a arrumação.'),
    (2, 'Retirar o lixo', 'Esvaziar todas as lixeiras e colocar sacos novos.'),
    (3, 'Limpar superfícies', 'Criados-mudos, mesas, bancada, cabeceira, prateleiras e demais superfícies.'),
    (4, 'Limpar espelhos e vidros', 'Verificar marcas, manchas e resíduos.'),
    (5, 'Limpar o piso', 'Remover cabelos, areia, poeira e demais resíduos; limpar conforme o piso.'),
    (6, 'Arrumar a cama', 'Roupa limpa, sem manchas ou cabelos; cama bem esticada e apresentação padronizada.'),
    (7, 'Conferir travesseiros e protetores', 'Limpeza, odor, conservação e quantidade adequada.'),
    (8, 'Conferir cortinas e tecidos', 'Verificar poeira, manchas, cabelos e funcionamento.'),
    (9, 'Higienizar o banheiro', 'Vaso, pia, bancada, metais, box, chuveiro e demais superfícies.'),
    (10, 'Conferir toalhas', 'Quantidade correta, limpeza, manchas, fios soltos e conservação.'),
    (11, 'Repor amenities', 'Sabonete, shampoo, condicionador, papel higiênico e demais itens.'),
    (12, 'Conferir água e metais', 'Chuveiro, torneiras e descarga: funcionamento, vazamentos, pressão e temperatura.'),
    (13, 'Conferir iluminação', 'Testar lâmpadas, luminárias, abajures e interruptores.'),
    (14, 'Testar ar-condicionado', 'Funcionamento, controle remoto, temperatura e ruídos anormais.'),
    (15, 'Conferir minibar', 'Limpeza, funcionamento, temperatura, estoque e validade.'),
    (16, 'Conferir equipamentos', 'TV, controle, secador, tomadas e demais equipamentos do quarto.'),
    (17, 'Procurar problemas de manutenção', 'Mofo, infiltração, vazamentos, pintura, ferragens, trincas, cupins ou danos.'),
    (18, 'Conferir varanda/área externa', 'Piso, móveis, portas, vidros e ausência de folhas, areia ou insetos.'),
    (19, 'Inspeção final', 'Quarto visualmente impecável, organizado e conforme o padrão da pousada.'),
    (20, 'Liberar o quarto', 'Confirmar ausência de pertences de hóspede anterior e registrar qualquer ocorrência antes da liberação.')
)
insert into checklist_items (type, label, description, position)
select 'arrumacao'::checklist_type, label, description, pos from items;

-- ---------- Itens de checklist "Saída com Chegada" (type = preparacao) ----------
-- Quarto passa por giro completo: hóspede sai e outro chega no mesmo dia.
-- Baseado na mesma lista de arrumação, com 2 itens extras no início sobre
-- pertences esquecidos/itens do quarto que não podem ter sido levados.
insert into checklist_items (type, label, description, position) values
  ('preparacao', 'Verificar pertences esquecidos', 'Conferir armários, gavetas, cofre, banheiro e criados-mudos em busca de objetos esquecidos pelo hóspede que saiu.', 1),
  ('preparacao', 'Conferir itens do quarto', 'Confirmar que chaves, controles remotos, adaptadores e demais itens do quarto não foram levados pelo hóspede.', 2),
  ('preparacao', 'Ventilar o quarto', 'Eliminar odores e deixar o ambiente arejado durante a arrumação.', 3),
  ('preparacao', 'Retirar o lixo', 'Esvaziar todas as lixeiras e colocar sacos novos.', 4),
  ('preparacao', 'Limpar superfícies', 'Criados-mudos, mesas, bancada, cabeceira, prateleiras e demais superfícies.', 5),
  ('preparacao', 'Limpar espelhos e vidros', 'Verificar marcas, manchas e resíduos.', 6),
  ('preparacao', 'Limpar o piso', 'Remover cabelos, areia, poeira e demais resíduos; limpar conforme o piso.', 7),
  ('preparacao', 'Arrumar a cama', 'Roupa limpa, sem manchas ou cabelos; cama bem esticada e apresentação padronizada.', 8),
  ('preparacao', 'Conferir travesseiros e protetores', 'Limpeza, odor, conservação e quantidade adequada.', 9),
  ('preparacao', 'Conferir cortinas e tecidos', 'Verificar poeira, manchas, cabelos e funcionamento.', 10),
  ('preparacao', 'Higienizar o banheiro', 'Vaso, pia, bancada, metais, box, chuveiro e demais superfícies.', 11),
  ('preparacao', 'Conferir toalhas', 'Quantidade correta, limpeza, manchas, fios soltos e conservação.', 12),
  ('preparacao', 'Repor amenities', 'Sabonete, shampoo, condicionador, papel higiênico e demais itens.', 13),
  ('preparacao', 'Conferir água e metais', 'Chuveiro, torneiras e descarga: funcionamento, vazamentos, pressão e temperatura.', 14),
  ('preparacao', 'Conferir iluminação', 'Testar lâmpadas, luminárias, abajures e interruptores.', 15),
  ('preparacao', 'Testar ar-condicionado', 'Funcionamento, controle remoto, temperatura e ruídos anormais.', 16),
  ('preparacao', 'Conferir minibar', 'Limpeza, funcionamento, temperatura, estoque e validade.', 17),
  ('preparacao', 'Conferir equipamentos', 'TV, controle, secador, tomadas e demais equipamentos do quarto.', 18),
  ('preparacao', 'Procurar problemas de manutenção', 'Mofo, infiltração, vazamentos, pintura, ferragens, trincas, cupins ou danos.', 19),
  ('preparacao', 'Conferir varanda/área externa', 'Piso, móveis, portas, vidros e ausência de folhas, areia ou insetos.', 20),
  ('preparacao', 'Inspeção final', 'Quarto visualmente impecável, organizado e conforme o padrão da pousada.', 21),
  ('preparacao', 'Liberar o quarto', 'Confirmar que o quarto está pronto para ficar disponível e registrar qualquer ocorrência antes da liberação.', 22);

-- ---------- Itens de checklist "Somente Saída" ----------
-- Hóspede sai e não há chegada confirmada no mesmo dia (quarto pode ficar
-- vago); mesmo assim recebe limpeza completa (pode receber reserva de
-- última hora) e os mesmos itens de "Saída com Chegada" — só não ganha
-- itens de boas-vindas, que dependem de uma chegada com data certa.
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

-- ---------- Itens de checklist "Somente Chegada" ----------
-- Quarto já foi limpo por completo numa "Somente Saída" anterior (ou ficou
-- vago), então os itens de limpeza viram uma revisão mais leve; sem itens
-- de pertences esquecidos (ninguém está saindo); ganha itens de boas-vindas
-- (chocolate, flor, cheirinho) e ênfase em testar o funcionamento dos
-- aparelhos antes da chegada.
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

-- ---------- Itens de checklist de troca (troca de roupa de cama/toalhas) ----------
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

-- ---------- Associa todos os itens a todos os quartos ----------
insert into room_checklist_items (room_id, checklist_item_id, position)
select r.id, ci.id, ci.position
from rooms r
cross join checklist_items ci;

-- ---------- Categorias e itens de manutenção preventiva ----------
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

-- ---------- Mesas do café da manhã (layout conforme "Layout das Mesas.pdf") ----------
-- Coluna esquerda: mesas redondas 1-5 | Coluna direita: mesa 6 redonda, mesa 7 retangular, mesas 8-9 redondas
insert into breakfast_tables (label, shape, seats, pos_x, pos_y, width, height) values
  ('Mesa 1', 'round', 2, 40,  40,  70, 70),
  ('Mesa 2', 'round', 2, 40, 140,  70, 70),
  ('Mesa 3', 'round', 2, 40, 240,  70, 70),
  ('Mesa 4', 'round', 2, 40, 340,  70, 70),
  ('Mesa 5', 'round', 2, 40, 440,  70, 70),
  ('Mesa 6', 'round', 2, 220, 40,  70, 70),
  ('Mesa 7', 'rect',  6, 220, 140, 70, 220),
  ('Mesa 8', 'round', 2, 220, 390, 70, 70),
  ('Mesa 9', 'round', 2, 220, 490, 70, 70);
