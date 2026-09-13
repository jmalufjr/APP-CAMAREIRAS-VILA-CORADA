-- Novo formato de mesa "Quadrada" no layout de mesas do café — o lado da
-- mesa quadrada usa a mesma dimensão do diâmetro da mesa redonda (mesmo
-- tamanho fixo 70x70 já usado pelas mesas redondas, só muda o visual:
-- círculo x quadrado x retângulo).
alter type table_shape add value 'square';
