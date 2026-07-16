class RedisTicketStore {

    constructor(client, prefix = 'yayo:ticket:') {
        this.client = client
        this.prefix = prefix
    }

    async issue(ticketHash, record, ttlSeconds) {
        const result = await this.client.set(this.prefix + ticketHash, JSON.stringify(record), {
            EX: ttlSeconds,
            NX: true
        })
        if (result !== 'OK') {
            throw new Error('Ticket collision.')
        }
    }

    async consume(ticketHash) {
        const value = await this.client.getDel(this.prefix + ticketHash)
        return value == null ? null : JSON.parse(value)
    }
}

module.exports = { RedisTicketStore }
