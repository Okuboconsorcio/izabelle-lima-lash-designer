# Izabelle Lima: site de agendamento e painel de gestão

Documentação completa do projeto. Última atualização: 06/11/2026.

---

## 1. Resumo rápido

| O quê | Onde |
|---|---|
| Site da cliente (agendamento) | https://izabelle-lima.vercel.app |
| Painel da profissional | https://izabelle-lima.vercel.app/admin.html |
| Código-fonte | GitHub: https://github.com/Okuboconsorcio/izabelle-lima-lash-designer (cópia de trabalho nesta pasta do OneDrive) |
| Hospedagem do site | Vercel, projeto `izabelle-lima`, equipe *okuboconsorcios-projects* |
| Banco de dados | Supabase, projeto **Data-NTO** (`dkwtidhcuvrdzfcewfoz`, São Paulo), schema `izabelle` |
| Dono do painel | Ainda não definido no Data-NTO: a primeira conta criada no painel vira dona (ver seção 10) |
| SQL do banco | Pasta `banco/` (ao lado desta documentação) |

---

## 2. Onde cada coisa está guardada

### 2.1 O código
- **Fica no GitHub**, repositório `Okuboconsorcio/izabelle-lima-lash-designer`, com histórico de todas as mudanças.
- Esta pasta do OneDrive é a **cópia de trabalho**: edita-se aqui, grava-se no Git (commit) e envia-se para o GitHub (push).
- O site é **HTML, CSS e JavaScript puros**: sem framework e sem etapa de "build". O que está em `site/` é exatamente o que vai para o ar.

### 2.2 O site no ar (hospedagem)
- Fica na **Vercel**, projeto `izabelle-lima`, na equipe *okuboconsorcios-projects* (conta *okuboconsorcio*).
- A publicação hoje é feita pela **Vercel CLI**, a partir deste computador, enviando a pasta `site/` (seção 7.1).
- **A Vercel ainda não está ligada ao GitHub:** enviar código para o GitHub **não** atualiza o site sozinho. É preciso publicar pela CLI, ou ligar os dois (seção 10).
- O vínculo da pasta com o projeto da Vercel fica em `site/.vercel/project.json`.

### 2.3 Os dados (banco)
- Ficam no **Supabase**, projeto **Data-NTO** (região sa-east-1, São Paulo), num schema próprio chamado `izabelle` (mais o `izabelle_private`, só para funções internas).
- O Data-NTO é **compartilhado** com outros sistemas (schemas `financeiro_nick` e `nucleo`). As tabelas da Izabelle ficam separadas, mas **o cadastro de login (contas e senhas) é um só para o projeto inteiro** (ver seção 6).
- **Histórico:** de 27/10 a 06/11/2026 o banco ficou no projeto *Moka-pd*. Em 06/11/2026 tudo foi migrado para o Data-NTO, conferido tabela por tabela, e o schema foi apagado do Moka-pd.

---

## 3. Arquivos do projeto

```
Izabelle Lima/               ← raiz do repositório Git
├── DOCUMENTACAO.md          ← este arquivo
├── .gitignore               ← o que NÃO vai para o GitHub
├── banco/                   ← SQL do banco (não vai para o site)
│   ├── 01_estrutura.sql         tabelas, regras, segurança e dados iniciais
│   ├── 02_marcacao_exemplo.sql  coluna "exemplo" em materiais/compras/despesas
│   ├── 03_apagar_exemplos.sql   apaga só os dados de exemplo
│   └── 04_trocar_dono_do_painel.sql  dar/tirar acesso ao painel
├── TABELA OUT-2026/         ← fotos originais das tabelas de preço (identidade visual)
└── site/                    ← TUDO o que vai para o ar
    ├── index.html               site da cliente
    ├── admin.html               painel
    ├── LEIA-ME.md               guia curto (não é publicado)
    ├── .vercelignore            arquivos que NÃO vão para o ar
    ├── .vercel/                 vínculo com a Vercel (fora do Git)
    ├── .env.local               criado pela Vercel CLI; contém um token; fora do Git e do site
    └── assets/
        ├── css/base.css         cores, fontes e componentes comuns
        ├── css/site.css         visual do site da cliente
        ├── css/admin.css        visual do painel
        ├── js/config.js         endereço e chave pública do Supabase (Data-NTO)
        ├── js/store.js          toda a comunicação com o banco e as regras de agenda
        ├── js/ui.js             janelas, avisos, calendário e ícones
        ├── js/site.js           fluxo de agendamento da cliente
        ├── js/admin.js          todas as telas do painel
        └── img/                 fotos (pinca.jpg é usada no topo do site)
```

---

## 4. Como funciona

### 4.1 Site da cliente (`index.html`)
1. A cliente vê a **tabela de preços** (Sobrancelha, Buço, Cílios) e toca no serviço.
2. Aparece um **calendário** só com os dias que ainda têm horário livre e, ao lado, os **horários livres** do dia (manhã, tarde, noite).
3. Ela informa **nome e WhatsApp** (observação opcional) e confirma.
4. Tela de **"Agendado!"** com botões para avisar a profissional pelo WhatsApp e para salvar na agenda do celular (Google Agenda).

**Como os horários livres são calculados:** dias e horários de atendimento, intervalo de almoço, **duração de cada serviço** (um serviço de 2h ocupa 2h), agendamentos já feitos, bloqueios (folgas), antecedência mínima e até quantos dias à frente se pode agendar. Tudo configurável em *Ajustes*.

**Proteção contra horário duplicado:** mesmo que duas clientes cliquem no mesmo horário ao mesmo tempo, o **banco** confere de novo antes de gravar e recusa a segunda ("Esse horário acabou de ser reservado por outra pessoa"). A cliente nunca vê nomes ou telefones de outras clientes, só quais horários estão ocupados.

### 4.2 Painel (`admin.html`)
O login é com e-mail e senha. Só quem está na lista de donos (tabela `izabelle.admins`) consegue ver os dados.

| Tela | O que faz |
|---|---|
| **Início** | Faturamento do mês (comparado com o mesmo período do mês anterior), atendimentos de hoje, próximos 7 dias, materiais acabando, agenda do dia e próximos agendamentos |
| **Agenda** | Semana com a quantidade de clientes por dia; ao tocar no dia: concluir (valor e forma de pagamento), reagendar, cancelar, "não veio", WhatsApp da cliente; novo agendamento manual; bloquear horário/folga; busca por nome ou telefone |
| **Financeiro** | Entrou, saiu, sobrou (lucro/prejuízo), atendimentos e ticket médio, quanto ainda vai entrar, taxa de faltas. Filtros por período, serviço e pagamento. Gráficos, lista de lançamentos, "Lançar despesa" e "Baixar planilha" (CSV) |
| **Materiais** | Estoque com aviso de "precisa comprar", botões "Usei" e "Comprei" (a compra soma no estoque e entra no financeiro) e histórico de compras |
| **Serviços** | Preço, duração e observação; interruptor para mostrar ou esconder no site |
| **Ajustes** | Nome, WhatsApp, endereço, Instagram; dias e horários; almoço; intervalo entre horários; antecedência mínima; dias à frente; troca de senha; baixar cópia dos dados |

**Tempo real:** quando uma cliente agenda pelo site, o agendamento aparece no painel aberto em cerca de 2 segundos, sem recarregar.

---

## 5. Banco de dados (schema `izabelle`)

### 5.1 Tabelas

| Tabela | Guarda | Quem pode ler | Quem pode alterar |
|---|---|---|---|
| `settings` | Ajustes (uma linha, em JSON) | Todos | Só o dono |
| `services` | Serviços e preços | Todos (só os ativos) | Só o dono |
| `appointments` | Agendamentos | Só o dono | Só o dono (a cliente agenda pela função `book_appointment`) |
| `blocks` | Bloqueios/folgas | Só o dono | Só o dono |
| `materials` | Materiais e estoque | Só o dono | Só o dono |
| `purchases` | Compras de material | Só o dono | Só o dono |
| `expenses` | Outras despesas | Só o dono | Só o dono |
| `admins` | Quem é dono do painel | Cada um vê só a si mesmo | Só pelo SQL (ou o primeiro login, se estiver vazia) |

**Status de agendamento:** `agendado`, `concluido` (realizado), `cancelado`, `faltou` (não compareceu).
**Formas de pagamento:** `pix`, `dinheiro`, `debito`, `credito`.

### 5.2 Regras que ficam no próprio banco
- **`book_appointment`** (agendamento pelo site): serviço ativo, nome e WhatsApp válidos, dia de atendimento, dentro do horário, fora do almoço, não está no passado nem em cima da hora, dentro da janela de dias, e **máximo de 3 horários futuros por telefone** (contra spam).
- **Gatilho `check_overlap`**: em qualquer gravação (site ou painel), recusa horário que bata com outro atendimento ou com um bloqueio.
- **`busy_ranges`**: devolve ao site só os intervalos ocupados, sem dados pessoais.
- **`claim_admin`**: se ainda não houver dono, o primeiro login no painel vira dono; depois disso fica travado.

### 5.3 Segurança
- A chave em `config.js` é a **chave pública (publishable)** do Data-NTO, feita para ficar no navegador. Quem protege os dados são as regras de acesso (RLS), testadas no Data-NTO em 06/11/2026: visitante não lê a agenda nem altera ajustes; pessoa logada que não é dona não vê nada.
- **Nunca** coloque a chave `service_role`/`secret` no site nem no GitHub.

---

## 6. Cuidados importantes

1. **O login é compartilhado com os outros sistemas do Data-NTO.** Na prática:
   - ter conta no Data-NTO **não** dá acesso ao painel: é preciso estar em `izabelle.admins`;
   - **enquanto não houver dono**, qualquer conta do Data-NTO que entrar no painel vira dona; por isso, crie a sua logo (seção 10);
   - "Criar conta" com um e-mail que já existe no Data-NTO não cria nada e não manda e-mail (o painel avisa).
2. **Lista de schemas da API.** O `izabelle` foi incluído em Supabase (Data-NTO) → *Settings → API → Exposed schemas*, junto com `public`, `graphql_public` e `financeiro_nick`. **Se alguém tirar o `izabelle` dessa lista, o site para de carregar.**
3. **"Esqueci a senha" e confirmação de e-mail.** Para os links do e-mail voltarem ao painel, `https://izabelle-lima.vercel.app/**` precisa estar em Supabase (Data-NTO) → *Authentication → URL Configuration → Redirect URLs*.
4. **E-mails do Supabase.** O serviço padrão **só envia para membros da organização** e tem limite de poucos por hora. Para cadastrar alguém de fora (ex.: a Izabelle), use `banco/04_trocar_dono_do_painel.sql` para confirmar a conta e dar acesso, ou configure um SMTP próprio.
5. **Biblioteca externa.** O site carrega a biblioteca do Supabase de `cdn.jsdelivr.net` (versão fixa 2.115.0). Se ela não carregar, o site mostra um aviso em vez de funcionar sem o banco (nunca salva agendamento só no navegador).
6. **Cópia de segurança.** No painel, *Ajustes → Baixar cópia dos dados*. O GitHub guarda o **código**, não os dados.

---

## 7. Manutenção: como fazer

### 7.1 Mudar algo no site, guardar no GitHub e publicar
1. Edite os arquivos dentro de `site/`.
2. Para testar no computador: na pasta do projeto, rode `python -m http.server 5173 --directory site` e acesse http://localhost:5173. **Atenção:** o teste local usa o banco de verdade.
3. Guarde no GitHub (na pasta do projeto):
   ```
   git add -A
   git commit -m "descreva a mudança"
   git push
   ```
4. Publique (dentro da pasta `site`):
   ```
   npx vercel@63.1.2 deploy --prod --scope okuboconsorcios-projects
   ```
   Em cerca de 1 minuto o site atualiza. (A Vercel CLI precisa estar logada na conta *okuboconsorcio*; neste computador já está.)

### 7.2 Trocar a identidade visual
- Cores e fontes no topo de `assets/css/base.css`: `--rose-*` (rosas), `--ink-*` (textos), `--font-script` (Allura, cursiva) e `--font-sans` (Lexend).
- As fontes vêm do Google Fonts, no `<head>` de `index.html` e `admin.html`.
- A foto do topo é `assets/img/pinca.jpg` (recortada das tabelas de preço).

### 7.3 Mudar preços, serviços, horários
Pelo próprio painel, em *Serviços* e *Ajustes*. As mudanças aparecem no site na hora.

### 7.4 Dar ou tirar acesso ao painel
`banco/04_trocar_dono_do_painel.sql`, no SQL Editor do Supabase (projeto Data-NTO).

### 7.5 Recriar o banco do zero (outro projeto)
Rode `banco/01_estrutura.sql` e depois `banco/02_marcacao_exemplo.sql`. Antes, ajuste no final do `01` a lista de schemas expostos do projeto de destino, e troque endereço e chave em `site/assets/js/config.js`.

### 7.6 Modo demonstração (sem banco)
Apagando as linhas de `site/assets/js/config.js`, site e painel funcionam só no navegador, com dados de exemplo e senha `1234`. **Só para demonstrar, nunca no site publicado.**

---

## 8. Dados de exemplo (para a Izabelle visualizar)

Colocados em 27/10/2026 e migrados para o Data-NTO; marcados para sair de uma vez:

| O quê | Quantidade | Marcação |
|---|---|---|
| Clientes de 26 a 30/10 (nomes e telefones inventados) | 20 (1 cancelado, 2 "não veio") | `source = 'exemplo'` |
| Materiais | 13 (5 na lista de compras) | `exemplo = true` |
| Compras de outubro | 9 (R$ 486,80) | `exemplo = true` |

Eles **contam no financeiro e ocupam horários no site**. Para remover: `banco/03_apagar_exemplos.sql` (ou peça ao Claude). Isso não mexe em nada real.

> Existe também **1 agendamento real**, feito pelo site em 27/10 para 29/10 às 17:00 (*Egípcio, colocação*). Ele **não** é apagado pelo script de exemplos.

---

## 9. Histórico

| Data | O que foi feito |
|---|---|
| 27/10/2026 | Site e painel criados com a identidade das tabelas OUT-2026, primeiro em modo demonstração |
| 27/10/2026 | Banco criado no Supabase, projeto Moka-pd (schema `izabelle`), com regras de agenda e segurança; site ligado ao banco |
| 27/10/2026 | Publicado na Vercel (https://izabelle-lima.vercel.app) |
| 27/10/2026 | Correções: sem queda para modo demonstração; aviso de e-mail já cadastrado; link de nova senha; contagem do dia sem "não veio" |
| 27/10/2026 | Painel testado de ponta a ponta; dados de teste apagados; clientes, materiais e compras de exemplo incluídos |
| 06/11/2026 | Documentação e SQL do banco salvos na pasta |
| 06/11/2026 | **Migração para o projeto Data-NTO:** estrutura recriada, dados copiados com os mesmos identificadores e conferidos (impressão digital idêntica em todas as tabelas), regras e segurança testadas, site republicado apontando para o Data-NTO |
| 06/11/2026 | Schema `izabelle` apagado do Moka-pd e retirado da lista de schemas da API de lá; os outros sistemas do Moka-pd seguem funcionando |
| 06/11/2026 | Código enviado ao GitHub (`Okuboconsorcio/izabelle-lima-lash-designer`) |

---

## 10. Pendências e próximos passos

**Urgentes (por causa da migração):**
- [ ] **Criar a conta de dono no Data-NTO:** abra o painel, clique em "Primeiro acesso? Criar conta", confirme pelo e-mail e entre. A primeira conta que entrar vira dona. As contas do Moka-pd **não** valem no Data-NTO.
- [ ] Adicionar `https://izabelle-lima.vercel.app/**` em Data-NTO → *Authentication → URL Configuration → Redirect URLs*.

**Antes de divulgar o site:**
- [ ] Preencher em *Ajustes* o **WhatsApp, endereço e Instagram** da Izabelle.
- [ ] Conferir **dias, horários** e **durações** dos serviços (as atuais são estimativas).
- [ ] **Apagar os dados de exemplo.**

**Opcionais:**
- [ ] Ligar a Vercel ao GitHub (vercel.com → projeto *izabelle-lima* → *Settings → Git* → conectar o repositório, com *Root Directory* = `site`), para cada envio ao GitHub publicar sozinho.
- [ ] Login próprio da Izabelle no painel.
- [ ] Domínio próprio (ex.: izabellelima.com.br).
- [ ] SMTP próprio no Supabase, para os e-mails de senha chegarem a qualquer pessoa.
