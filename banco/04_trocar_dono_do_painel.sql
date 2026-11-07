-- =====================================================================
-- Izabelle Lima: quem pode entrar no painel
-- O acesso é a tabela izabelle.admins. A primeira conta que entrar no painel vira dona; depois, só por aqui.
-- Rodar no SQL Editor do Supabase, projeto Data-NTO.
-- =====================================================================

-- Ver quem tem acesso
select u.email, a.created_at
from izabelle.admins a join auth.users u on u.id = a.user_id;

-- Dar acesso a outra conta (a pessoa precisa ter criado a conta antes,
-- em "Primeiro acesso? Criar conta" no painel). Troque o e-mail:
-- insert into izabelle.admins (user_id)
-- select id from auth.users where lower(email) = 'email.da.pessoa@exemplo.com'
-- on conflict do nothing;

-- Tirar o acesso de alguém. Troque o e-mail:
-- delete from izabelle.admins
-- where user_id = (select id from auth.users where lower(email) = 'email.da.pessoa@exemplo.com');

-- Confirmar o e-mail de uma conta nova sem precisar do link
-- (o e-mail padrão do Supabase só chega para membros da organização). Troque o e-mail:
-- update auth.users set email_confirmed_at = now()
-- where lower(email) = 'email.da.pessoa@exemplo.com' and email_confirmed_at is null;
