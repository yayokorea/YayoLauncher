const PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile'

async function verifyMinecraftProfile(accessToken, fetchImpl = fetch) {
    const response = await fetchImpl(PROFILE_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': 'YayoLauncher-TicketAPI'
        },
        signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
        const error = new Error('Minecraft profile verification failed.')
        error.code = 'INVALID_MINECRAFT_TOKEN'
        throw error
    }
    const profile = await response.json()
    if (typeof profile.id !== 'string' || typeof profile.name !== 'string') {
        throw new Error('Minecraft profile response was malformed.')
    }
    return profile
}

module.exports = { PROFILE_URL, verifyMinecraftProfile }
