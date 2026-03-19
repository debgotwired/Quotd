-- API Keys table
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_user_id on public.api_keys(user_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);

-- Webhooks table
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_webhooks_user_id on public.webhooks(user_id);

-- Webhook deliveries table
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}',
  status_code integer,
  response_body text,
  attempt integer not null default 1,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_webhook_deliveries_webhook_id on public.webhook_deliveries(webhook_id);
create index idx_webhook_deliveries_retry on public.webhook_deliveries(next_retry_at)
  where delivered_at is null and attempt < 4;

-- API rate limits table
create table if not exists public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  unique(key_hash, window_start)
);

create index idx_api_rate_limits_lookup on public.api_rate_limits(key_hash, window_start);

-- Enable RLS
alter table public.api_keys enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_rate_limits enable row level security;

-- RLS policies: api_keys
create policy "Users can manage own API keys" on public.api_keys
  for all using (auth.uid() = user_id);

-- RLS policies: webhooks
create policy "Users can manage own webhooks" on public.webhooks
  for all using (auth.uid() = user_id);

-- RLS policies: webhook_deliveries (via webhook ownership)
create policy "Users can view own webhook deliveries" on public.webhook_deliveries
  for select using (
    webhook_id in (select id from public.webhooks where user_id = auth.uid())
  );
