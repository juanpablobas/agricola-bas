-- Avisos al celular (notificaciones push de la app instalada).
--   · push_clave: claves del servicio de avisos (una sola fila). Sin políticas: solo la lee el servidor.
--     La fila se inserta aparte, directamente en la base (las claves no se guardan en el repositorio).
--   · push_suscripcion: celulares que activaron los avisos, uno por dispositivo.
--   · trabajador.perfil_id: usuario de la app de cada trabajador, para avisarle lo que fiscaliza.
create table public.push_clave (
  id      int primary key default 1 check (id = 1),
  publica text not null,
  privada text not null
);
alter table public.push_clave enable row level security;

create table public.push_suscripcion (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  endpoint  text not null unique,
  p256dh    text not null,
  auth      text not null,
  agente    text,
  creado_en timestamptz not null default now()
);
alter table public.push_suscripcion enable row level security;
create policy push_suscripcion_ver on public.push_suscripcion for select using (user_id = auth.uid());
create policy push_suscripcion_crear on public.push_suscripcion for insert with check (user_id = auth.uid());
create policy push_suscripcion_borrar on public.push_suscripcion for delete using (user_id = auth.uid());

alter table public.trabajador add column perfil_id uuid references public.perfil (id) on delete set null;
