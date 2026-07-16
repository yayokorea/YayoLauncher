const { safeEqual } = require('./encoding')

const MAX_BODY_BYTES = 4096

function json(response, statusCode, body) {
    const data = Buffer.from(JSON.stringify(body))
    response.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Cache-Control': 'no-store'
    })
    response.end(data)
}

function bearerToken(request) {
    const value = request.headers.authorization
    return typeof value === 'string' && value.startsWith('Bearer ') ? value.substring(7) : null
}

function requestIp(request) {
    const remoteAddress = request.socket.remoteAddress || 'unknown'
    const forwarded = request.headers['x-forwarded-for']
    const fromLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'
    if (fromLoopback && typeof forwarded === 'string') {
        return forwarded.split(',', 1)[0].trim()
    }
    return remoteAddress
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let length = 0
        request.on('data', chunk => {
            length += chunk.length
            if (length > MAX_BODY_BYTES) {
                const error = new Error('Body too large.')
                error.code = 'BAD_REQUEST'
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
                    const error = new SyntaxError('JSON body must be an object.')
                    error.code = 'BAD_REQUEST'
                    throw error
                }
                resolve(value)
            } catch (error) {
                error.code = 'BAD_REQUEST'
                reject(error)
            }
        })
        request.on('error', reject)
    })
}

function createHandler({ ticketService, paperServiceToken, logger = console }) {
    return async function handler(request, response) {
        try {
            if (request.method === 'GET' && request.url === '/health') {
                json(response, 200, { status: 'ok' })
                return
            }
            if (request.method !== 'POST') {
                json(response, 404, { error: 'not_found' })
                return
            }

            if (request.url === '/v1/tickets') {
                const accessToken = bearerToken(request)
                const body = await readJson(request)
                const result = await ticketService.issue({
                    accessToken,
                    uuid: body.uuid,
                    serverId: body.serverId,
                    challenge: body.challenge,
                    ipAddress: requestIp(request)
                })
                if (!result.ok) {
                    const status = result.reason === 'rate_limited' ? 429 : (result.reason === 'invalid_request' ? 400 : 401)
                    json(response, status, { error: result.reason })
                    return
                }
                json(response, 201, { ticket: result.ticket, expiresAt: result.expiresAt })
                return
            }

            if (request.url === '/v1/tickets/consume') {
                const token = bearerToken(request)
                if (!safeEqual(token, paperServiceToken)) {
                    json(response, 401, { valid: false })
                    return
                }
                const body = await readJson(request)
                const result = await ticketService.consume(body)
                json(response, result.valid ? 200 : 401, result)
                return
            }

            json(response, 404, { error: 'not_found' })
        } catch (error) {
            if (error.code === 'BAD_REQUEST') {
                if (!response.headersSent) {
                    json(response, 400, { error: 'invalid_request' })
                }
                return
            }
            logger.error('Ticket API request failed', { method: request.method, url: request.url, message: error.message })
            if (!response.headersSent) {
                json(response, 503, request.url === '/v1/tickets/consume' ? { valid: false } : { error: 'unavailable' })
            }
        }
    }
}

module.exports = { MAX_BODY_BYTES, bearerToken, createHandler, readJson }
