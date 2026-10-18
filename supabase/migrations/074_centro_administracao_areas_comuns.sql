-- Módulo Contábil — correção de aderência ao PRD: 5º centro de custo
-- obrigatório. O documento original (PRD_compras&contabil.md, seção 22.1,
-- item 2.1) lista CINCO centros obrigatórios — Hospedagem, Café da manhã,
-- Bar da piscina, Frigobar e "Administração e áreas comuns" (custos
-- administrativos e gastos compartilhados não atribuíveis diretamente a
-- um dos quatro centros anteriores) — e só os quatro primeiros existiam.
--
-- O centro nasce SEM nenhum item de custo ligado: decidir quais itens
-- hoje ligados a Hospedagem/Café da manhã/Bar da piscina passam a ele é
-- uma escolha do proprietário (muda os totais de cada centro nos
-- relatórios, inclusive de períodos passados, já que os vínculos
-- item→centro são lidos ao vivo, sem histórico de vigência).
--
-- Idempotente: cost_centers.name é único, então rodar de novo não duplica.
insert into cost_centers (name, position)
values (
  'Administração e áreas comuns',
  (select coalesce(max(position), 0) + 1 from cost_centers)
)
on conflict (name) do nothing;
