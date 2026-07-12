'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Mode = 'password' | 'magic'

function LoginForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const authError = searchParams.get('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message)
      } else {
        router.push('/admin/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f5f5f7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 40, width: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>
          PropCLOUD Admin
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid #f0f0f0' }}>
          {(['password', 'magic'] as Mode[]).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: mode === m ? 600 : 400,
              color: mode === m ? '#111' : '#aaa',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${mode === m ? '#111' : 'transparent'}`,
              fontFamily: 'inherit', marginBottom: -1,
            }}>
              {m === 'password' ? 'Contraseña' : 'Magic link'}
            </button>
          ))}
        </div>

        {authError && (
          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c53030', marginBottom: 16 }}>
            {authError === 'no_tenant' ? 'Tu cuenta no está asociada a ningún tenant.' : 'Error de autenticación. Intentá de nuevo.'}
          </div>
        )}

        {sent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Revisá tu email</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>
              Enviamos un enlace a <strong>{email}</strong>
            </div>
            <button onClick={() => setSent(false)} style={{ marginTop: 20, fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@tuinmobiliaria.com" required style={inputStyle} />
            </Field>

            {mode === 'password' && (
              <Field label="Contraseña">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={inputStyle} />
              </Field>
            )}

            {error && <div style={{ color: '#c53030', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: '#111', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
            }}>
              {loading ? 'Ingresando…' : mode === 'password' ? 'Ingresar' : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0e0e0', borderRadius: 10,
  padding: '11px 14px', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
