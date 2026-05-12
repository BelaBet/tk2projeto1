
# Revisão das áreas Manager e Admin

Objetivo: corrigir bugs reais, padronizar conteúdo PT-BR, alinhar visual e remover sobras de código antigo nas páginas autenticadas de gestão e plataforma.

---

## 1. Bugs e correções funcionais (prioridade alta)

**`/manage/members` — envio de mensagem em massa quebrado**
- Hoje insere **uma única** linha em `messages` com `target_type: "individual"` e `target_id: null` — viola o RLS de leitura do membro (`target_id = auth.uid()`), então ninguém vê.
- Corrigir: inserir **N mensagens** (uma por destinatário com `target_id = pid`) **ou** usar `target_type: "broadcast"` quando a seleção cobre todos. Vou seguir a 1ª opção (N inserts) para manter o registro individual.
- Também: trocar o `<select>` nativo por `<Select>` do design system.

**`/admin/tenants` — `prompt()`/`confirm()` nativos**
- Substituir o `confirm("Excluir…")` por `<AlertDialog>` e o `prompt("Motivo…")` por `<Dialog>` com `<Textarea>`. Mantém UX consistente com o resto do app.

**`/manage/settings` — placeholder ("…virão na fase 4")**
- Implementar tela real de configurações do tenant, lendo/gravando em `tenants`:
  - Nome, slug (read-only), tagline
  - Logo URL, capa
  - Cor primária e cor de destaque (color pickers, igual a `/admin/settings`)
  - Chave PIX
- Salva via `supabase.from("tenants").update(...).eq("id", profile.tenant_id)` (RLS já permite admin do tenant).

---

## 2. Conteúdo / textos PT-BR

- Títulos da aba (`<title>`) hoje começam com `"ERP — ..."`. Padronizar para o nome do produto (vou usar `"Painel — <página>"` para não vazar “ERP” pro usuário). Aplicar em `admin.dashboard`, `admin.audit`, `admin.tenants`, `admin.billing`, `admin.settings`.
- `/admin/audit`: revisar copy ("Ações, alterações financeiras…"). Substituir por descrição mais curta e clara.
- `/admin/billing`: mesma pegada — encurtar subtítulo.
- `/manage/dashboard`: subtítulo "Visão geral da sua comunidade" → "Visão geral da sua igreja" (consistente com o restante do produto que usa “igreja”).
- Status em `/admin/billing` (active/past_due/etc.) ainda aparecem em inglês na badge — traduzir.

---

## 3. Visual / UX

- Padronizar `<EmptyState>`: hoje cada tabela usa textos diferentes ("Nenhum membro encontrado", "Nenhum registro.", "Nenhuma fatura ainda."). Criar um pequeno componente `EmptyRow` em `src/components/empty-row.tsx` e reutilizar nas 4 tabelas.
- Padronizar `<LoadingRow>` (idem — hoje "Carregando…" repetido em vários estilos).
- KPI cards: `admin.dashboard` e `manage.dashboard` definem `Kpi` localmente com layouts levemente diferentes. Extrair para `src/components/kpi-card.tsx` reutilizável.
- Espaçamento mobile: `manage.tsx` e `admin.tsx` usam `-mx-6 -my-8` para sangrar a sidebar; em `390px` a área do `<main className="p-6">` aperta demais. Reduzir para `p-4 sm:p-6` e remover sangria horizontal só no mobile.
- `/admin/tenants` e `/admin/billing`: tabelas largas — adicionar `min-w-[720px]` para forçar scroll horizontal limpo no mobile (em vez de quebrar colunas).
- Tokens de cor: `manager-sidebar.tsx` usa `bg-primary` direto — ok. `admin-sidebar.tsx` usa `bg-zinc-950 text-zinc-100 bg-amber-500` hard-coded. Trocar por tokens semânticos (`bg-sidebar bg-accent`) para respeitar o tema.

---

## 4. Higiene de código

- `/manage/members` ainda tem comentários/imports remanescentes da remoção de grupos (`Group` type já saiu, mas confirmar que `getGroups` etc. foram limpos). Passar uma vassoura final.
- `audit_logs` insere em todo login — manter, mas verificar se não está duplicando registros (1 chamada em `loadProfile` já cobre).

---

## Detalhes técnicos

- `Bulk message`: trocar 1 insert por `await supabase.from("messages").insert(ids.map(pid => ({ ...base, target_id: pid })))` + manter as `notifications`.
- `manage.settings`: form controlado com `useState`, carregar `tenants` por `id = profile.tenant_id`, salvar com `update`. Disparar `refresh()` do `useAuth` ao salvar para atualizar o branding (TenantThemeBridge já reativo).
- Não tocar em `src/integrations/supabase/*`, nem na sidebar mobile do `_authenticated.tsx` (já ajustada na rodada anterior).

---

## Arquivos afetados

```text
src/routes/_authenticated/manage.members.tsx     (bug + Select)
src/routes/_authenticated/manage.settings.tsx    (implementar)
src/routes/_authenticated/manage.dashboard.tsx   (KPI compartilhado, copy)
src/routes/_authenticated/admin.dashboard.tsx    (KPI compartilhado, head title)
src/routes/_authenticated/admin.tenants.tsx      (AlertDialog, Dialog, head title)
src/routes/_authenticated/admin.billing.tsx      (status PT-BR, head title, min-w)
src/routes/_authenticated/admin.audit.tsx        (copy, head title)
src/routes/_authenticated/admin.settings.tsx     (head title)
src/routes/_authenticated/admin.tsx              (padding mobile)
src/routes/_authenticated/manage.tsx             (padding mobile)
src/components/admin-sidebar.tsx                 (tokens de cor)
src/components/kpi-card.tsx                      (NOVO)
src/components/empty-row.tsx                     (NOVO)
```

Sem migrations. Sem mudanças em RLS. Apenas frontend + correção de payload de mensagens.
