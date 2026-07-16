const assert = require('node:assert/strict')
const { test } = require('node:test')

const { FixedWindowRateLimiter } = require('../src/rate-limiter')
const { TicketService } = require('../src/ticket-service')

const UUID = '0123456789abcdef0123456789abcdef'
const CHALLENGE = Buffer.alloc(32, 1).toString('base64url')

class MemoryStore {
    constructor() {
        this.records = new Map()
    }
    async issue(key, value) {
        this.records.set(key, value)
    }
    async consume(key) {
        const value = this.records.get(key) || null
        this.records.delete(key)
        return value
    }
}

function createService(options = {}) {
    return new TicketService({
        store: options.store || new MemoryStore(),
        profileVerifier: async () => ({ id: UUID, name: 'Player' }),
        uuidRateLimiter: new FixedWindowRateLimiter(),
        ipRateLimiter: new FixedWindowRateLimiter(),
        now: options.now || (() => 100000),
        logger: { warn() {} }
    })
}

async function issue(service) {
    return service.issue({
        accessToken: 'minecraft-token',
        uuid: UUID,
        serverId: 'production-26.2',
        challenge: CHALLENGE,
        ipAddress: '127.0.0.1'
    })
}

test('정상 티켓은 정확히 한 번만 소비된다', async () => {
    const service = createService()
    const issued = await issue(service)
    assert.equal(issued.ok, true)

    const request = { ticket: issued.ticket, uuid: UUID, serverId: 'production-26.2', challenge: CHALLENGE }
    assert.deepEqual(await service.consume(request), { valid: true })
    assert.deepEqual(await service.consume(request), { valid: false })
})

test('동일 티켓을 동시에 소비해도 하나만 성공한다', async () => {
    const service = createService()
    const issued = await issue(service)
    const request = { ticket: issued.ticket, uuid: UUID, serverId: 'production-26.2', challenge: CHALLENGE }
    const results = await Promise.all([service.consume(request), service.consume(request)])
    assert.equal(results.filter(result => result.valid).length, 1)
})

test('UUID, 서버, challenge 바인딩이 일치해야 한다', async () => {
    for (const override of [
        { uuid: 'fedcba9876543210fedcba9876543210' },
        { serverId: 'other-server' },
        { challenge: Buffer.alloc(32, 2).toString('base64url') }
    ]) {
        const service = createService()
        const issued = await issue(service)
        const result = await service.consume({
            ticket: issued.ticket,
            uuid: UUID,
            serverId: 'production-26.2',
            challenge: CHALLENGE,
            ...override
        })
        assert.deepEqual(result, { valid: false })
    }
})

test('만료된 티켓은 거부된다', async () => {
    let now = 100000
    const service = createService({ now: () => now })
    const issued = await issue(service)
    now += 31000
    assert.deepEqual(await service.consume({
        ticket: issued.ticket,
        uuid: UUID,
        serverId: 'production-26.2',
        challenge: CHALLENGE
    }), { valid: false })
})

test('Minecraft 프로필 UUID가 요청 계정과 다르면 발급하지 않는다', async () => {
    const service = createService()
    service.profileVerifier = async () => ({ id: 'fedcba9876543210fedcba9876543210', name: 'Other' })
    assert.equal((await issue(service)).ok, false)
})

test('UUID와 IP 각각 분당 10회로 제한한다', async () => {
    const service = createService()
    for (let index = 0; index < 10; index++) {
        assert.equal((await issue(service)).ok, true)
    }
    assert.equal((await issue(service)).reason, 'rate_limited')
})
