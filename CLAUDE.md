# Noduus — Documentación del sistema

Plataforma inmobiliaria multi-tenant: sitio web público + panel admin con CRM +
herramientas para agentes (Noduus), todo sobre una sola base de datos y un
solo login.

## Stack
- **Framework**: Next.js 16 App Router (Turbopack), TypeScript, React 19
- **DB / Auth / Storage**: Supabase (postgres + RLS). Proyecto ref `neuzltjlezogxmhbceco`
- **Sesión**: `@supabase/ssr` (cookies, prefijo `base64-`, chunking `.0/.1`)
- **Email**: Resend · **Mapas**: Mapbox GL JS · **Fotos**: Cloudinary (cloud `dlgrhr6lh`, preset `firmas`)
- **Deploy**: Vercel — repo `diezdiezuno/Noduus`, branch `main` → auto-deploy
- **Tenant activo**: Sunrise / RE/MAX Central — slug `sunrise`, dominio `sunrisecr.com`

## Arquitectura multi-tenant + roles

- El middleware (`src/middleware.ts`) lee `host` y lo inyecta como header `x-tenant-domain`.
- `getTenantByDomain(domain)` / `getTenantConfig(tenantId)` en `src/lib/tenant.ts` resuelven el tenant. `getTenantConfig` usa `publicClient()` (anon, sin cookies) para las páginas públicas.
- **Tres niveles de usuario**:
  - **Superadmin** (`superadmin/`) — gestiona tenants (crear, dominios, admins). Ver `src/lib/superadmin.ts`, verificación server-side.
  - **Admin de tenant** (`tenant_admins`) — ve todo el panel: sitio web, CRM completo, Noduus + administración, métricas, reclutamiento.
  - **Agente** (`users`, modelo Noduus) — ve solo CRM (sin Configuración) + herramientas Noduus. Los agentes de Noduus **son** los agentes de Noduus.
- El rol se resuelve en `admin/(protected)/layout.tsx` (admin vía `tenant_admins`, si no, agente vía `users`) y se pasa a `AdminShell`. `src/lib/membership.ts` (`getMembership()`) hace lo mismo del lado cliente.
- **Aislamiento**: toda tabla lleva `tenant_id` y su RLS usa `is_tenant_member(tenant_id)`. El guard de rol en `AdminShell` es solo UI; la seguridad real es RLS.

## Estructura

### Público — `src/app/(public)/`
`layout.tsx` (nav, footer, CSS vars del tenant, Google Fonts), `page.tsx` (home con mapa),
`listings/` (listado + detalle), `nosotros/`, `contacto/`, `listar/`, `reclutamiento/`,
`agentes/` (server + `AgentGrid.tsx`), `[slug]/` (páginas custom del tenant).
Templates exclusivos Sunrise: `NosotrosClientSunrise`, `ContactoClientSunrise`, `ListarClientSunrise`, `ReclutamientoClientSunrise`.

### Admin — `src/app/admin/(protected)/`
- `AdminShell.tsx` — sidebar + topbar + búsqueda global (⌘K). Nav filtrado por rol; ancho completo para rutas de listado (`WIDE_ROUTES`) y tools.
- `dashboard/` — **página principal post-login** (ver abajo).
- **Sitio web** (admin): `general/`, `mapa/`, `visualizacion/` (config de display de propiedades), `paginas/` + `paginas/[slug]/`, `fuentes/`, `agentes/`, `seo/`.
- **CRM**: `propiedades/` (listado + `nueva/` + `[id]/`), `clientes/`, `empresas/`, `leads/`, `crm-config/` (solo admin).
- **Noduus**: `tools/[slug]/` — iframe que embebe las herramientas estáticas.
- Standalone (admin): `metricas/`, `reclutamiento/`.

### Superadmin — `src/app/superadmin/`
`(protected)/tenants/` (lista + `[id]/`), login propio. API en `api/superadmin/tenants/…`.

### API — `src/app/api/`
- `contact/route.ts` — leads públicos (service role). **Rate-limit 5/10min por IP + validación de entradas.**
- `recruit/route.ts` — aplicaciones de reclutamiento, sube CV a `cv-uploads`.
- `properties/route.ts` — propiedades para el sitio (fuentes externas + manuales).
- `superadmin/tenants/…` — CRUD de tenants (gated por `verifySuperAdmin`).

## Dashboard del agente — `admin/(protected)/dashboard/`
Página nativa (no iframe). Es lo primero que se ve tras login (`/admin/login`, callback y `/admin` redirigen ahí).
- **Saludo** por hora (buenos días/tardes/noches) + fecha y reloj en vivo + **clima** (Open-Meteo, sin API key). Zona horaria y ciudad configurables (⚙) o por geolocalización; se guarda en localStorage.
- **Info del agente** editable inline (click) — vive en `users`, la misma que consumen firmas/tarjetas/rótulos. Foto flotante (Cloudinary), grid de contacto con íconos.
- **Material de impresión**: rótulos y tarjetas guardados; click abre el guardado en su herramienta (deep-link `?id=`).
- **Propiedades asignadas**: cruce agente↔propiedad por email (`users.email` ↔ `agents.email` ↔ `properties.agent_id`).

## Noduus — herramientas embebidas
Herramientas estáticas (HTML/JS sin framework) en `public/tools/`, servidas vía rewrites de `next.config.ts` y embebidas por iframe en `admin/tools/[slug]`.
- **Un solo login**: `public/tools/cookie-storage.js` es un adapter que lee/escribe la misma cookie de `@supabase/ssr` que el admin → sesión compartida.
- **`public/tools/components.js`**: header/sidebar/footer compartidos + `initComponents()`. En modo `EMBEDDED` (iframe o `?embed`) oculta su propio chrome y usa el shell de Noduus; el título estilo CRM lo pone `tools/[slug]/page.tsx`.
- Catálogo: `firmas, tarjetas, rotulos, valoraciones, calendario, equipos` + `admin` (solo rol admin). El tenant ve solo las de `tenants.proptools_apps` (mecanismo de pago/plan).
- Valoraciones consulta el tipo de cambio vía Edge Function `tipo-cambio`.
- Registro por invitación: `public/tools/registro/` valida el token vía RPC `get_invitation` (ver Seguridad).

## Base de datos

### Núcleo
`tenants` (incl. `proptools_apps text[]`), `tenant_config` (JSONB: pages_config, theme…), `tenant_admins`, `users` (agentes), `invitations`.

### Sitio / propiedades
`properties` (source: `remax_cca|manual|custom_api`; cols CRM: `crm_status`, `agent_id`, `mandate_type`, `provincia/canton/distrito`, `parking`, `floors`, `year_built`, `amenities`, `video_url`, `finca_number`, `plano_number`, `features`), `property_sources`, `property_types`, `property_owners` (físico/jurídico, `parent_owner_id`), `agents`, `leads`.
`crm_status` ∈ `draft, captacion, preparacion, lista, active, bajo_oferta, sold, archived`.

### CRM
`crm_contacts` (clientes), `crm_companies` (empresas), `contact_types`, `contact_sources` (con `position` para orden drag&drop).
Junctions: `crm_contact_types` (un contacto → varios tipos), `crm_contact_companies` (contacto ↔ empresas).

### Noduus
`signatures`, `tenant_templates`, `tarjetas`, `rotulos` (todas con `user_id → users(id)`), `avaluos` (`user_id` = auth uid), `calendarios`, `eventos_calendario`, `equipos`, `reservas`, `reserva_equipos`.

### Helpers RLS (security definer, `search_path=public`)
- `is_tenant_member(tid)` — admin en `tenant_admins` **o** agente en `users`.
- `my_tenant_id()` — tenant del usuario actual (default en tablas de tools). *Nota: `limit 1`, no soporta multi-tenant por usuario — deuda documentada.*

## Migraciones SQL (`supabase/`)
Orden base: `schema.sql` → `admin-migration` → `admin-features-migration` → `analytics-migration` → `seo-migration` → `recruit-migration` → `translations-migration` → `zones-pages-migration` → `superadmin-migration` → `crm-contact-types-migration` → `detail-layout-migration` → `proptools-migration` → `proptools-full-migration`.
Parches: `patch-tarjetas-rotulos-cols` (columnas planas de tarjetas/rótulos), `security-patch-invitations` (ver Seguridad), `link-admin-user` (vincular admin ↔ usuario migrado).
Migración de datos Noduus→Noduus: `scripts/migrate-proptools-data.mjs` (recrea usuarios en auth nuevo, remapea tenant/auth ids, omite huérfanos).

## Seguridad (revisión aplicada)
- **Invitaciones**: la lectura anónima abierta se reemplazó por RPC `get_invitation(token)` (security definer) que devuelve solo la fila del token exacto. Borrado restringido a `is_tenant_member`. → correr `security-patch-invitations.sql`.
- **`/api/debug` eliminado** (filtraba tenants y prefijos de keys).
- **`/api/contact`**: rate-limit por IP + validación/recorte de entradas.
- Ningún `service_role` en el código (todo `process.env`); `.env*` en `.gitignore`. Las anon keys embebidas en los HTML de tools son públicas por diseño.

## Storage buckets
`cv-uploads` (CVs), `agent-photos`, `property-docs` (PDF), `planos-uploads` (anon upload del form listar), `property-photos`.

## Agentes (sitio público)
Puestos: Broker | Team Leader | Asesor Inmobiliario | Administrativo | Asistente (badge negro/morado/azul/ámbar/verde; ese es el orden de sort). Página `/agentes`: server + `AgentGrid.tsx`, foto 3:4.

## Patrones importantes
- **Mapbox**: `@import "mapbox-gl/dist/mapbox-gl.css"` solo en `globals.css` (no en componentes); el `useEffect` del mapa depende de `[loading]` (el div no existe hasta `loading=false`); guard `if (mapRef.current) return`.
- **Server vs Client**: páginas públicas con datos = Server Components; hover/estado = Client (`'use client'`). Patrón `page.tsx` (server) → `ComponentClient.tsx` (client).
- **Listados grandes (1000+)**: paginación/orden/resize client-side sobre el array cargado; hover con CSS (no estado React); resize/reorder con HTML5 `draggable` (sin librería); anchos en localStorage.
- **CRM**: formulario de contacto único y compartido (`src/components/crm/ContactForm.tsx`) — se usa en todos lados. Cédula → lookup Hacienda `https://api.hacienda.go.cr/fe/ae?identificacion={cedula}`.
- **Antes de pushear cambios de JSX/TSX**: correr `npx next build` completo (el typecheck solo no atrapa errores de parseo en strings de estilo).

## Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
RESEND_API_KEY
RESEND_FROM_EMAIL
VERCEL_API_TOKEN
VERCEL_PROJECT_ID
APP_DOMAIN=noduus.com
```

## Deuda / pendientes

### Contenido por cargar
- Casilla `hola@noduus.com` — la landing la referencia en 3 lugares y no existe.
- Favicon: sigue el de Next (`src/app/favicon.ico`). Derivarlo de `public/noduus_icon.png`.
- Textos de REMAX Central en Nosotros, Contacto y Reclutamiento: hoy muestran los
  valores por defecto genéricos. Se editan en `/admin/paginas`.
- Identidad de Sunrise en `tenant_config`: `whatsapp`, `address`, redes y `hero_*`.
- Fichas de CRM sin dueño (11 de 19 contactos, 1 de 4 empresas): con la RLS
  puesta solo las toca el admin. Se asignan desde la ficha, campo "Asignada a".

### Flujos sin probar de punta a punta
- Formulario de contacto. Ahora deja rastro en `email_log`, así que un fallo se ve ahí.
- Listar propiedad con PDF adjunto. La policy de storage está puesta y probada
  con una subida anónima, pero nunca se hizo un envío real.

### Decisiones abiertas
- Sunrise muestra las 322 propiedades de la oficina, iguales a REMAX Central.
  Filtrar por equipo exige sumar un filtro por agente al proveedor `remax_cca`,
  que hoy solo acepta `officeId`.
- El correo de listar manda un enlace al plano, no el PDF adjunto. Resend soporta
  adjuntos; conviene igual dejar el enlace de respaldo, porque un adjunto de
  10 MB rebota en algunos servidores.

### Técnico
- Los correos de auth no quedan en `email_log`: los manda Supabase y su único
  rastro es el panel de Resend. Generarlos con `auth.admin.generateLink()` y
  mandarlos por `send-email` unifica el registro y además da marca por oficina,
  que las plantillas del panel no permiten (son por proyecto).
- **Barrido de fallos silenciosos.** Aparecieron cinco en una sola sesión: el
  SDK de Resend devolviendo `{ error }` sin que nadie lo mirara, la invitación
  que decía "enviada" sin enviarse, el lookup de tenant que caía al primero de
  la lista, la subida del plano que se descartaba, y un selector de diseño
  escondido tras una variable que nunca se seteaba. Vale un `grep` de
  `if (!error)`, `catch {}` y valores de retorno ignorados.
- Notificaciones: `send-email` es la base. Agregarle `channels` y el enrutado a
  WhatsApp. No armar cola hasta que haya envíos lentos o que necesiten reintento.
- `my_tenant_id()` no soporta multi-tenant por usuario (documentado en la migración).
- `/api/contact`: rate-limit en memoria — pasar a Upstash/Redis si escala a varias instancias.
- Edge Functions desplegadas: `invite-agent`, `delete-user`, `reset-user-password`,
  `activate-invitation`, `send-email`. `tipo-cambio` se menciona pero no la llama nadie.
- Decommission/redirect de `proptools.app` (sin verificar si el dominio es propio).
