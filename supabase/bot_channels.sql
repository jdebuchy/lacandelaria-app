-- Aplicada en produccion: (pendiente)
--
-- Renombra las tablas de WhatsApp a nombres agnosticos de canal y agrega la
-- identidad de canal, para que Telegram y WhatsApp compartan un solo motor.
--
-- El worker de Railway lee estas tablas por nombre. Al momento de escribir esto
-- el CRM estaba sin trafico (ultimo mensaje 2026-06-07, cola vacia), asi que no
-- hizo falta ventana coordinada. Si eso cambia, desplegar worker y migracion juntos.
--
-- Si el SQL Editor rechaza el alter type por correr dentro de una transaccion,
-- ejecutar esa primera linea sola y despues el resto.

alter type public.sales_channel add value if not exists 'telegram_ai';

alter table public.whatsapp_conversations rename to conversations;
alter table public.whatsapp_messages rename to conversation_messages;
alter table public.whatsapp_message_queue rename to message_queue;
alter table public.whatsapp_automation_settings rename to automation_settings;
alter table public.whatsapp_commercial_settings rename to commercial_settings;

alter table public.conversations
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists channel_thread_id text,
  add column if not exists bot_muted_until timestamptz,
  add column if not exists off_topic_strikes integer not null default 0,
  add column if not exists llm_calls_today integer not null default 0,
  add column if not exists llm_calls_date date,
  add column if not exists is_test boolean not null default false,
  add column if not exists last_inbound_text text;

alter table public.conversation_messages
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists external_message_id text;

alter table public.message_queue
  add column if not exists channel text not null default 'whatsapp';

-- El telefono deja de ser la clave de ruteo: en Telegram no hay telefono, hay chat id.
update public.conversations set channel_thread_id = phone where channel_thread_id is null;
alter table public.conversations alter column channel_thread_id set not null;
alter table public.conversations alter column phone drop not null;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));
alter table public.conversation_messages
  add constraint conversation_messages_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));
alter table public.message_queue
  add constraint message_queue_channel_check
  check (channel in ('whatsapp', 'telegram', 'instagram'));

create unique index if not exists conversations_channel_thread_idx
  on public.conversations(channel, channel_thread_id);

-- Idempotencia del webhook: Telegram reintenta si no devolvemos 200, y sin esto
-- un reintento procesaria el mismo mensaje dos veces.
create unique index if not exists conversation_messages_channel_external_idx
  on public.conversation_messages(channel, external_message_id)
  where external_message_id is not null;

create table if not exists public.bot_llm_usage (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists bot_llm_usage_created_idx
  on public.bot_llm_usage(created_at desc);
