-- Bug encontrado em teste manual (Parte 05): a tela "Comanda" da camareira
-- mostrava "—" no lugar do nome de quem fez a última ação sempre que essa
-- ação foi de OUTRA camareira, não dela mesma. Causa: a única policy de
-- select em profiles era "própria linha ou admin" — o join embutido para
-- buscar o nome de created_by/last_action_by falha silenciosamente (volta
-- null) quando o dono da linha é outra camareira, e a RLS bloqueia. Mesmo
-- padrão de "profiles_manutencao_select_camareiras" (funcionário de
-- manutenção já podia ver colegas), só que faltava a camareira ver colegas.
create policy "profiles_camareira_select_camareiras" on profiles for select
  using (is_camareira() and role = 'camareira');
