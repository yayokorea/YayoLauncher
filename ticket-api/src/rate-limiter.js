class FixedWindowRateLimiter {

    constructor({ limit = 10, windowMs = 60000, now = Date.now } = {}) {
        this.limit = limit
        this.windowMs = windowMs
        this.now = now
        this.entries = new Map()
        this.nextPruneAt = 0
    }

    allow(key) {
        const currentTime = this.now()
        if (currentTime >= this.nextPruneAt) {
            this.prune(currentTime)
            this.nextPruneAt = currentTime + this.windowMs
        }
        const current = this.entries.get(key)
        if (current == null || current.resetAt <= currentTime) {
            this.entries.set(key, { count: 1, resetAt: currentTime + this.windowMs })
            return true
        }
        if (current.count >= this.limit) {
            return false
        }
        current.count++
        return true
    }

    prune(currentTime = this.now()) {
        for (const [key, value] of this.entries) {
            if (value.resetAt <= currentTime) {
                this.entries.delete(key)
            }
        }
    }
}

module.exports = { FixedWindowRateLimiter }
