import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { signingSecret, verifyPassword, verifyToken, DEVELOPMENT_SECRET } from '../auth.js'

test('production derives a stable, separated signing key from its configured backend secret', () => {
  const settings = { NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_' + 'a'.repeat(32) }
  const derived = signingSecret(settings)
  assert.equal(derived, signingSecret({ ...settings }))
  assert.equal(derived.length, 64)
  assert.notEqual(derived, settings.SUPABASE_SERVICE_ROLE_KEY)
  assert.notEqual(derived, signingSecret({ ...settings, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_' + 'b'.repeat(32) }))
})

test('an explicit signing secret takes precedence and insecure production settings fail closed', () => {
  const explicit = 'c'.repeat(64)
  assert.equal(signingSecret({ NODE_ENV: 'production', JB_SECRET: explicit, SUPABASE_SERVICE_ROLE_KEY: 'd'.repeat(40) }), explicit)
  assert.throws(() => signingSecret({ NODE_ENV: 'production' }))
  assert.throws(() => signingSecret({ NODE_ENV: 'production', JB_SECRET: 'short', SUPABASE_SERVICE_ROLE_KEY: 'd'.repeat(40) }))
})

test('backend-derived session keys do not change existing development password verification', async () => {
  const settings = { NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_' + 'a'.repeat(32) }
  const hash = crypto.createHash('sha256').update(`${DEVELOPMENT_SECRET}:retained-password`).digest('hex')
  assert(await verifyPassword('retained-password', hash, settings))
  assert(!await verifyPassword('wrong-password', hash, settings))
  const customHash = crypto.createHash('sha256').update('old-secret:retained-password').digest('hex')
  assert(await verifyPassword('retained-password', customHash, { ...settings, LEGACY_JB_SECRET: 'old-secret' }))
})

test('malformed token signatures never throw', () => {
  assert.equal(verifyToken('e30.' + 'é'.repeat(43), 'x'.repeat(64)), null)
})
