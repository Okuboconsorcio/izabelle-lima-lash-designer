-- =====================================================================
-- Izabelle Lima: apaga SOMENTE os dados de exemplo
-- (20 clientes de 26 a 30/10, 13 materiais e 9 compras colocados em 27/10/2026)
-- Não mexe em nada que a Izabelle cadastrou de verdade.
-- Rodar no SQL Editor do Supabase, projeto Data-NTO.
-- =====================================================================

-- 1) Conferir antes o que vai sair
select 'agendamentos' as o_que, count(*) from izabelle.appointments where source = 'exemplo'
union all select 'materiais', count(*) from izabelle.materials where exemplo
union all select 'compras',   count(*) from izabelle.purchases where exemplo
union all select 'despesas',  count(*) from izabelle.expenses  where exemplo;

-- 2) Apagar (as compras antes dos materiais)
delete from izabelle.appointments where source = 'exemplo';
delete from izabelle.purchases where exemplo;
delete from izabelle.materials where exemplo;
delete from izabelle.expenses where exemplo;
