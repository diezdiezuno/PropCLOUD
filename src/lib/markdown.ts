// Markdown mínimo para los contratos.
//
// Ponytail: no se suma marked/markdown-it (dependencia entera) para el
// subconjunto que un contrato necesita: títulos, negrita, cursiva, listas,
// separadores y párrafos. Es un renderizador propio, chico y probado.
//
// Escapa el HTML primero y recién después aplica el formato, así el texto del
// contrato —que puede traer < > & de los datos— nunca inyecta marcado.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Negrita/cursiva sobre texto YA escapado. La negrita va primero para que
// **texto** no se coma como cursiva.
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
}

export function markdownToHtml(src: string): string {
  const lineas = src.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  // Acumula ítems de lista (ul u ol) hasta que se corte.
  function lista(tipo: 'ul' | 'ol', regex: RegExp) {
    const items: string[] = []
    while (i < lineas.length && regex.test(lineas[i])) {
      items.push(`<li>${inline(lineas[i].replace(regex, ''))}</li>`)
      i++
    }
    out.push(`<${tipo}>${items.join('')}</${tipo}>`)
  }

  while (i < lineas.length) {
    const l = lineas[i]
    if (!l.trim()) { i++; continue }                       // línea en blanco: separa bloques
    if (/^###\s+/.test(l))      { out.push(`<h3>${inline(l.replace(/^###\s+/, ''))}</h3>`); i++; continue }
    if (/^##\s+/.test(l))       { out.push(`<h2>${inline(l.replace(/^##\s+/, ''))}</h2>`); i++; continue }
    if (/^#\s+/.test(l))        { out.push(`<h1>${inline(l.replace(/^#\s+/, ''))}</h1>`); i++; continue }
    if (/^\s*---+\s*$/.test(l)) { out.push('<hr>'); i++; continue }
    if (/^\s*[-*]\s+/.test(l))  { lista('ul', /^\s*[-*]\s+/); continue }
    if (/^\s*\d+\.\s+/.test(l)) { lista('ol', /^\s*\d+\.\s+/); continue }
    // Párrafo: junta líneas seguidas hasta un blanco, con <br> entre ellas.
    const parr: string[] = []
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\s*---+\s*$)/.test(lineas[i])) {
      parr.push(inline(lineas[i])); i++
    }
    out.push(`<p>${parr.join('<br>')}</p>`)
  }
  return out.join('\n')
}
