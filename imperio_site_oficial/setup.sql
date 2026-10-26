-- IMPÉRIO CALÇADOS — estrutura inicial para Supabase
-- Execute este arquivo uma vez no SQL Editor do seu projeto.
-- O script inclui catálogo inicial, permissões e armazenamento de imagens.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0 check (price >= 0),
  category text not null default 'Corrida',
  description text not null default '',
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_name_idx on public.products (active, name);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.admin_users enable row level security;

-- Regras idempotentes: podem ser recriadas ao executar o setup novamente.
drop policy if exists "Public reads active products" on public.products;
drop policy if exists "Admins read all products" on public.products;
drop policy if exists "Admins insert products" on public.products;
drop policy if exists "Admins update products" on public.products;
drop policy if exists "Admins delete products" on public.products;
drop policy if exists "Users read own admin role" on public.admin_users;

create policy "Public reads active products"
  on public.products for select to anon, authenticated
  using (active = true);
create policy "Admins read all products"
  on public.products for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins insert products"
  on public.products for insert to authenticated
  with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins update products"
  on public.products for update to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'))
  with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins delete products"
  on public.products for delete to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Users read own admin role"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

-- Catálogo inicial. Produtos já cadastrados não são sobrescritos.
insert into public.products (name, price, category, description, image_url, active) values
  ('Olympikus Corre 4', 299.90, 'Corrida', 'Corrida diária com amortecimento responsivo.', 'https://images.tcdn.com.br/img/img_prod/1317970/tenis_olympikus_corre_4_corrida_treino_unissex_branco_20673_4_dd52d04d7dc367b3344ea3d08239be7e.jpg', true),
  ('Nike Revolution 8', 199.90, 'Corrida', 'Tênis versátil para caminhadas e treinos leves.', 'https://imgcentauro-a.akamaihd.net/768x768/99599602A3.jpg', true),
  ('Asics Gel-Excite 10', 249.90, 'Corrida', 'Conforto para rotina ativa e caminhadas longas.', 'https://asicsbr.vteximg.com.br/arquivos/ids/557278/uc.jpg?v=638549408457530000', true),
  ('Olympikus Atmos', 100.00, 'Casual', 'Leve e prático para o dia a dia.', 'https://f.fcdn.app/imgs/bc89a0/vezzo.uy/vezzuy/172d/original/catalogo/1866-286101_NEGRO_1/900_900/olympikus-atmos-negro.jpg', true),
  ('Adidas Duramo Speed', 349.90, 'Corrida', 'Opção dinâmica para corrida e treino diário.', 'https://assets.adidas.com/images/h_840%2Cf_auto%2Cq_auto%2Cfl_lossy%2Cc_fill%2Cg_auto/72949966bf1b494bbfc41da130240203_9366/Tenis_Duramo_Speed_Azul_IF0566_01_standard.jpg', true),
  ('Puma Rickie Classic', 150.00, 'Casual', 'Visual clássico para combinar com looks casuais.', 'https://imgcentauro-a.akamaihd.net/1200x1200/M17XM101A2.jpg', true),
  ('Nike Run Defy', 199.90, 'Corrida', 'Conforto versátil para caminhada e academia.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85', true),
  ('Fila Racer Speed Zone', 179.90, 'Corrida', 'Leveza para corridas curtas e atividades diárias.', 'https://www.fila.com.br/arquivos/ids/3520160-1000-1000/tenis-fila-racer-speedzone-masculino-branco.jpg', true),
  ('Mizuno Wave Impulso', 219.90, 'Corrida', 'Estabilidade para esteira e musculação.', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=700&q=85', true),
  ('Olympikus Corre Nuvem', 150.00, 'Corrida', 'Sensação macia para uso diário e caminhadas.', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=700&q=85', true),
  ('Converse Chuck Taylor All Star', 179.90, 'Casual', 'Clássico de lona para escola, faculdade e streetwear.', 'https://converse.com.br/media/catalog/product/m/7/m7650c_a_107x1.png?bg-color=255%2C255%2C255&fit=bounds&format=jpeg&height=&optimize=high&width=', true),
  ('Adidas Grand Court 3.0', 199.90, 'Casual', 'Silhueta clássica e fácil de combinar.', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=700&q=85', true),
  ('Vans Old Skool', 249.90, 'Casual', 'Ícone do skate com estilo urbano.', 'https://acdn-us.mitiendanube.com/stores/002/772/971/products/old-skool-blkwht-51-7ca11f9b17acb3ca3116881535424466-1024-1024.webp', true),
  ('Puma Carina 3.0', 199.90, 'Casual', 'Estilo casual com solado robusto.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=700&q=85', true),
  ('Nike Court Vision Low', 249.90, 'Casual', 'Visual inspirado no basquete para uso urbano.', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=700&q=85', true),
  ('Adidas Samba', 399.90, 'Casual', 'Perfil retrô e elegante para streetwear.', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=700&q=85', true),
  ('Nike Air Force 1', 429.90, 'Casual', 'Clássico robusto que se destaca no look.', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&q=85', true),
  ('Converse Run Star Hike', 349.90, 'Casual', 'Plataforma marcante para um visual ousado.', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=700&q=85', true),
  ('Adidas Advantage Base', 150.00, 'Casual', 'Design minimalista para combinar com tudo.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85', true),
  ('Veja Campo', 399.90, 'Premium', 'Visual premium e discreto para ocasiões casuais.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=700&q=85', true),
  ('Asics Gel-Nimbus 28', 449.90, 'Corrida', 'Amortecimento máximo para rodagens confortáveis.', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=700&q=85', true),
  ('Mizuno Wave Creation', 399.90, 'Corrida', 'Estrutura robusta para quem prioriza suporte.', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=700&q=85', true),
  ('Asics Novablast 5', 429.90, 'Corrida', 'Resposta elástica para treinos e corridas longas.', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&q=85', true),
  ('Asics Gel-Cumulus', 329.90, 'Corrida', 'Equilíbrio entre conforto e durabilidade.', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=700&q=85', true),
  ('Nike Air Max Excee', 299.90, 'Casual', 'Estética retrô com visual esportivo.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85', true),
  ('Adidas Adizero Drive RC', 349.90, 'Corrida', 'Perfil leve para treinos de velocidade.', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=700&q=85', true),
  ('New Balance Fresh Foam X Rebel v4', 429.90, 'Corrida', 'Leve e responsivo para corredores frequentes.', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=700&q=85', true),
  ('Nike Pegasus 41', 399.90, 'Corrida', 'Tênis versátil para a rotina de corrida.', 'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=700&q=85', true),
  ('Reebok Nano X5', 349.90, 'Treino', 'Feito para treinos funcionais e academia.', 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&q=85', true),
  ('Nike Vomero Premium', 450.00, 'Corrida', 'Conforto premium com amortecimento generoso.', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=700&q=85', true),
  ('Olympikus Corre Vento', 90.00, 'Corrida', 'Leveza para corridas e caminhadas.', 'https://qrcode.olympikus.com.br/arquivos/ids/43496209-1000-1000/tenis-olympikus-corre-vento-2-unissex.jpg', true)
on conflict (name) do nothing;

-- Bucket público: fotos podem ser exibidas na loja; somente administradores podem enviar/alterar/excluir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Admins upload product images" on storage.objects;
drop policy if exists "Admins update product images" on storage.objects;
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'))
  with check (bucket_id = 'product-images' and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));

-- Permissões SQL explícitas para as operações cobertas pelas políticas acima.
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- Depois de criar o usuário no painel Supabase, execute o comando indicado no README
-- para conceder a ele acesso administrativo.


-- PEDIDOS ONLINE E PAGAMENTOS (sem armazenar número de cartão ou CVV)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_zip text not null,
  shipping_address text not null,
  shipping_number text not null,
  shipping_complement text not null default '',
  shipping_neighborhood text not null,
  shipping_city text not null,
  shipping_state char(2) not null,
  total numeric(10,2) not null check (total >= 0),
  payment_provider text not null default 'mercado_pago',
  payment_provider_order_id text unique,
  payment_provider_payment_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','approved','rejected','cancelled','refunded','error')),
  payment_status_detail text not null default '',
  fulfillment_status text not null default 'new' check (fulfillment_status in ('new','preparing','shipped','delivered','cancelled'))
);
alter table public.orders add column if not exists payment_provider_payment_id text;
create unique index if not exists orders_payment_provider_payment_id_unique
  on public.orders(payment_provider_payment_id) where payment_provider_payment_id is not null;
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
drop policy if exists "Admins read orders" on public.orders;
drop policy if exists "Admins update orders" on public.orders;
drop policy if exists "Admins read order items" on public.order_items;
create policy "Admins read orders" on public.orders for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins update orders" on public.orders for update to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'))
  with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
create policy "Admins read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.role = 'admin'));
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
-- Inserção de pedidos é feita apenas por função server-side usando service role.
