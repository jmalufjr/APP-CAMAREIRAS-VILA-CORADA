-- Decisão do proprietário (16/10/2026, resposta à consulta sobre o 5º
-- centro de custo): só os itens claramente ADMINISTRATIVOS passam 100%
-- pro centro "Administração e áreas comuns" (criado na migration 074).
-- Hoje eles estão divididos 34/33/33 entre Bar de piscina, Hospedagem e
-- Café da manhã. Luz, água, internet e demais itens compartilhados
-- FICAM como estão (escolha explícita dele).
--
-- Aviso já dado e aceito: os vínculos item→centro são lidos ao vivo
-- pelos relatórios de custo, então mover um item também re-atribui os
-- períodos passados dele. (Lançamentos contábeis já gravados guardam o
-- centro da época — mas este módulo ainda não foi implantado em
-- produção, então não há lançamento real afetado.)
--
-- Idempotente: apaga os vínculos atuais desses itens e regrava o único
-- vínculo 100% — rodar de novo termina no mesmo estado.
delete from cost_item_centers
where cost_item_id in (
  select id from cost_items
  where name in (
    'Contabilidade (Simone Perla)',
    'Financeiro (Márcia)',
    'Stays (CMS)',
    'Invictos (Comercial e Atendimento)',
    'outras honorários administrativos',
    'pró-labore',
    'impostos e taxas'
  )
);

insert into cost_item_centers (cost_item_id, center_id, alloc_pct)
select ci.id, cc.id, 100
from cost_items ci
cross join cost_centers cc
where cc.name = 'Administração e áreas comuns'
  and ci.name in (
    'Contabilidade (Simone Perla)',
    'Financeiro (Márcia)',
    'Stays (CMS)',
    'Invictos (Comercial e Atendimento)',
    'outras honorários administrativos',
    'pró-labore',
    'impostos e taxas'
  );
