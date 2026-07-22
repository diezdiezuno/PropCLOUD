'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// Define la contraseña nueva tras seguir el enlace de recuperación.
//
// Vive fuera de (protected) a propósito: ese layout resuelve la oficina por
// dominio y rebota a quien no pertenezca a la del host. Para recuperar una
// contraseña alcanza con tener sesión — meterla ahí adentro haría que un
// agente rebotara justo cuando viene a recuperar su acceso.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
      setChecking(false)
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')

    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password })
    setSaving(false)
    if (error) return setError(error.message)

    setDone(true)
    setTimeout(() => { router.push('/admin/dashboard'); router.refresh() }, 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111', borderLeft: '3px solid #111', paddingLeft: 12, marginBottom: 24 }}>
          Nueva contraseña
        </div>

        {checking ? (
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Verificando el enlace…</p>

        ) : !hasSession ? (
          // Sin sesión el enlace vencio o ya se uso. Antes tambien fallaba al
          // abrirlo en otro navegador; con verifyOtp eso dejo de pasar.
          <>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginTop: 0 }}>
              Este enlace no es válido, ya venció o ya fue usado.
            </p>
            <a href="/admin/login" style={{ display: 'block', textAlign: 'center', background: '#111', color: '#fff', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, textDecoration: 'none', marginTop: 18 }}>
              Pedir uno nuevo
            </a>
          </>

        ) : done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Contraseña actualizada</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Te llevamos al panel…</div>
          </div>

        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Nueva contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" required style={inputSt} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Repetir contraseña</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" required style={inputSt} />
            </div>

            {error && <div style={{ color: '#c53030', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button type="submit" disabled={saving} style={{
              width: '100%', background: '#111', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
            }}>
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6,
}
const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 10,
  padding: '11px 14px', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
