const crypto = require('crypto')
const http = require('http')
const got = require('got')

const MAX_BODY_BYTES = 4096
const REQUEST_TIMEOUT_MS = 8000

function isLoopback(address) {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function isBase64Url32(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

function isServerId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value)
}

function sendJson(response, statusCode, body) {
    const encoded = Buffer.from(JSON.stringify(body))
    response.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': encoded.length,
        'Cache-Control': 'no-store'
    })
    response.end(encoded)
}

class TicketBroker {

    constructor({ apiBaseUrl, accessToken, serverId, accountUuid, request = got }) {
        const normalizedUuid = typeof accountUuid === 'string' ? accountUuid.replaceAll('-', '').toLowerCase() : ''
        if (!apiBaseUrl || !accessToken || !isServerId(serverId) || !/^[a-f0-9]{32}$/.test(normalizedUuid)) {
            throw new Error('Ticket broker configuration is incomplete.')
        }

        const parsedUrl = new URL(apiBaseUrl)
        if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && parsedUrl.hostname === '127.0.0.1')) {
            throw new Error('Ticket API must use HTTPS (HTTP is allowed only for 127.0.0.1 development).')
        }

        this.apiBaseUrl = parsedUrl.toString().replace(/\/$/, '')
        this.accessToken = accessToken
        this.serverId = serverId
        this.accountUuid = normalizedUuid
        this.request = request
        this.secret = crypto.randomBytes(32).toString('base64url')
        this.server = null
    }

    async start() {
        if (this.server != null) {
            return this.getLaunchEnvironment()
        }

        this.server = http.createServer((request, response) => this.handleRequest(request, response))
        this.server.requestTimeout = REQUEST_TIMEOUT_MS
        this.server.headersTimeout = REQUEST_TIMEOUT_MS

        await new Promise((resolve, reject) => {
            this.server.once('error', reject)
            this.server.listen(0, '127.0.0.1', () => {
                this.server.removeListener('error', reject)
                resolve()
            })
        })

        return this.getLaunchEnvironment()
    }

    getLaunchEnvironment() {
        if (this.server == null || !this.server.listening) {
            throw new Error('Ticket broker is not running.')
        }
        const address = this.server.address()
        return {
            YAYO_AUTH_BROKER_URL: `http://127.0.0.1:${address.port}`,
            YAYO_AUTH_BROKER_SECRET: this.secret,
            YAYO_AUTH_SERVER_ID: this.serverId
        }
    }

    async handleRequest(request, response) {
        try {
            if (!isLoopback(request.socket.remoteAddress)) {
                sendJson(response, 403, { error: 'forbidden' })
                return
            }
            if (request.method !== 'POST' || request.url !== '/v1/tickets') {
                sendJson(response, 404, { error: 'not_found' })
                return
            }
            if (!this.isAuthorized(request.headers.authorization)) {
                sendJson(response, 401, { error: 'unauthorized' })
                return
            }

            const body = await this.readJson(request)
            if (body.serverId !== this.serverId || !isBase64Url32(body.challenge)) {
                sendJson(response, 400, { error: 'invalid_request' })
                return
            }

            const apiResponse = await this.request.post(`${this.apiBaseUrl}/v1/tickets`, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'User-Agent': 'YayoLauncher-TicketBroker'
                },
                json: {
                    serverId: this.serverId,
                    challenge: body.challenge,
                    uuid: this.accountUuid
                },
                responseType: 'json',
                timeout: { request: REQUEST_TIMEOUT_MS },
                retry: 0
            })

            const ticket = apiResponse.body
            if (!isBase64Url32(ticket?.ticket) || typeof ticket?.expiresAt !== 'string') {
                throw new Error('Ticket API returned an invalid response.')
            }
            sendJson(response, 200, ticket)
        } catch (error) {
            if (!response.headersSent) {
                const statusCode = error.code === 'BODY_TOO_LARGE' || error instanceof SyntaxError ? 400 : 502
                sendJson(response, statusCode, { error: statusCode === 400 ? 'invalid_request' : 'ticket_unavailable' })
            } else {
                response.end()
            }
        }
    }

    isAuthorized(header) {
        if (typeof header !== 'string' || !header.startsWith('Bearer ') || this.secret == null) {
            return false
        }
        const provided = Buffer.from(header.substring(7))
        const expected = Buffer.from(this.secret)
        return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
    }

    readJson(request) {
        return new Promise((resolve, reject) => {
            const chunks = []
            let size = 0
            request.on('data', chunk => {
                size += chunk.length
                if (size > MAX_BODY_BYTES) {
                    const error = new Error('Request body is too large.')
                    error.code = 'BODY_TOO_LARGE'
                    reject(error)
                    request.destroy()
                    return
                }
                chunks.push(chunk)
            })
            request.on('end', () => {
                try {
                    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
                        throw new SyntaxError('JSON body must be an object.')
                    }
                    resolve(value)
                } catch (error) {
                    reject(error)
                }
            })
            request.on('error', reject)
        })
    }

    async close() {
        this.accessToken = null
        this.secret = null
        if (this.server == null) {
            return
        }
        const server = this.server
        this.server = null
        if (server.closeAllConnections) {
            server.closeAllConnections()
        }
        await new Promise(resolve => server.close(resolve))
    }
}

module.exports = { TicketBroker, isBase64Url32, isLoopback, isServerId }
