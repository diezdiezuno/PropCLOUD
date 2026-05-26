'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const authError = searchParams.get('error')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
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
        <div style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>
          Ingresá tu email para recibir el enlace de acceso
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
              Enviamos un enlace mágico a <strong>{email}</strong>
            </div>
            <button
              onClick={() => setSent(false)}
              style={{ marginTop: 20, fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@tuinmobiliaria.com"
              required
              style={{
                width: '100%', border: '1px solid #e0e0e0', borderRadius: 10,
                padding: '11px 14px', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 14,
              }}
            />
            {error && (
              <div style={{ color: '#c53030', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: '#111', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
              }}
            >
              {loading ? 'Enviando…' : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
