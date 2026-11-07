-- =====================================================================
-- Izabelle Lima: marcação "exemplo" para dados de demonstração
-- Aplicado em 27/10/2026 no Moka-pd e, em 06/11/2026, no Data-NTO (projeto atual) como migração "izabelle_flag_exemplo".
-- Agendamentos de exemplo usam source = 'exemplo' (coluna que já existia).
-- =====================================================================
alter table izabelle.materials add column exemplo boolean not null default false;
alter table izabelle.purchases add column exemplo boolean not null default false;
alter table izabelle.expenses add column exemplo boolean not null default false;
notify pgrst, 'reload schema';
