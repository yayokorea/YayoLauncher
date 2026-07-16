const assert = require('node:assert/strict')
const http = require('http')
const { after, before, test } = require('node:test')

const { TicketBroker } = require('../app/assets/js/ticketbroker')

const ACCOUNT_UUID = '0123456789abcdef0123456789abcdef'
const CHALLENGE = Buffer.alloc(32, 7).toString('base64url')
const TICKET = Buffer.alloc(32, 9).toString('base64url')
let apiServer
let apiUrl

before(async () => {
    apiServer = http.createServer((request, response) => {
        const chunks = []
        request.on('data', chunk => chunks.push(chunk))
        request.on('end', () => {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            assert.equal(request.headers.authorization, 'Bearer minecraft-access-token')
            assert.deepEqual(body, {
                serverId: 'production-26.2',
                challenge: CHALLENGE,
                uuid: ACCOUNT_UUID
            })
            response.writeHead(201, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ ticket: TICKET, expiresAt: new Date(Date.now() + 30000).toISOString() }))
        })
    })
    await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${apiServer.address().port}`
})

after(async () => {
    await new Promise(resolve => apiServer.close(resolve))
})

test('loopback 브로커가 인증된 요청만 티켓 API로 전달한다', async () => {
    const broker = new TicketBroker({
        apiBaseUrl: apiUrl,
        accessToken: 'minecraft-access-token',
        accountUuid: ACCOUNT_UUID,
        serverId: 'production-26.2'
    })
    const environment = await broker.start()

    const unauthorized = await fetch(`${environment.YAYO_AUTH_BROKER_URL}/v1/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: 'production-26.2', challenge: CHALLENGE })
    })
    assert.equal(unauthorized.status, 401)

    const authorized = await fetch(`${environment.YAYO_AUTH_BROKER_URL}/v1/tickets`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${environment.YAYO_AUTH_BROKER_SECRET}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId: 'production-26.2', challenge: CHALLENGE })
    })
    assert.equal(authorized.status, 200)
    assert.equal((await authorized.json()).ticket, TICKET)

    await broker.close()
})

test('선택된 서버와 다른 serverId는 거부한다', async () => {
    const broker = new TicketBroker({
        apiBaseUrl: apiUrl,
        accessToken: 'minecraft-access-token',
        accountUuid: ACCOUNT_UUID,
        serverId: 'production-26.2'
    })
    const environment = await broker.start()
    const response = await fetch(`${environment.YAYO_AUTH_BROKER_URL}/v1/tickets`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${environment.YAYO_AUTH_BROKER_SECRET}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serverId: 'other', challenge: CHALLENGE })
    })
    assert.equal(response.status, 400)
    await broker.close()
})
