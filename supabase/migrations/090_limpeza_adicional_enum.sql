-- Limpeza adicional (PRD_limpeza_adicional.md): novo tipo de checklist para os itens extras.
-- Rodar SOZINHA (valor novo de enum nao pode ser usado na mesma transacao).
alter type checklist_type add value if not exists 'limpeza_adicional';
