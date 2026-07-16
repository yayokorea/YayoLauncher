function required(name) {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
}

function loadConfig() {
    const paperServiceToken = required('PAPER_SERVICE_TOKEN')
    if (paperServiceToken.length < 32) {
        throw new Error('PAPER_SERVICE_TOKEN must contain at least 32 characters.')
    }
    const port = Number.parseInt(process.env.PORT || '8080')
    const ticketTtlSeconds = Number.parseInt(process.env.TICKET_TTL_SECONDS || '30')
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535.')
    }
    if (!Number.isInteger(ticketTtlSeconds) || ticketTtlSeconds < 5 || ticketTtlSeconds > 300) {
        throw new Error('TICKET_TTL_SECONDS must be between 5 and 300.')
    }
    return {
        host: process.env.HOST || '127.0.0.1',
        port,
        redisUrl: required('REDIS_URL'),
        paperServiceToken,
        ticketTtlSeconds
    }
}

module.exports = { loadConfig }
