import express, { type NextFunction, type Request } from "express"
import { initializeRedisClient } from "../utils/client.js"
import { cuisineKey, cuisinesKey, restaurantKeyById } from "../utils/keys.js"
import { successResponse } from "../utils/responses.js"

const routes = express.Router()

routes.get("/", async (req, res, next) => {
    try {
        const client = await initializeRedisClient()
        const cuisines = await client.sMembers(cuisinesKey)

        successResponse({ res: res, data: cuisines })
    } catch (error) {
        next(error)
    }
})

routes.get("/:cuisine", async (req, res, next) => {
    const { cuisine } = req.params
    try {
        const client = await initializeRedisClient()
        const restaurantIds = await client.sMembers(cuisineKey(cuisine))
        const restaurants = await Promise.all(restaurantIds.map(id => client.hGet(restaurantKeyById(id), "name")))

        successResponse({ res: res, data: restaurants })
    } catch (error) {
        next(error)
    }
})

export default routes