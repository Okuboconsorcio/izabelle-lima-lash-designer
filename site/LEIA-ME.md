# Izabelle Lima: agendamento e painel

> Guia curto. A documentação completa (decisões, cuidados, banco e manutenção) está em `../DOCUMENTACAO.md`, e o SQL do banco em `../banco/`.

## Endereços
- **Site da cliente:** https://izabelle-lima.vercel.app
- **Painel:** https://izabelle-lima.vercel.app/admin.html. Quem tem acesso fica na tabela `izabelle.admins` do Supabase (projeto Data-NTO). Para dar acesso a outra pessoa, veja `../banco/04_trocar_dono_do_painel.sql`.

## Onde ficam as coisas
- **Banco:** Supabase, projeto *Data-NTO*, schema `izabelle` (separado dos outros apps). As regras de agenda (sem horário duplicado, almoço, dias fechados, limite de 3 horários por telefone) ficam no próprio banco.
- **Hospedagem:** Vercel, projeto `izabelle-lima` (equipe okuboconsorcios-projects).
- **Código:** GitHub, https://github.com/Okuboconsorcio/izabelle-lima-lash-designer
- **Publicar de novo depois de mudar algo:** rode o comando abaixo dentro da pasta `site`:
  `npx vercel@63.1.2 deploy --prod --scope okuboconsorcios-projects`
- **Modo demonstração (sem banco):** apague as linhas de `assets/js/config.js`. Os dados voltam a ficar só no navegador, e a senha volta a ser 1234.

## O que tem
**Site (cliente):** tabela de preços → escolhe o serviço → calendário com os dias livres → horário → nome e WhatsApp → confirmado.
Quando alguém agenda, aquele horário some para as próximas clientes, levando em conta quanto tempo cada serviço leva.

**Painel:**
- **Início:** resumo do dia, faturamento do mês e materiais acabando.
- **Agenda:** semana e dia; concluir (com valor e forma de pagamento), reagendar, cancelar, "não veio", WhatsApp da cliente, novo agendamento manual, bloquear horário ou folga e buscar cliente.
- **Financeiro:** entrou, saiu, lucro, atendimentos, quanto ainda vai entrar e faltas. Tem filtros de período, serviço e forma de pagamento, gráficos, a lista de lançamentos e a planilha (CSV).
- **Materiais:** estoque com aviso de "precisa comprar", botões "Usei" e "Comprei" e o histórico de compras, que entra no financeiro.
- **Serviços:** preço, duração e a opção de mostrar ou esconder no site.
- **Ajustes:** dados do estúdio, WhatsApp, dias e horários, almoço, antecedência mínima, senha e cópia de segurança.

## Trocar a identidade visual
Cores e fontes ficam no topo de `assets/css/base.css` (variáveis `--rose-*`, `--font-script` e `--font-sans`).
