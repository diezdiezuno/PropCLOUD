'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message)
    } else {
      router.push('/superadmin/tenants')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 40, width: 380, border: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#666', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>PropCLOUD</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 28 }}>Super Admin</div>

        {searchParams.get('error') && (
          <div style={{ background: '#2a1515', border: '1px solid #4a2020', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>
            Sin acceso de super admin.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#888', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SuperAdminLogin() {
  return <Suspense><LoginForm /></Suspense>
}
