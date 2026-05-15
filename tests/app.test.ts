import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { app } from '../src/app.js'

describe('sample routes', () => {
  it('returns the root response', async () => {
    const res = await app.request('/')

    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      message: 'Hello Hono!',
    })
  })

  it('returns health status', async () => {
    const res = await app.request('/health')

    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      status: 'ok',
      service: 'cicd-template',
    })
  })

  it('returns sample users', async () => {
    const res = await app.request('/api/users')
    const body = await res.json()

    assert.equal(res.status, 200)
    assert.equal(body.data.length, 2)
    assert.deepEqual(body.data[0], {
      id: 1,
      name: 'Budi Santoso',
      email: 'budi@example.com',
    })
  })

  it('returns a sample user by id', async () => {
    const res = await app.request('/api/users/2')

    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      data: {
        id: 2,
        name: 'Siti Aminah',
        email: 'siti@example.com',
      },
    })
  })

  it('returns 404 when user does not exist', async () => {
    const res = await app.request('/api/users/999')

    assert.equal(res.status, 404)
    assert.deepEqual(await res.json(), {
      message: 'User not found',
    })
  })
})
