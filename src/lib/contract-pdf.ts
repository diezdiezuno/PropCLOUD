// Genera el PDF del contrato con la impresión del navegador.
//
// Ponytail: no se suma una librería de PDF (jsPDF/pdf-lib pesan y hay que
// paginar y medir el texto a mano). Se abre una ventana con el contrato
// maquetado para imprimir y el navegador ofrece "Guardar como PDF". Sale un
// PDF de verdad, con paginación real, y cero dependencias. Cuando haga falta
// firma con proveedor, ese sí generará el PDF del lado del servidor.

import { markdownToHtml } from '@/lib/markdown'

function escAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Abre la vista imprimible del contrato ya resuelto y dispara la impresión. */
export function imprimirContrato(opts: { titulo: string; logoUrl?: string | null; oficina: string; cuerpo: string }) {
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) { alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para descargar el PDF.'); return }
  // Logo del tenant arriba a la izquierda; si no hay, cae al nombre en texto.
  const encabezado = opts.logoUrl
    ? `<img class="logo" src="${escAttr(opts.logoUrl)}" alt="${escAttr(opts.oficina)}">`
    : `<span class="of">${escAttr(opts.oficina)}</span>`
  const cuerpoHtml = markdownToHtml(opts.cuerpo)
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${escAttr(opts.titulo)}</title>
    <style>
      @page { margin: 2.2cm 2cm; }
      * { box-sizing: border-box; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.7; font-size: 12pt; margin: 0; }
      header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 26px; }
      header .of { font-size: 15pt; font-weight: bold; letter-spacing: .3px; }
      header img.logo { max-height: 56px; max-width: 260px; display: block; }
      h1 { font-size: 16pt; margin: 22px 0; text-align: center; }
      h2 { font-size: 13pt; margin: 20px 0 8px; }
      h3 { font-size: 12pt; margin: 16px 0 6px; }
      p { margin: 0 0 12px; }
      ul, ol { margin: 0 0 12px; padding-left: 26px; }
      li { margin: 2px 0; }
      hr { border: none; border-top: 1px solid #ccc; margin: 22px 0; }
      table.grid { width: 100%; border-collapse: collapse; margin: 0 0 14px; table-layout: fixed; }
      table.grid td { width: 50%; padding: 3px 10px 3px 0; vertical-align: top; }
      @media screen { body { max-width: 720px; margin: 30px auto; padding: 0 20px; } }
    </style></head><body>
    <header>${encabezado}</header>
    ${cuerpoHtml}
    <script>window.onload = function(){ setTimeout(function(){ window.print() }, 250) }<\/script>
    </body></html>`)
  w.document.close()
}
