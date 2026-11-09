# Loanda Afiliados

React + Vite + TypeScript, Supabase (Auth, Postgres, Storage, Realtime), GitHub Pages.

## Estado por fase
| Fase | Estado |
|---|---|
| 1. Planeamento / arquitectura | Concluída (este documento) |
| 2. Base de dados | Escrita (`supabase/migrations/0001_schema.sql`), **ainda não executada nem testada** |
| 3–7 | Não iniciadas |

## Decisões de arquitectura
- Dinheiro em `bigint` (Kz inteiros); percentagens em pontos-base (1000 = 10%). Comissão = `preço * bp / 10000`, arredondada para baixo, calculada só na RPC `confirm_sale`.
- Snapshot de preço e % no pedido (`purchase_requests`) → alterar a % depois não afecta comissões antigas.
- Anti-duplicação: `sales.purchase_request_id UNIQUE`, `commissions.sale_id UNIQUE`, `SELECT ... FOR UPDATE` e verificação de estado.
- Pagamentos: `register_payment` aloca FIFO em `payment_allocations`, bloqueia o afiliado, rejeita excesso e é idempotente (`idempotency_key`).
- Atribuição: o servidor valida o `ref_code` (afiliado activo + produto) em `create_purchase_request`; código inválido = venda directa. Último clique vale: o frontend guarda a última ref válida (30 dias, só após consentimento) e envia-a.
- Administrador único: índice `only_one_admin`; sem registo público.
- Sem `service_role` no frontend; só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Afiliados não têm INSERT/UPDATE/DELETE em tabelas financeiras; tudo passa por RPC.

## Configuração externa necessária
1. Criar projecto em supabase.com → Project Settings → API (URL e anon key).
2. SQL Editor: colar e executar `0001_schema.sql`.
3. Registar a conta do administrador (Authentication → Users → Add user) e executar `insert into admin_users values ('<UUID>');`.
4. Authentication → Providers → Email (confirmação de e-mail e recuperação de palavra-passe).
5. Storage: criar bucket público `covers` e bucket privado `product-files`.
6. Database → Replication: activar Realtime para `notifications`.

## Publicar (GitHub Pages)
1. `npm install` e copiar `.env.example` para `.env` com URL e anon key; `npm run dev` para testar.
2. Repositório no GitHub → Settings → Secrets → Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Settings → Pages → Source: GitHub Actions. Fazer push para `main`; o workflow publica.
4. Supabase → Authentication → URL Configuration: adicionar o URL do site.
5. Executar `supabase/seed.sql` para criar as categorias.
