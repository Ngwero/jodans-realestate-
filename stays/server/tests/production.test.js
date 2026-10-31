import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { createApp } from '../app.js'

test('production serves the SPA and assets without swallowing API routes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jodans-web-'))
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>Jodans</title><div id="root"></div>')
  await writeFile(path.join(directory, 'assets', 'app.js'), 'window.loaded = true')
  const supabase = {
    from() { return { select() { return { async limit() { return { error: null } } } } } },
  }
  const server = createApp(supabase, { webDirectory: directory }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    for (const route of ['/', '/host/login', '/stay/example', '/reset-password']) {
      const response = await fetch(base + route)
      assert.equal(response.status, 200, route)
      assert.match(response.headers.get('content-type'), /text\/html/)
      assert.match(await response.text(), /<div id="root">/)
    }
    const asset = await fetch(base + '/assets/app.js')
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('content-type'), /javascript/)
    assert.equal((await fetch(base + '/assets/missing.js')).status, 404)
    assert.equal((await fetch(base + '/.env')).status, 404)
    const missingApi = await fetch(base + '/api/missing')
    assert.equal(missingApi.status, 404)
    assert.deepEqual(await missingApi.json(), { error: 'Not found' })
    assert.equal((await fetch(base + '/api/admin/stats')).status, 401)
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), {
      ok: true, service: 'jodans-bloka-api', database: 'supabase',
    })
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
