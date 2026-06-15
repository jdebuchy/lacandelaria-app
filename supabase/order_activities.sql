create table if not exists public.order_activities (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_activities_order_created_idx
  on public.order_activities(order_id, created_at desc);
