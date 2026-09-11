-- Encurta o nome de dois itens do bar da piscina, removendo a descrição
-- entre parênteses (o texto ficava longo demais nos cards de consumo).
update poolbar_items
set name = 'Salada trivial'
where name = 'Salada trivial (Folhas/Tomate/Cebola/Ovos/Palmito)';

update poolbar_items
set name = 'Americano'
where name = 'Americano (Pão forma/Presunto/Queijo/Ovo/Salada)';
