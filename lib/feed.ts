// Posts whale-alert casts to the Base App / Farcaster feed from Base Watch's
// OWN account via Neynar. One signer, set up once — not per watching user.
// Docs: https://docs.neynar.com/reference/publish-cast

const API_KEY = process.env.NEYNAR_API_KEY || ''
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID || ''
const NEYNAR_CAST_API = 'https://api.neynar.com/v2/farcaster/cast'

const CAST_MAX_LEN = 320 // Farcaster cast text limit (bytes; chars is a safe proxy here)

// Feed posting is opt-in via env — both the API key and the app's approved
// signer must be present, otherwise we no-op (mirrors the notifications wrapper).
export function feedPostingEnabled(): boolean {
  return Boolean(API_KEY && SIGNER_UUID)
}

export async function postCast(text: string, idem?: string): Promise<void> {
  if (!feedPostingEnabled()) {
    console.warn('[feed] NEYNAR_API_KEY/NEYNAR_SIGNER_UUID not set — skipping cast')
    return
  }

  const res = await fetch(NEYNAR_CAST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: SIGNER_UUID,
      text: text.slice(0, CAST_MAX_LEN),
      // idem lets Neynar dedupe so a re-run of the same alert won't double-post.
      ...(idem ? { idem } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Neynar cast error ${res.status}: ${body}`)
  }
}
