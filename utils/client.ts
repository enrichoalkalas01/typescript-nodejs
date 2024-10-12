import { createClient, type RedisClientType } from "redis"

let client: RedisClientType | null = null

export async function initializeRedisClient() {
    if ( !client ) {
        client = createClient({ url: "" })
        client.on("error", (error) => {
            console.error(error)
        })
        
        client.on("connect", () => {
            console.log("Redis Connected")
        })

        await client.connect()
    }

    return client
}