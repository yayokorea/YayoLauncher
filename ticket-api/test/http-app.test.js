const assert = require('node:assert/strict')
const http = require('http')
const { after, before, test } = require('node:test')

const { createHandler } = require('../src/http-app')

const SERVICE_TOKEN = 'paper-service-token-at-least-32-characters'
const TICKET = Buffer.alloc(32, 3).toString('base64url')
const CHALLENGE = Buffer.alloc(32, 4).toString('base64url')
let server
let baseUrl
let consumeCalls = 0

before(async () => {
    const ticketService = {
        async issue(input) {
            assert.equal(input.accessToken, 'minecraft-token')
            return { ok: true, ticket: TICKET, expiresAt: '2026-07-17T00:00:30.000Z' }
        },
        async consume(input) {
            consumeCalls++
            return { valid: input.challenge === CHALLENGE }
        }
    }
    server = http.createServer(createHandler({
        ticketService,
        paperServiceToken: SERVICE_TOKEN,
        logger: { error() {} }
    }))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await new Promise(resolve => server.close(resolve))
})

test('티켓 발급 엔드포인트가 bearer token과 JSON을 처리한다', async () => {
    const response = await fetch(`${baseUrl}/v1/tickets`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer minecraft-token',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uuid: '0123456789abcdef0123456789abcdef', serverId: 'production', challenge: CHALLENGE })
    })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).ticket, TICKET)
})

test('JSON 객체가 아닌 요청 본문은 400으로 거부한다', async () => {
    const response = await fetch(`${baseUrl}/v1/tickets`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer minecraft-token',
            'Content-Type': 'application/json'
        },
        body: 'null'
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'invalid_request' })
})

test('consume 엔드포인트는 Paper 서비스 토큰 없이는 호출되지 않는다', async () => {
    const beforeCalls = consumeCalls
    const response = await fetch(`${baseUrl}/v1/tickets/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: TICKET, uuid: '0123456789abcdef0123456789abcdef', serverId: 'production', challenge: CHALLENGE })
    })
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { valid: false })
    assert.equal(consumeCalls, beforeCalls)
})

test('인증된 consume 요청만 검증 서비스에 전달한다', async () => {
    const response = await fetch(`${baseUrl}/v1/tickets/consume`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SERVICE_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ticket: TICKET, uuid: '0123456789abcdef0123456789abcdef', serverId: 'production', challenge: CHALLENGE })
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { valid: true })
})
