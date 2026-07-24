'use client'

// Administración › Contratos — el admin define los tipos de contrato y el
// texto fijo de cada uno. El agente después elige uno en la propiedad y el
// sistema le mete los datos.
//
// No hay chequeo de rol acá: la RLS de contract_templates ya deja escribir
// solo al admin. Duplicarlo en la UI sería una segunda fuente de verdad.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getMembership } from '@/lib/membership'
import PageHeader from '@/components/admin/PageHeader'
import { VARIABLES, variablesDesconocidas } from '@/lib/contract-render'
import { markdownToHtml } from '@/lib/markdown'

interface Plantilla {
  id: string; nombre: string; descripcion: string | null
  cuerpo: string; position: number; active: boolean
}

const inputSt: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', border: '1px solid #e2e5ea',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#fff',
  color: '#0d0f12', outline: 'none', boxSizing: 'border-box',
}

export default function ContratosAdminPage() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [lista,    setLista]    = useState<Plantilla[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editando, setEditando] = useState<Plantilla | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [preview,  setPreview]  = useState(false)
  // Logo del contrato: opciones guardadas del tenant + el elegido.
  const [logos,    setLogos]    = useState<{ label: string; url: string }[]>([])
  const [logoSel,  setLogoSel]  = useState<string | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async (tid: string) => {
    const sb = createClient()
    const [{ data, error }, { data: tn }, { data: cfg }] = await Promise.all([
      sb.from('contract_templates').select('id,nombre,descripcion,cuerpo,position,active')
        .eq('tenant_id', tid).order('position'),
      sb.from('tenants').select('logo_url').eq('id', tid).maybeSingle(),
      sb.from('tenant_config').select('footer_logo_url,contract_logo_url').eq('tenant_id', tid).maybeSingle(),
    ])
    if (error) setError(error.message)
    else setLista((data ?? []) as Plantilla[])
    // Logos guardados que se ofrecen para la esquina del contrato.
    const nav = (tn as { logo_url?: string } | null)?.logo_url
    const foot = (cfg as { footer_logo_url?: string } | null)?.footer_logo_url
    const elegido = (cfg as { contract_logo_url?: string } | null)?.contract_logo_url ?? null
    const opts = [
      ...(nav  ? [{ label: 'Logo principal', url: nav }]  : []),
      ...(foot ? [{ label: 'Logo de pie',    url: foot }] : []),
      // Si ya se guardó uno subido (no es el nav ni el footer), se muestra igual.
      ...(elegido && elegido !== nav && elegido !== foot ? [{ label: 'Subido', url: elegido }] : []),
    ]
    setLogos(opts)
    setLogoSel(elegido ?? nav ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    getMembership().then(m => { if (m) { setTenantId(m.tenantId); cargar(m.tenantId) } })
  }, [cargar])

  function nueva() {
    setEditando({ id: '', nombre: '', descripcion: '', cuerpo: '', position: lista.length, active: true })
    setError(null)
  }

  // Guarda qué logo va en la esquina del contrato.
  async function elegirLogo(url: string) {
    if (!tenantId) return
    setLogoSel(url)
    const { error } = await createClient().from('tenant_config')
      .update({ contract_logo_url: url }).eq('tenant_id', tenantId)
    if (error) setError(`No se pudo guardar el logo: ${error.message}`)
  }

  async function subirLogo(file: File) {
    if (!tenantId) return
    setSubiendoLogo(true); setError(null)
    const sb = createClient()
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${tenantId}/contract-logo-${Date.now()}.${ext}`
    const { error: upErr } = await sb.storage.from('tenant-assets').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setError(`No se pudo subir: ${upErr.message}`); setSubiendoLogo(false); return }
    const url = sb.storage.from('tenant-assets').getPublicUrl(path).data.publicUrl
    setLogos(prev => [...prev.filter(l => l.label !== 'Subido'), { label: 'Subido', url }])
    await elegirLogo(url)
    setSubiendoLogo(false)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando || !tenantId) return
    if (!editando.nombre.trim()) { setError('Poné un nombre.'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const payload = {
      tenant_id: tenantId,
      nombre: editando.nombre.trim(),
      descripcion: editando.descripcion?.trim() || null,
      cuerpo: editando.cuerpo,
      position: editando.position,
      active: editando.active,
      updated_at: new Date().toISOString(),
    }
    const { error } = editando.id
      ? await sb.from('contract_templates').update(payload).eq('id', editando.id)
      : await sb.from('contract_templates').insert(payload)
    if (error) { setError(`No se pudo guardar: ${error.message}`); setSaving(false); return }
    setSaving(false); setEditando(null)
    await cargar(tenantId)
  }

  // Archivar en vez de borrar: un contrato ya generado apunta a su plantilla.
  async function archivar(p: Plantilla) {
    if (!tenantId) return
    const { error } = await createClient().from('contract_templates')
      .update({ active: !p.active }).eq('id', p.id)
    if (error) { setError(error.message); return }
    await cargar(tenantId)
  }

  // Escribe el cuerpo nuevo y deja el cursor donde corresponde.
  function edita(nuevo: string, caretIni: number, caretFin: number) {
    if (!editando) return
    setEditando({ ...editando, cuerpo: nuevo })
    const ta = cuerpoRef.current
    if (ta) requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caretIni, caretFin) })
  }
  const bordes = () => {
    const ta = cuerpoRef.current
    const ini = ta?.selectionStart ?? (editando?.cuerpo.length ?? 0)
    const fin = ta?.selectionEnd ?? ini
    return { ini, fin }
  }
  /** Inserta texto donde está el cursor (marcadores, separador). */
  function insertar(txt: string) {
    if (!editando) return
    const { ini, fin } = bordes()
    edita(editando.cuerpo.slice(0, ini) + txt + editando.cuerpo.slice(fin), ini + txt.length, ini + txt.length)
  }
  /** Envuelve la selección (negrita/cursiva); si no hay, deja un placeholder. */
  function envolver(marca: string, ph: string) {
    if (!editando) return
    const { ini, fin } = bordes()
    const sel = editando.cuerpo.slice(ini, fin) || ph
    edita(editando.cuerpo.slice(0, ini) + marca + sel + marca + editando.cuerpo.slice(fin),
      ini + marca.length, ini + marca.length + sel.length)
  }
  /** Antepone un prefijo al inicio de la línea del cursor (título/lista). */
  function prefijoLinea(pre: string) {
    if (!editando) return
    const { ini } = bordes()
    const inicioLinea = editando.cuerpo.lastIndexOf('\n', ini - 1) + 1
    edita(editando.cuerpo.slice(0, inicioLinea) + pre + editando.cuerpo.slice(inicioLinea), ini + pre.length, ini + pre.length)
  }

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  const desconocidas = editando ? variablesDesconocidas(editando.cuerpo) : []

  return (
    <div>
      <style>{`.md-prev table.grid{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 12px}.md-prev table.grid td{width:50%;padding:3px 10px 3px 0;vertical-align:top}.md-prev h1{font-size:20px;margin:14px 0}.md-prev h2{font-size:16px;margin:14px 0 6px}.md-prev ul,.md-prev ol{padding-left:24px}`}</style>
      <PageHeader title="Contratos"
        subtitle={`${lista.filter(p => p.active).length} tipo${lista.filter(p => p.active).length !== 1 ? 's' : ''} de contrato`}
        right={
          <button onClick={nueva}
            style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nuevo tipo
          </button>
        } />

      {/* Logo de la esquina del contrato: elegir entre los guardados o subir. */}
      <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 }}>Logo del contrato</div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 14px' }}>Va en la esquina superior izquierda del PDF. Elegí uno de los guardados o subí uno nuevo.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
          {logos.map(l => {
            const sel = logoSel === l.url
            return (
              <button key={l.url} type="button" onClick={() => elegirLogo(l.url)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 10, cursor: 'pointer',
                border: `2px solid ${sel ? 'var(--color-primary, #111)' : '#e2e5ea'}`, borderRadius: 10, background: sel ? 'rgba(107,47,160,.04)' : '#fff', fontFamily: 'inherit',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.url} alt={l.label} style={{ height: 40, maxWidth: 140, objectFit: 'contain' }} />
                <span style={{ fontSize: 11, color: sel ? '#111' : '#9ca3af', fontWeight: sel ? 600 : 400 }}>{l.label}{sel ? ' ✓' : ''}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => logoInputRef.current?.click()} disabled={subiendoLogo} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', cursor: subiendoLogo ? 'wait' : 'pointer',
            border: '2px dashed #d5d9e0', borderRadius: 10, background: '#fafbfc', color: '#6b7280', fontFamily: 'inherit', fontSize: 12,
          }}>
            <span style={{ fontSize: 20 }}>＋</span>
            {subiendoLogo ? 'Subiendo…' : 'Subir logo'}
          </button>
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) subirLogo(f) }} />
        {logos.length === 0 && (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '10px 0 0' }}>No hay logos guardados todavía. Subí uno acá, o cargá el principal en Administración › General.</p>
        )}
      </div>

      {error && !editando && <p style={{ fontSize: 13, color: '#e53e3e' }}>{error}</p>}

      {editando && (
        <form onSubmit={guardar} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 18 }}>
            {editando.id ? 'Editar tipo de contrato' : 'Nuevo tipo de contrato'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', display: 'block', marginBottom: 5 }}>Nombre</label>
              <input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                placeholder="Contrato de captación" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', display: 'block', marginBottom: 5 }}>Descripción (opcional)</label>
              <input value={editando.descripcion ?? ''} onChange={e => setEditando({ ...editando, descripcion: e.target.value })}
                placeholder="Para qué sirve, cuándo se usa" style={inputSt} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#5a6070' }}>Texto del contrato</label>
                <button type="button" onClick={() => setPreview(p => !p)}
                  style={{ fontSize: 11, color: '#5a6070', background: preview ? '#eef1f4' : '#fff', border: '1px solid #e2e5ea', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {preview ? 'Editar' : 'Vista previa'}
                </button>
              </div>

              {preview ? (
                <div className="md-prev" style={{ border: '1px solid #e2e5ea', borderRadius: 8, padding: '18px 20px', background: '#fff', minHeight: 200, fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.7, color: '#111' }}
                  // La vista previa muestra el formato; los {{marcadores}} se ven
                  // tal cual porque acá todavía no hay una propiedad de dónde sacar
                  // los datos (eso pasa al generar el contrato en la propiedad).
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(editando.cuerpo || '_Sin contenido._') }} />
              ) : (
                <>
                  {/* Barra de formato: escribe la sintaxis Markdown por vos, para
                      no tener que memorizarla. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {([
                      ['Título',   () => prefijoLinea('# ')],
                      ['Subtítulo',() => prefijoLinea('## ')],
                      ['Negrita',  () => envolver('**', 'texto')],
                      ['Cursiva',  () => envolver('*', 'texto')],
                      ['• Lista',  () => prefijoLinea('- ')],
                      ['1. Lista', () => prefijoLinea('1. ')],
                      ['Separador',() => insertar('\n---\n')],
                    ] as [string, () => void][]).map(([lbl, fn]) => (
                      <button key={lbl} type="button" onClick={fn}
                        style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#444' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <textarea ref={cuerpoRef} value={editando.cuerpo}
                    onChange={e => setEditando({ ...editando, cuerpo: e.target.value })}
                    rows={18}
                    placeholder={'# Contrato de captación\n\nEntre **{{oficina.nombre}}** y {{duenos}} se acuerda…\n\nLa propiedad ubicada en {{propiedad.ubicacion}}, finca {{propiedad.finca}}, se ofrece por {{propiedad.precio}}.\n\n## Comisión\n\nComisión pactada: {{contrato.comision}}.'}
                    style={{ ...inputSt, height: 'auto', padding: 12, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6 }} />
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
                    Formato con Markdown: <strong>**negrita**</strong>, <em>*cursiva*</em>, <code># Título</code>, <code>- listas</code>. Usá los botones si preferís.
                  </p>
                </>
              )}

              {desconocidas.length > 0 && (
                <p style={{ fontSize: 12, color: '#D97706', margin: '8px 0 0' }}>
                  Estos marcadores no existen y saldrán marcados en el contrato: {desconocidas.map(d => `{{${d}}}`).join(', ')}
                </p>
              )}
            </div>

            <div style={{ border: '1px solid #eceef1', borderRadius: 10, padding: 14, background: '#fafbfc' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 4 }}>Datos disponibles</div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.5 }}>
                Clic para insertarlo donde está el cursor. Al generar el contrato se
                reemplaza con el dato de la propiedad.
              </p>
              {VARIABLES.map(g => (
                <div key={g.grupo} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{g.grupo}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.items.map(i => (
                      <button key={i.clave} type="button" onClick={() => insertar(`{{${i.clave}}}`)} title={`{{${i.clave}}}`}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e5ea', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#5a6070' }}>
                        {i.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: '#e53e3e', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={saving}
              style={{ background: 'var(--color-primary, #111)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditando(null)}
              style={{ background: 'none', border: '1px solid #e2e5ea', borderRadius: 10, padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5a6070' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 12, overflow: 'hidden' }}>
        {lista.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
            Sin tipos de contrato. Creá el primero —captación, por ejemplo— con “+ Nuevo tipo”.
          </div>
        )}
        {lista.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid #f2f3f5', opacity: p.active ? 1 : .5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0f12' }}>
                {p.nombre} {!p.active && <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>· archivado</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.descripcion || `${p.cuerpo.length} caracteres`}
              </div>
            </div>
            <button onClick={() => { setEditando(p); setError(null) }}
              style={{ fontSize: 12, color: '#5a6070', background: 'none', border: '1px solid #e2e5ea', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Editar
            </button>
            <button onClick={() => archivar(p)}
              style={{ fontSize: 12, color: p.active ? '#b45309' : '#047857', background: 'none', border: '1px solid #e2e5ea', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {p.active ? 'Archivar' : 'Reactivar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
