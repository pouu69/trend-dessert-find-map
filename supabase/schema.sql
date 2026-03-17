-- Products table
create table products (
  slug text primary key,
  name text not null,
  icon_name text not null,
  created_at timestamptz default now()
);

-- Shops table
create table shops (
  id text primary key,
  product_slug text not null references products(slug),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text default '',
  hours text default '',
  closed_days text[] default '{}',
  price_range text default '',
  tags text[] default '{}',
  description text default '',
  region text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_shops_product on shops(product_slug);
create index idx_shops_region on shops(region);

-- Seed products
insert into products (slug, name, icon_name) values
  ('shanghai-butter-rice', '상하이버터떡', 'butter'),
  ('dujjonku', '두쫀쿠', 'cookie');
