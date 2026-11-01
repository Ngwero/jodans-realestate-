import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
export const DEVELOPMENT_SECRET = 'jodans-bloka-dev-secret'

export function signingSecret(settings = process.env) {
  let secret = settings.JB_SECRET
  if (!secret && settings.SUPABASE_SERVICE_ROLE_KEY?.length >= 32) {
    // Domain-separated derivation keeps sessions stable across replicas without
    // exposing or using the API key directly as a session signature secret.
    secret = Buffer.from(crypto.hkdfSync('sha256', settings.SUPABASE_SERVICE_ROLE_KEY,
      'jodans-bloka', 'app-session-signing-v1', 32)).toString('hex')
  }
  secret ||= DEVELOPMENT_SECRET
  if (settings.NODE_ENV === 'production' && (secret === DEVELOPMENT_SECRET || secret.length < 32)) {
    throw new Error('Set JB_SECRET (at least 32 characters) or a valid backend Supabase secret before starting in production.')
  }
  return secret
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password, stored, settings = process.env) {
  if (typeof stored !== 'string') return false
  if (stored.startsWith('scrypt:')) {
    const [, salt, encoded] = stored.split(':')
    if (!salt || !/^[a-f0-9]{128}$/.test(encoded || '')) return false
    const key = await scrypt(password, salt, 64)
    return crypto.timingSafeEqual(key, Buffer.from(encoded, 'hex'))
  }
  // Preserve existing salted SHA-256 hashes during the data import.
  if (!/^[a-f0-9]{64}$/.test(stored)) return false
  const legacySecret = settings.LEGACY_JB_SECRET || settings.JB_SECRET || DEVELOPMENT_SECRET
  const expected = crypto.createHash('sha256').update(`${legacySecret}:${password}`).digest()
  return crypto.timingSafeEqual(expected, Buffer.from(stored, 'hex'))
}

export function signToken(user, secret = signingSecret()) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: user.role,
    email: user.email, name: user.name, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url')
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`
}

export function verifyToken(token, secret = signingSecret()) {
  if (typeof token !== 'string') return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof data.sub === 'string' && Number.isFinite(data.exp) && data.exp > Date.now() ? data : null
  } catch { return null }
}

export function createAuth(supabase, secret = signingSecret()) {
  return function auth(requiredRole) {
    return async (req, res, next) => {
      try {
        const header = req.headers.authorization || ''
        const session = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '', secret)
        if (!session) return res.status(401).json({ error: 'Please sign in' })
        const { data: profile, error } = await supabase.from('app_profiles')
          .select('id,email,name,role,active').eq('id', session.sub).single()
        if (error?.code === 'PGRST116' || !profile && !error) return res.status(401).json({ error: 'Please sign in again' })
        if (error) throw error
        if (!profile.active) return res.status(403).json({ error: 'Account disabled' })
        // Read current roles, rather than trusting a stale role in the token.
        if (requiredRole && profile.role !== requiredRole && profile.role !== 'admin') {
          return res.status(403).json({ error: 'Not allowed' })
        }
        req.user = { sub: profile.id, name: profile.name, role: profile.role, email: profile.email }
        next()
      } catch (error) { next(error) }
    }
  }
}
