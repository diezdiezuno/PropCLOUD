# Plantillas de correo de Supabase Auth

Los correos de autenticación —recuperar contraseña, magic link— los manda
Supabase directamente, **no** pasan por la edge function `send-email`. Por eso
su diseño no se hereda del layout compartido y hay que cargarlo a mano acá:

**Supabase → Authentication → Emails → Templates**

Se pega el contenido de cada archivo en el campo *Message body*, y el asunto
sugerido en *Subject heading*.

| Archivo | Plantilla en el panel | Asunto sugerido |
|---|---|---|
| `recovery.html` | Reset Password | Restablecer tu contraseña |
| `magic-link.html` | Magic Link | Tu enlace de acceso a Noduus |

## Dos límites que conviene tener presentes

**Son por proyecto, no por tenant.** Un agente de Sunrise y uno de REMAX
Central reciben exactamente el mismo correo. El pie dice solo «Noduus», sin
nombre de oficina, porque acá no hay forma de saber de cuál es cada persona.

**No quedan en `email_log`.** Esa tabla registra lo que pasa por `send-email`;
estos los manda Supabase y su único rastro es el panel de Resend.

Las dos limitaciones desaparecen el día que se generen los enlaces con
`auth.admin.generateLink()` y se manden desde `send-email`. Estas plantillas
son la solución mientras tanto.

## El enlace apunta al dominio del tenant

El botón no usa `{{ .ConfirmationURL }}`, que apunta al endpoint de
`supabase.co` y recién de ahí rebota al sitio. En su lugar se arma sobre
`{{ .RedirectTo }}` —el origen que pidió el enlace, o sea el dominio de la
oficina— y la ruta `/auth/confirm` lo valida con `verifyOtp`:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/admin/reset-password
```

Por eso el cliente manda `redirectTo: ${origin}/auth/confirm` **sin query**: la
plantilla le agrega el `?`, y si ya viniera uno el enlace saldría roto.

Efecto lateral bienvenido: esto no es PKCE, así que no hay verificador atado al
navegador. El enlace funciona aunque se abra en el teléfono habiéndolo pedido
en la computadora.

## Variables disponibles

- `{{ .ConfirmationURL }}` — el enlace de la acción
- `{{ .Email }}` — correo de destino
- `{{ .Token }}` — código de 6 dígitos, alternativa al enlace
- `{{ .SiteURL }}` — Site URL del proyecto
