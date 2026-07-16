const http = require('http')
const { createClient } = require('redis')

const { loadConfig } = require('./config')
const { createHandler } = require('./http-app')
const { verifyMinecraftProfile } = require('./minecraft-profile')
const { FixedWindowRateLimiter } = require('./rate-limiter')
const { RedisTicketStore } = require('./redis-store')
const { TicketService } = require('./ticket-service')

async function main() {
    const config = loadConfig()
    const redis = createClient({ url: config.redisUrl })
    redis.on('error', error => console.error('Redis error:', error.message))
    await redis.connect()

    const service = new TicketService({
        store: new RedisTicketStore(redis),
        profileVerifier: verifyMinecraftProfile,
        uuidRateLimiter: new FixedWindowRateLimiter(),
        ipRateLimiter: new FixedWindowRateLimiter(),
        ttlSeconds: config.ticketTtlSeconds
    })
    const server = http.createServer(createHandler({
        ticketService: service,
        paperServiceToken: config.paperServiceToken
    }))
    server.requestTimeout = 10000
    server.headersTimeout = 10000

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(config.port, config.host, resolve)
    })
    console.log(`Ticket API listening on http://${config.host}:${config.port}`)

    const shutdown = async () => {
        server.close()
        await redis.quit()
    }
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
}

main().catch(error => {
    console.error('Ticket API failed to start:', error.message)
    process.exitCode = 1
})
