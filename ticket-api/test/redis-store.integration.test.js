const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createClient } = require('redis')

const { RedisTicketStore } = require('../src/redis-store')

test('Redis GETDEL은 동시 소비 요청 중 하나만 성공시킨다', { skip: !process.env.TEST_REDIS_URL }, async () => {
    const client = createClient({ url: process.env.TEST_REDIS_URL })
    await client.connect()
    try {
        const store = new RedisTicketStore(client, `yayo:test:${Date.now()}:`)
        await store.issue('ticket-hash', { uuid: 'test-player' }, 30)
        const results = await Promise.all([store.consume('ticket-hash'), store.consume('ticket-hash')])
        assert.equal(results.filter(Boolean).length, 1)
        assert.equal(results.find(Boolean).uuid, 'test-player')
    } finally {
        await client.quit()
    }
})
