# PropCLOUD — Estado del proyecto

## Stack
- **Framework**: Next.js 15 App Router, TypeScript
- **DB / Auth**: Supabase (postgres + RLS + Storage)
- **Email**: Resend
- **Maps**: Mapbox GL JS (`NEXT_PUBLIC_MAPBOX_TOKEN`)
- **Deploy**: Vercel (repo: diezdiezuno/PropCLOUD, branch: main → auto-deploy)
- **Tenant activo**: Sunrise | RE/MAX Central — slug `sunrise`, dominio `sunrisecr.com`

## Arquitectura multi-tenant
- El middleware (`src/middleware.ts`) lee el `host` header y lo inyecta como `x-tenant-domain`
- `getTenantByDomain(domain)` y `getTenantConfig(tenantId)` en `src/lib/tenant.ts` resuelven el tenant
- `getTenantConfig` usa `publicClient()` (anon key, sin cookies) para que funcione en páginas públicas
- Todas las páginas públicas usan `(public)` route group; admin usa `admin/(protected)`

## Estructura de archivos clave

### Público (`src/app/(public)/`)
- `layout.tsx` — nav, footer, CSS vars del tenant, Google Fonts
- `page.tsx` — homepage con mapa de propiedades
- `listings/` — listado y detalle de propiedades
- `nosotros/` — página Nosotros (template: default HTML | sunrise)
- `contacto/` — página Contacto (template: default | sunrise)
- `listar/` — Listar propiedad (template: default | sunrise con Mapbox)
- `reclutamiento/` — Reclutamiento (template: default | sunrise landing page)
- `agentes/` — Equipo (server page + `AgentGrid.tsx` client)
- `[slug]/` — páginas custom del tenant

### Admin (`src/app/admin/(protected)/`)
- `AdminShell.tsx` — sidebar nav + layout principal
- `general/` — configuración general (WhatsApp, emails, redes, 2 emails de contacto)
- `paginas/` — tabs con iframe preview de cada página
- `paginas/[slug]/` — editor de settings por página (template selector, campos, SEO)
- `agentes/` — CRUD agentes con foto upload, puesto dropdown, redes sociales
- `leads/` — Leads tabs: Compradores | Vendedores (source=listar)
- `reclutamiento/` — Aplicaciones de reclutamiento con notas
- `inventario/` — CRM: listado de propiedades manuales
- `inventario/nueva/` — CRM: formulario nueva propiedad (Tab 1 activo, tabs 2-6 bloqueados)
- `propiedades/` — Configuración de display (listado/detalle views)

### API routes (`src/app/api/`)
- `contact/route.ts` — recibe leads de formularios (propiedad, contacto, listar), guarda en `leads`, envía email Resend
- `recruit/route.ts` — recibe aplicaciones de reclutamiento, sube CV a `cv-uploads`
- `properties/route.ts` — sirve propiedades (fuentes externas; pendiente: agregar manuales)

### Componentes
- `src/components/Nav/Nav.tsx` — Nav público con soporte de páginas configurables
- `src/components/Map/MapView.tsx` — mapa principal de listings
- `src/data/cr-divisions.ts` — provincias → cantones → distritos CR (con `getCantons`, `getDistricts`)
- `src/lib/tenant.ts` — `getTenantByDomain`, `getTenantConfig`, `DEFAULT_THEME`

## Supabase — tablas

| Tabla | Descripción |
|-------|-------------|
| `tenants` | Cada oficina/tenant |
| `tenant_config` | Configuración JSONB por tenant (pages_config, theme, etc.) |
| `tenant_admins` | Relación user ↔ tenant con rol |
| `properties` | Propiedades (source: remax_cca \| manual \| custom_api) |
| `property_sources` | Fuentes externas configuradas por tenant |
| `property_types` | Tipos de propiedad extensibles por tenant |
| `property_owners` | Propietarios (físico/jurídico, parent_owner_id para representantes legales) |
| `agents` | Agentes de la oficina |
| `leads` | Leads de formularios del sitio |
| `crm_contacts` | **NUEVO** Clientes del CRM |
| `crm_companies` | **NUEVO** Empresas del CRM |
| `contact_types` | **NUEVO** Tipos de contacto por tenant |
| `contact_sources` | **NUEVO** Fuentes de contacto por tenant |

### Columnas CRM en `properties`
`crm_status`, `agent_id`, `mandate_type`, `provincia`, `canton`, `distrito`, `parking`, `floors`, `year_built`, `amenities` (text[]), `video_url`, `finca_number`, `plano_number`, `features` (jsonb)

### CRM status values
`draft`, `captacion`, `preparacion`, `lista`, `active`, `bajo_oferta`, `sold`, `archived`

## Storage buckets
- `cv-uploads` — CVs reclutamiento (PDF, auth upload)
- `agent-photos` — Fotos agentes (imágenes, auth upload)
- `property-docs` — Docs de propiedades (PDF, auth upload)
- `planos-uploads` — Planos del form listar (PDF, anon upload)
- `property-photos` — Fotos de propiedades (pendiente crear)

## Templates Sunrise (solo tenant slug='sunrise')
Componentes exclusivos: `NosotrosClientSunrise`, `ContactoClientSunrise`, `ListarClientSunrise`, `ReclutamientoClientSunrise`

Activar con SQL:
```sql
UPDATE tenant_config SET pages_config = (
  SELECT jsonb_agg(CASE
    WHEN p->>'slug' = 'nosotros'      THEN jsonb_set(p, '{settings,nosotros_template}',      '"sunrise"')
    WHEN p->>'slug' = 'contacto'      THEN jsonb_set(p, '{settings,contacto_template}',      '"sunrise"')
    WHEN p->>'slug' = 'listar'        THEN jsonb_set(p, '{settings,listar_template}',        '"sunrise"')
    WHEN p->>'slug' = 'reclutamiento' THEN jsonb_set(p, '{settings,reclutamiento_template}', '"sunrise"')
    ELSE p END)
  FROM jsonb_array_elements(pages_config) AS p)
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'sunrise');
```

## Agentes
Puestos: Broker | Team Leader | Asesor Inmobiliario | Administrativo | Asistente

Badge colors: Broker=negro, Team Leader=morado, Asesor=azul, Administrativo=ámbar, Asistente=verde

Sort orden público: Broker → Team Leader → Asesor → Administrativo → Asistente

Página `/agentes`: server page + `AgentGrid.tsx` client. Diseño: foto 3:4, badge coloreado, WhatsApp/email, iconos sociales con hover.

## CRM — Inventario (`/admin/inventario`)

### Estado actual: Tab 1 funcional en `/admin/inventario/nueva`
6 tabs: 📋 Captación | 📐 Características | ✨ Amenidades | 💰 Precio | 📝 Descripción | 📸 Fotos y videos

**Tab 1 — Captación** tiene:
- N° finca + N° plano catastrado
- Adjuntar informe registral + plano catastrado (PDF → `property-docs` bucket)
- Link Google Maps → parser de coords → fly map → reverse geocoding
- Mapa Mapbox (click/drag para marcar, "Mi ubicación")
  - **CRÍTICO**: `useEffect` del mapa debe depender de `[loading]` (el div no existe hasta loading=false)
  - Guard: `if (mapRef.current) return` para no re-inicializar
- Cascading dropdowns CR: provincia → cantón → distrito
- Dirección exacta
- Tipo de propiedad (pills desde `property_types`)
- Transacción, Mandato, Estado CRM, Agente asignado

**Al guardar**: crea propiedad con `source='manual'`, redirige a `/admin/inventario/[id]` (pendiente)

### Tabs pendientes (en `/admin/inventario/[id]`)
- Tab 2: Características — botones numéricos (habitaciones, baños, parqueos, áreas)
- Tab 3: Amenidades — pills seleccionables
- Tab 4: Precio — monto, moneda, negociable
- Tab 5: Descripción y título — con generación IA futura
- Tab 6: Fotos y videos — upload a `property-photos`

## CRM — Clientes (`/admin/clientes`) — PRÓXIMO A CONSTRUIR

### Flujo
1. Agregar cliente → 2. Crear propiedad y vincularla al cliente

### Referencia
Archivo `~/Desktop/index.html` — CRM HTML completo con todos los campos y comportamientos. Usar como modelo exacto.

### Campos `crm_contacts`
`cedula`, `cedula_tipo` (fisica|juridica|dimex|pasaporte), `name`, `last_name`, `birth_date`, `type_id` → contact_types, `source_id` → contact_sources, `email`, `phone`, `phone_alt`, `company_id` → crm_companies, `instagram`, `linkedin`, `facebook`, `tiktok`, `notes`, `active`

### Hacienda API lookup
`https://api.hacienda.go.cr/fe/ae?identificacion={cedula}`
- Devuelve `nombre` y `situacion.moroso`
- Física: separar apellidos (2 primeras palabras) del nombre (resto)
- Jurídica: llenar razón social

### UI pattern para clientes
- Lista con search (nombre, cédula, email), filtros por tipo y fuente, contador
- **Drawer deslizante** desde la derecha (560px, altura completa)
- Secciones: Identificación → Datos personales → Contacto → Empresa → Redes sociales → Comentarios
- Botón "Consultar →" → Hacienda API → autocompleta nombre
- Autocomplete de empresas existentes al escribir
- Social search: abre Google con `nombre site:red.com`
- Soft delete: `active = false`
- **Botón global "+" en AdminShell** para agregar cliente desde cualquier sección

### Propietarios de propiedades (`property_owners`)
- `parent_owner_id` para enlazar representantes a la entidad jurídica
- Físico: nombre, cedula, email, telefono
- Jurídico: razon_social, cedula_juridica, personeria_url (PDF), + representantes como hijos
- En Tab 1: buscar cliente existente de `crm_contacts` ó crear nuevo propietario inline
- Lookup Hacienda en campo cédula del propietario

## Patrones importantes

### Mapbox
- CSS: `@import "mapbox-gl/dist/mapbox-gl.css"` en `globals.css` únicamente
- NO importar CSS en el componente
- `useEffect` del mapa depende de `[loading]`

### Server vs Client
- Páginas públicas con datos: Server Components (async)
- Hover/eventos/state: Client Components ('use client')
- Patrón: `page.tsx` (server) → `ComponentClient.tsx` (client)

### Formularios admin
- `createClient()` de `@/lib/supabase-browser`
- Siempre mostrar errores en UI, no solo console.log
- Storage: verificar política INSERT authenticated en el bucket

## Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
RESEND_API_KEY
RESEND_FROM_EMAIL
APP_DOMAIN=propcloud.app
```

## Próximos pasos (en orden)
1. **`/admin/clientes`**: lista + drawer con campos del index.html, Hacienda lookup, autocomplete empresas, social search, botón "+" global en AdminShell
2. **`/admin/inventario/[id]`**: tabs 2-6 (características con botones, amenidades pills, precio, descripción, fotos)
3. **Vincular cliente ↔ propiedad**: en Tab 1 buscar/seleccionar cliente como propietario
4. **`/api/properties`**: agregar propiedades manuales `status='active'` al endpoint público
5. **Pipeline vendedor**: kanban/lista del funnel de captación, conectar form `/listar` → lead → pipeline
