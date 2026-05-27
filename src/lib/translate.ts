/**
 * Translates English text to Spanish using Google Translate's free
 * public endpoint (no API key, no registration required).
 *
 * Results should always be cached in Supabase — this function should
 * only be called for texts that don't already have a cached translation.
 */
export async function translateEnToEs(text: string): Promise<string | null> {
  if (!text?.trim()) return null

  try {
    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null

    const data = await res.json()
    // Response shape: [ [ ["translated chunk", "original chunk"], ... ], ... ]
    const translated = (data[0] as [string, string][])
      .map(([t]) => t)
      .filter(Boolean)
      .join('')

    return translated || null
  } catch {
    return null
  }
}

/**
 * Translates a batch of {id, text} pairs to Spanish with controlled concurrency
 * (20 at a time, 200ms between batches) to stay friendly to the free endpoint.
 * Returns a Map of id → translated text for successful translations.
 */
export async function translateBatch(
  pairs: Array<{ id: string; text: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (pairs.length === 0) return result

  const CHUNK = 20

  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK)
    const translations = await Promise.all(
      chunk.map(async ({ id, text }) => {
        const translated = await translateEnToEs(text)
        return { id, translated }
      })
    )
    for (const { id, translated } of translations) {
      if (translated) result.set(id, translated)
    }
    // Brief pause between chunks to be polite to the free endpoint
    if (i + CHUNK < pairs.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return result
}
