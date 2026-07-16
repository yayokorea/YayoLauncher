const crypto = require('crypto')

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const SERVER_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const UUID_PATTERN = /^[a-f0-9]{32}$/

function randomToken() {
    return crypto.randomBytes(32).toString('base64url')
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('base64url')
}

function normalizeUuid(value) {
    return typeof value === 'string' ? value.replaceAll('-', '').toLowerCase() : ''
}

function safeEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false
    }
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

module.exports = {
    TOKEN_PATTERN,
    SERVER_ID_PATTERN,
    UUID_PATTERN,
    normalizeUuid,
    randomToken,
    safeEqual,
    sha256
}
