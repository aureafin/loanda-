-- LOANDA AFILIADOS — esquema, RLS e funções financeiras
-- Valores monetários: bigint em Kz inteiros. Percentagens: pontos-base (bp), 1000 bp = 10%.
create extension if not exists pgcrypto;

create type product_type as enum ('livro','curso','documento','planilha','fisico','outro');
create type request_status as enum ('pendente','confirmada','nao_realizada','cancelada');
create type affiliate_status as enum ('ativo','suspenso');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Perfis e administrador único
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null, phone text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table admin_users (user_id uuid primary key references auth.users on delete restrict);
create unique index only_one_admin on admin_users ((true));

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid()) $$;

-- Catálogo
create table categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, short_description text, description text,
  category_id uuid references categories on delete set null,
  type product_type not null default 'outro',
  price_kz bigint not null check (price_kz >= 0),
  commission_bp int not null default 1000 check (commission_bp between 0 and 10000),
  is_published boolean not null default false, is_available boolean not null default true,
  stock int check (stock is null or stock >= 0), is_featured boolean not null default false,
  cover_url text, gallery jsonb not null default '[]', published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on products (is_published, category_id);
create table product_files (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products on delete cascade,
  storage_path text not null, kind text not null default 'digital', created_at timestamptz not null default now()
);

-- Afiliados
create table affiliates (
  id uuid primary key references profiles on delete restrict,
  province text not null, municipality text not null,
  status affiliate_status not null default 'ativo', terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table affiliate_bank (
  affiliate_id uuid primary key references affiliates on delete restrict,
  holder_name text not null, bank text not null, iban text not null, updated_at timestamptz not null default now()
);
create table affiliate_products (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates on delete restrict,
  product_id uuid not null references products on delete restrict,
  ref_code text not null unique, created_at timestamptz not null default now(),
  unique (affiliate_id, product_id)
);

-- Rastreamento
create table referral_visits (
  id uuid primary key default gen_random_uuid(), affiliate_product_id uuid not null references affiliate_products,
  visitor_id text, source text, created_at timestamptz not null default now()
);
create table product_events (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products,
  affiliate_product_id uuid references affiliate_products,
  event_type text not null check (event_type in ('view','click','whatsapp')),
  visitor_id text, created_at timestamptz not null default now()
);
create index on product_events (product_id, event_type, created_at);
create index on product_events (affiliate_product_id, event_type, created_at);

-- Pedidos, vendas, comissões
create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default ('LA-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,8))),
  product_id uuid not null references products,
  affiliate_product_id uuid references affiliate_products,
  affiliate_id uuid references affiliates,
  price_kz bigint not null check (price_kz >= 0),          -- preço anunciado (snapshot)
  commission_bp int not null default 0,                    -- % vigente no momento (snapshot)
  customer_name text, customer_phone text,
  status request_status not null default 'pendente',
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create index on purchase_requests (status, created_at desc);
create index on purchase_requests (affiliate_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null unique references purchase_requests,   -- 1 venda por pedido
  product_id uuid not null references products, affiliate_id uuid references affiliates,
  amount_kz bigint not null check (amount_kz >= 0),
  confirmed_by uuid not null references auth.users, confirmed_at timestamptz not null default now()
);
create table commissions (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references sales,                           -- 1 comissão por venda
  affiliate_id uuid not null references affiliates, product_id uuid not null references products,
  commission_bp int not null, amount_kz bigint not null check (amount_kz >= 0),
  paid_kz bigint not null default 0, created_at timestamptz not null default now(),
  check (paid_kz between 0 and amount_kz)
);
create index on commissions (affiliate_id);
create table affiliate_payments (
  id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references affiliates,
  amount_kz bigint not null check (amount_kz > 0), paid_on date not null, reference text,
  idempotency_key text not null unique, created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);
create table payment_allocations (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references affiliate_payments,
  commission_id uuid not null references commissions, amount_kz bigint not null check (amount_kz > 0)
);

create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  title text not null, body text, is_read boolean not null default false, created_at timestamptz not null default now()
);
create index on notifications (user_id, is_read, created_at desc);
create table audit_logs (
  id uuid primary key default gen_random_uuid(), actor uuid, action text not null,
  entity text, entity_id text, details jsonb, created_at timestamptz not null default now()
);

create trigger t_products_upd before update on products for each row execute function set_updated_at();
create trigger t_profiles_upd before update on profiles for each row execute function set_updated_at();

-- Auditoria de preço/comissão/publicação
create or replace function audit_product_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.price_kz is distinct from old.price_kz or new.commission_bp is distinct from old.commission_bp
     or new.is_published is distinct from old.is_published then
    insert into audit_logs(actor, action, entity, entity_id, details) values (auth.uid(), 'product_changed', 'products', new.id::text,
      jsonb_build_object('price', jsonb_build_array(old.price_kz, new.price_kz),
        'commission_bp', jsonb_build_array(old.commission_bp, new.commission_bp),
        'published', jsonb_build_array(old.is_published, new.is_published)));
  end if;
  return new;
end $$;
create trigger t_products_audit after update on products for each row execute function audit_product_change();

-- ===== RPCs públicas (anon) =====
create or replace function track_event(p_product_id uuid, p_ref_code text, p_type text, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ap uuid;
begin
  if p_type not in ('view','click') then raise exception 'tipo inválido'; end if;
  perform 1 from products where id = p_product_id and is_published;
  if not found then return; end if;
  select ap.id into v_ap from affiliate_products ap join affiliates a on a.id = ap.affiliate_id
   where ap.ref_code = p_ref_code and ap.product_id = p_product_id and a.status = 'ativo';
  insert into product_events(product_id, affiliate_product_id, event_type, visitor_id) values (p_product_id, v_ap, p_type, p_visitor);
  if v_ap is not null and p_type = 'view' then
    insert into referral_visits(affiliate_product_id, visitor_id, source) values (v_ap, p_visitor, 'link');
  end if;
end $$;

create or replace function create_purchase_request(p_product_id uuid, p_ref_code text, p_visitor text)
returns table (public_code text, product_name text) language plpgsql security definer set search_path = public as $$
declare p products; v_ap uuid; v_aff uuid; v_code text;
begin
  select * into p from products where id = p_product_id and is_published and is_available;
  if not found then raise exception 'produto indisponível'; end if;
  if p_ref_code is not null then
    select ap.id, ap.affiliate_id into v_ap, v_aff from affiliate_products ap join affiliates a on a.id = ap.affiliate_id
     where ap.ref_code = p_ref_code and ap.product_id = p.id and a.status = 'ativo';
  end if;   -- referência inválida/suspensa => venda direta
  insert into purchase_requests(product_id, affiliate_product_id, affiliate_id, price_kz, commission_bp)
    values (p.id, v_ap, v_aff, p.price_kz, case when v_aff is null then 0 else p.commission_bp end)
    returning purchase_requests.public_code into v_code;
  insert into product_events(product_id, affiliate_product_id, event_type, visitor_id) values (p.id, v_ap, 'whatsapp', p_visitor);
  return query select v_code, p.name;
end $$;

-- ===== RPCs do afiliado =====
create or replace function promote_product(p_product_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform 1 from affiliates where id = auth.uid() and status = 'ativo';
  if not found then raise exception 'afiliado inexistente ou suspenso'; end if;
  perform 1 from products where id = p_product_id and is_published;
  if not found then raise exception 'produto indisponível'; end if;
  loop
    begin
      insert into affiliate_products(affiliate_id, product_id, ref_code)
        values (auth.uid(), p_product_id, 'A' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8)))
        on conflict (affiliate_id, product_id) do nothing;
      select ref_code into v_code from affiliate_products where affiliate_id = auth.uid() and product_id = p_product_id;
      return v_code;
    exception when unique_violation then null;  -- colisão de código: tenta outro
    end;
  end loop;
end $$;

-- ===== RPCs administrativas (atómicas) =====
create or replace function confirm_sale(p_request_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare r purchase_requests; v_sale uuid; v_comm bigint;
begin
  if not is_admin() then raise exception 'acesso negado'; end if;
  select * into r from purchase_requests where id = p_request_id for update;
  if not found then raise exception 'pedido inexistente'; end if;
  if r.status <> 'pendente' then raise exception 'pedido já resolvido (%)', r.status; end if;
  update purchase_requests set status = 'confirmada', resolved_at = now() where id = r.id;
  insert into sales(purchase_request_id, product_id, affiliate_id, amount_kz, confirmed_by)
    values (r.id, r.product_id, r.affiliate_id, r.price_kz, auth.uid()) returning id into v_sale;
  if r.affiliate_id is not null then
    v_comm := (r.price_kz * r.commission_bp) / 10000;       -- inteiro, arredondado para baixo
    insert into commissions(sale_id, affiliate_id, product_id, commission_bp, amount_kz)
      values (v_sale, r.affiliate_id, r.product_id, r.commission_bp, v_comm);
    insert into notifications(user_id, title, body) values
      (r.affiliate_id, 'Venda confirmada', 'Uma venda através do seu link foi confirmada. Comissão de ' || v_comm || ' Kz adicionada à carteira.');
  end if;
  insert into audit_logs(actor, action, entity, entity_id, details)
    values (auth.uid(), 'sale_confirmed', 'purchase_requests', r.id::text, jsonb_build_object('amount_kz', r.price_kz, 'commission_kz', v_comm));
  return v_sale;
end $$;

create or replace function reject_sale(p_request_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare r purchase_requests;
begin
  if not is_admin() then raise exception 'acesso negado'; end if;
  select * into r from purchase_requests where id = p_request_id for update;
  if not found or r.status <> 'pendente' then raise exception 'pedido inexistente ou já resolvido'; end if;
  update purchase_requests set status = 'nao_realizada', resolved_at = now() where id = r.id;
  insert into audit_logs(actor, action, entity, entity_id) values (auth.uid(), 'sale_rejected', 'purchase_requests', r.id::text);
end $$;

create or replace function register_payment(p_affiliate_id uuid, p_amount_kz bigint, p_paid_on date, p_reference text, p_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pay uuid; v_pending bigint; v_left bigint := p_amount_kz; c record; v_take bigint;
begin
  if not is_admin() then raise exception 'acesso negado'; end if;
  select id into v_pay from affiliate_payments where idempotency_key = p_key;
  if found then return v_pay; end if;                        -- idempotência
  if p_amount_kz <= 0 then raise exception 'valor inválido'; end if;
  perform 1 from affiliates where id = p_affiliate_id for update;   -- serializa pagamentos por afiliado
  select coalesce(sum(amount_kz - paid_kz), 0) into v_pending from commissions where affiliate_id = p_affiliate_id;
  if p_amount_kz > v_pending then raise exception 'valor excede o saldo pendente (% Kz)', v_pending; end if;
  insert into affiliate_payments(affiliate_id, amount_kz, paid_on, reference, idempotency_key, created_by)
    values (p_affiliate_id, p_amount_kz, p_paid_on, p_reference, p_key, auth.uid()) returning id into v_pay;
  for c in select id, amount_kz - paid_kz as due from commissions
            where affiliate_id = p_affiliate_id and paid_kz < amount_kz order by created_at, id for update loop
    exit when v_left = 0;
    v_take := least(c.due, v_left);
    update commissions set paid_kz = paid_kz + v_take where id = c.id;
    insert into payment_allocations(payment_id, commission_id, amount_kz) values (v_pay, c.id, v_take);
    v_left := v_left - v_take;
  end loop;
  insert into notifications(user_id, title, body) values (p_affiliate_id, 'Comissão paga', 'Foi registado um pagamento de ' || p_amount_kz || ' Kz.');
  insert into audit_logs(actor, action, entity, entity_id, details)
    values (auth.uid(), 'payment_registered', 'affiliate_payments', v_pay::text, jsonb_build_object('affiliate', p_affiliate_id, 'amount_kz', p_amount_kz));
  return v_pay;
end $$;

create or replace function set_affiliate_status(p_affiliate_id uuid, p_status affiliate_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'acesso negado'; end if;
  update affiliates set status = p_status where id = p_affiliate_id;
  insert into audit_logs(actor, action, entity, entity_id, details)
    values (auth.uid(), 'affiliate_status', 'affiliates', p_affiliate_id::text, jsonb_build_object('status', p_status));
end $$;

-- Carteira do afiliado (só lê as próprias linhas via RLS de commissions)
create view affiliate_wallet with (security_invoker = true) as
  select affiliate_id, sum(amount_kz) as total_kz, sum(paid_kz) as paid_kz, sum(amount_kz - paid_kz) as pending_kz
  from commissions group by affiliate_id;

-- ===== Permissões: nada de escrita directa em tabelas financeiras =====
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function track_event(uuid, text, text, text), create_purchase_request(uuid, text, text) to anon, authenticated;
grant execute on function promote_product(uuid), confirm_sale(uuid), reject_sale(uuid),
  register_payment(uuid, bigint, date, text, text), set_affiliate_status(uuid, affiliate_status) to authenticated;

-- ===== RLS =====
do $$ declare t text; begin
  foreach t in array array['profiles','admin_users','categories','products','product_files','affiliates','affiliate_bank',
    'affiliate_products','referral_visits','product_events','purchase_requests','sales','commissions','affiliate_payments',
    'payment_allocations','notifications','audit_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all_%1$s on %1$I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop; end $$;

create policy pub_categories on categories for select using (true);
create policy pub_products on products for select using (is_published);
create policy own_profile_sel on profiles for select to authenticated using (id = auth.uid());
create policy own_profile_upd on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_profile_ins on profiles for insert to authenticated with check (id = auth.uid());
create policy own_aff_sel on affiliates for select to authenticated using (id = auth.uid());
create policy own_aff_ins on affiliates for insert to authenticated with check (id = auth.uid() and status = 'ativo');
create policy own_aff_upd on affiliates for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and status = 'ativo');
create policy own_bank_all on affiliate_bank for all to authenticated using (affiliate_id = auth.uid()) with check (affiliate_id = auth.uid());
create policy own_ap_sel on affiliate_products for select to authenticated using (affiliate_id = auth.uid());
create policy own_events_sel on product_events for select to authenticated
  using (affiliate_product_id in (select id from affiliate_products where affiliate_id = auth.uid()));
create policy own_visits_sel on referral_visits for select to authenticated
  using (affiliate_product_id in (select id from affiliate_products where affiliate_id = auth.uid()));
create policy own_requests_sel on purchase_requests for select to authenticated using (affiliate_id = auth.uid());
create policy own_sales_sel on sales for select to authenticated using (affiliate_id = auth.uid());
create policy own_comm_sel on commissions for select to authenticated using (affiliate_id = auth.uid());
create policy own_pay_sel on affiliate_payments for select to authenticated using (affiliate_id = auth.uid());
create policy own_notif_sel on notifications for select to authenticated using (user_id = auth.uid());
create policy own_notif_upd on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Sem políticas de INSERT/UPDATE/DELETE para afiliados em requests, sales, commissions, payments, audit_logs.
-- Limitação conhecida: o afiliado vê preço/comissão snapshot dos seus próprios pedidos (necessário para o histórico).
-- Admin único: criar via SQL Editor após registar o utilizador: insert into admin_users values ('<uuid>');
