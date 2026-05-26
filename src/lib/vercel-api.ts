const TOKEN = process.env.VERCEL_API_TOKEN!
const PROJECT_ID = process.env.VERCEL_PROJECT_ID!
const BASE = 'https://api.vercel.com'

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
}

export interface DomainStatus {
  name: string
  verified: boolean
  verification: Array<{ type: string; domain: string; value: string; reason: string }>
  misconfigured?: boolean
  error?: { code: string; message: string } | null
}

/** Add a domain to the Vercel project. Returns status including DNS records needed.
 *  If the domain already exists in this project, fetches and returns its current status. */
export async function addDomain(domain: string): Promise<DomainStatus> {
  const res = await fetch(`${BASE}/v9/projects/${PROJECT_ID}/domains`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name: domain }),
  })
  const body = await res.json()
  // Vercel returns 409 with error.code === 'domain_already_in_use' when the domain
  // belongs to another project, or just returns the existing domain object when it's
  // already in this project (200/201). In both cases we return the body as-is so the
  // caller can inspect it. If it's a 409 conflict we still return it — the UI shows the
  // error message to the operator.
  return body
}

/** Get current verification status of a domain in the project. */
export async function getDomainStatus(domain: string): Promise<DomainStatus | null> {
  const res = await fetch(`${BASE}/v9/projects/${PROJECT_ID}/domains/${domain}`, {
    headers: headers(),
  })
  if (res.status === 404) return null
  return res.json()
}

/** Trigger a re-verification of a domain. */
export async function verifyDomain(domain: string): Promise<DomainStatus> {
  const res = await fetch(`${BASE}/v9/projects/${PROJECT_ID}/domains/${domain}/verify`, {
    method: 'POST',
    headers: headers(),
  })
  return res.json()
}

/** Remove a domain from the Vercel project. */
export async function removeDomain(domain: string): Promise<boolean> {
  const res = await fetch(`${BASE}/v9/projects/${PROJECT_ID}/domains/${domain}`, {
    method: 'DELETE',
    headers: headers(),
  })
  return res.ok
}
