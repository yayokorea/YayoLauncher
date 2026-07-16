const {
    TOKEN_PATTERN,
    SERVER_ID_PATTERN,
    UUID_PATTERN,
    normalizeUuid,
    randomToken,
    safeEqual,
    sha256
} = require('./encoding')

class TicketService {

    constructor({ store, profileVerifier, uuidRateLimiter, ipRateLimiter, ttlSeconds = 30, now = Date.now, logger = console }) {
        this.store = store
        this.profileVerifier = profileVerifier
        this.uuidRateLimiter = uuidRateLimiter
        this.ipRateLimiter = ipRateLimiter
        this.ttlSeconds = ttlSeconds
        this.now = now
        this.logger = logger
    }

    async issue({ accessToken, uuid, serverId, challenge, ipAddress }) {
        const requestedUuid = normalizeUuid(uuid)
        if (!accessToken || !UUID_PATTERN.test(requestedUuid) || !SERVER_ID_PATTERN.test(serverId) || !TOKEN_PATTERN.test(challenge)) {
            return { ok: false, reason: 'invalid_request' }
        }
        if (!this.ipRateLimiter.allow(`ip:${ipAddress}`)) {
            return { ok: false, reason: 'rate_limited' }
        }

        let profile
        try {
            profile = await this.profileVerifier(accessToken)
        } catch (error) {
            this.logger.warn('Ticket issue rejected: minecraft_profile_failed')
            return { ok: false, reason: 'unauthorized' }
        }

        const verifiedUuid = normalizeUuid(profile.id)
        if (!safeEqual(verifiedUuid, requestedUuid)) {
            this.logger.warn('Ticket issue rejected: uuid_mismatch')
            return { ok: false, reason: 'unauthorized' }
        }
        if (!this.uuidRateLimiter.allow(`uuid:${verifiedUuid}`)) {
            return { ok: false, reason: 'rate_limited' }
        }

        const ticket = randomToken()
        const expiresAtMs = this.now() + this.ttlSeconds * 1000
        await this.store.issue(sha256(ticket), {
            uuid: verifiedUuid,
            serverId,
            challengeHash: sha256(challenge),
            expiresAt: expiresAtMs
        }, this.ttlSeconds)

        return {
            ok: true,
            ticket,
            expiresAt: new Date(expiresAtMs).toISOString()
        }
    }

    async consume({ ticket, uuid, serverId, challenge }) {
        const normalizedUuid = normalizeUuid(uuid)
        if (!TOKEN_PATTERN.test(ticket) || !UUID_PATTERN.test(normalizedUuid) || !SERVER_ID_PATTERN.test(serverId) || !TOKEN_PATTERN.test(challenge)) {
            this.logger.warn('Ticket consume rejected: invalid_request')
            return { valid: false }
        }

        const record = await this.store.consume(sha256(ticket))
        if (record == null) {
            this.logger.warn('Ticket consume rejected: expired_or_replayed')
            return { valid: false }
        }

        const matches = record.expiresAt >= this.now()
            && safeEqual(record.uuid, normalizedUuid)
            && safeEqual(record.serverId, serverId)
            && safeEqual(record.challengeHash, sha256(challenge))
        if (!matches) {
            this.logger.warn('Ticket consume rejected: binding_mismatch')
        }
        return { valid: matches }
    }
}

module.exports = { TicketService }
