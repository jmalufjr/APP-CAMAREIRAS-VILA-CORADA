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

-- ---------- Itens de checklist (base: "Check List.pdf") ----------
-- Mesma lista usada como padrão para arrumação e preparação; o admin pode diferenciar depois.
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
select 'arrumacao'::checklist_type, label, description, pos from items
union all
select 'preparacao'::checklist_type, label, description, pos from items;

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
