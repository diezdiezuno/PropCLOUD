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
- `is_tenant_admin(tid)` — solo `tenant_admins`. Ojo: `users.role = 'admin'` es otra cosa y la UI mira esa; para la base no manda.
- `soy_agente_del_contacto(cid)` / `puedo_editar_contacto(cid)` — dueño de contacto (`crm-rls.sql`, `crm-links-rls.sql`).

**CRM — quién edita qué.** El agente ve la cartera entera de la oficina pero solo
escribe lo suyo; el borrado físico es del admin. El dueño se guarda en
`created_by` (auth.uid), no en `agent_id` como en `properties`. Las tablas puente
(`crm_contact_agents`, `_companies`, `_types`) heredan el permiso del contacto
padre: sin eso, un agente se insertaba como agente de un contacto ajeno y se
ganaba la edición. Al tocar una policy hay que mover las dos: la UI espeja estas
reglas en `canEdit`, y si se desalinean el botón aparece y la base rechaza.

## Migraciones SQL (`supabase/`)
Orden base: `schema.sql` → `admin-migration` → `admin-features-migration` → `analytics-migration` → `seo-migration` → `recruit-migration` → `translations-migration` → `zones-pages-migration` → `superadmin-migration` → `crm-contact-types-migration` → `detail-layout-migration` → `proptools-migration` → `proptools-full-migration`.
Parches: `patch-tarjetas-rotulos-cols` (columnas planas de tarjetas/rótulos), `security-patch-invitations` (ver Seguridad), `link-admin-user` (vincular admin ↔ usuario migrado).
Migración de datos Noduus→Noduus: `scripts/migrate-proptools-data.mjs` (recrea usuarios en auth nuevo, remapea tenant/auth ids, omite huérfanos).

## Seguridad (revisión aplicada)
- **Invitaciones**: la lectura anónima abierta se reemplazó por RPC `get_invitation(token)` (security definer) que devuelve solo la fila del token exacto. Borrado restringido a `is_tenant_member`. → correr `security-patch-invitations.sql`.
- **`users.role` era autoasignable**: la policy de UPDATE deja editar la fila propia sin mirar la columna, así que un agente se ponía `admin` y se abría el panel entero (e `invite-agent`, que autoriza con ese campo). Un trigger revierte `role`, `tenant_id` y `auth_id` para quien no sea admin, y otro mantiene `tenant_admins` igual a `users.role` — antes nada llenaba esa tabla salvo el panel de superadmin, y los admins creados desde la app tenían la UI sin los permisos. → `users-role-guard.sql`. *Los triggers exceptúan `auth.uid() is null` (service role, editor SQL) o las migraciones se revierten en silencio.*
- **CRM**: el agente solo escribe lo suyo → `crm-rls.sql` + `crm-links-rls.sql`. El segundo no es opcional: sin él, un agente se insertaba en `crm_contact_agents` de un contacto ajeno y se ganaba la edición.
- **Auditoría**: `audit-log.sql` cuelga un trigger de las tablas que importan y guarda quién cambió qué. Se ve en `/admin/auditoria`. Append-only: sin policy de insert, update ni delete. No registra lecturas — ningún trigger las ve.
- **`contact-docs` se compartía entre oficinas** (ver Storage buckets).
- **`/api/debug` eliminado** (filtraba tenants y prefijos de keys).
- **`/api/contact`**: rate-limit por IP + validación/recorte de entradas.
- Ningún `service_role` en el código (todo `process.env`); `.env*` en `.gitignore`. Las anon keys embebidas en los HTML de tools son públicas por diseño.

## Storage buckets
Públicos (los sirve el sitio): `tenant-assets`, `agent-photos`, `property-photos`, `contact-photos`.
Privados: `contact-docs`, `property-docs`.
Con subida anónima desde formularios públicos: `cv-uploads`, `planos-uploads` (públicos — su URL viaja dentro de un correo).

`property-docs` y `property-photos` van por ruta `<tenantId>/…` y su policy sale
de ahí (`property-storage.sql`). Ojo: `property-docs` no tenía policy de
escritura, así que adjuntar informes registrales nunca funcionó, y
`property-photos` ni existía. Los dos casos fallaban callados.

`contact-docs` es el único privado: cédulas de contactos (`<contactoId>/…`) y
personerías o poderes de empresas (`empresas/<empresaId>/…`), en `doc_urls` de
cada tabla. Acepta PDF e imágenes hasta 20 MB y se lee con URL firmada.
Aislado por oficina con una policy **restrictive** sobre `storage.objects`
(`contact-docs-tenant.sql`) que deduce el tenant del registro dueño, no de la
ruta. Antes cualquier agente de cualquier oficina listaba y descargaba todo.
Los demás buckets son públicos: no se pueden listar sin sesión, pero quien
tenga la URL descarga.

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

## Pendientes (por prioridad)

**P1 — dejarlo así tiene costo.** **P2 — hay que hacerlo, no urge.** **P3 — cuando moleste.**
Al cerrar uno, borrarlo de acá; esta lista es el estado, no el historial.

### P1
- **`cv-uploads` a privado.** Son currículums de gente ajena a la empresa —nombre,
  teléfono, historial laboral— en una URL pública y permanente, y es el único dato
  acá que no es propio. Va junto con `planos-uploads`: los dos son formularios
  anónimos cuya URL viaja dentro de un correo, así que hay que guardar la ruta en
  vez de la URL y firmar al componer el email. Toca los dos formularios públicos,
  `/api/recruit`, `/api/contact` y la pantalla de reclutamiento. Los enlaces de
  correos ya enviados dejan de abrir; el admin sigue bien.
- **Fichas de CRM sin dueño**: con la RLS puesta solo las toca el admin. Se asignan
  desde la ficha, campo "Asignada a".
- **Barrido de fallos silenciosos.** Van nueve encontrados de a uno, siempre igual:
  un `error` que nadie mira y una pantalla que dice que salió bien. Falta el barrido
  sistemático — `grep` de `if (!error)`, `catch {}`, `.update()` sin `.select()` y
  valores de retorno ignorados. Es el patrón que más veces mordió este proyecto.

### P2
- **Flujos sin probar de punta a punta**: formulario de contacto (deja rastro en
  `email_log`, ahí se ve si falla) y listar propiedad con PDF adjunto.
- **Correos de auth fuera de `email_log`**: los manda Supabase y su único rastro es
  el panel de Resend. Generarlos con `auth.admin.generateLink()` y mandarlos por
  `send-email` unifica el registro y da marca por oficina, que las plantillas del
  panel no permiten (son por proyecto).
- **`invite-agent` autoriza por `users.role`.** Ese campo ya es confiable —lo blinda
  un trigger— pero apuntarlo a `tenant_admins` deja una sola fuente de verdad.
- **Contenido por cargar** (es tuyo, no mío): casilla `hola@noduus.com` —la landing
  la referencia en 3 lugares—, favicon propio (sigue el de Next), textos de REMAX
  Central en Nosotros/Contacto/Reclutamiento, e identidad de Sunrise en
  `tenant_config` (`whatsapp`, `address`, redes, `hero_*`).

### P3
- Los eventos de `tenant_admins` salen sin nombre en la auditoría: esa tabla solo
  tiene ids. Resolverlo en la pantalla si molesta.
- Notificaciones: `send-email` es la base; agregarle `channels` y enrutado a
  WhatsApp. Sin cola hasta que haya envíos lentos o con reintento.
- `my_tenant_id()` no soporta multi-tenant por usuario.
- `/api/contact`: rate-limit en memoria — a Upstash/Redis si escala a varias instancias.
- `tipo-cambio` se menciona pero no la llama nadie.
- Decommission/redirect de `proptools.app` (sin verificar si el dominio es propio).

### Decisiones abiertas
- **Auditar lecturas.** Hoy se registran cambios, no consultas: ningún trigger ve un
  `select`. Saber quién miró la ficha de quién exige instrumentar pantalla por
  pantalla y genera mucho más volumen que las escrituras.
- **Sunrise muestra las 322 propiedades de la oficina**, iguales a REMAX Central.
  Filtrar por equipo exige sumar un filtro por agente al proveedor `remax_cca`,
  que hoy solo acepta `officeId`.
- **El correo de listar manda un enlace al plano, no el PDF.** Resend soporta
  adjuntos; conviene igual dejar el enlace de respaldo, porque un adjunto de 10 MB
  rebota en algunos servidores.

### Decidido (para no volver a discutirlo)
- Los documentos del CRM los ve **toda la oficina**; solo el dueño los modifica.
- `contact-photos` queda **público**: hacerlo privado obliga a firmar una URL por
  foto en cada render de cada listado, y es una foto de cliente.
