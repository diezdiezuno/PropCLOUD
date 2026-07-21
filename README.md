# Noduus

Plataforma inmobiliaria multi-tenant: sitio web público + panel admin con CRM +
herramientas para agentes (PropTools), sobre una sola base de datos y un solo login.

Documentación completa del sistema (arquitectura, roles, tablas, migraciones,
seguridad): **[CLAUDE.md](CLAUDE.md)**.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # correr antes de pushear cambios de JSX/TSX
```

Requiere un `.env.local` con las variables listadas en [CLAUDE.md](CLAUDE.md#variables-de-entorno)
(Supabase, Mapbox, Resend, Vercel).

## Stack

Next.js 16 (App Router) · TypeScript · Supabase (postgres + RLS + Auth + Storage) ·
Mapbox · Resend · Cloudinary. Deploy en Vercel (`main` → auto-deploy).

## Estructura

- `src/app/(public)/` — sitio web público del tenant
- `src/app/admin/(protected)/` — panel admin (CRM, sitio, PropTools) por rol
- `src/app/superadmin/` — gestión de tenants
- `src/app/api/` — endpoints (leads, reclutamiento, propiedades, superadmin)
- `public/tools/` — herramientas PropTools (estáticas, embebidas por iframe)
- `supabase/` — esquema y migraciones SQL
- `scripts/` — migración de datos PropTools → Noduus
