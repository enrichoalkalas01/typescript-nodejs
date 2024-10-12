import express, { type Request } from "express"

import { validate } from "../middlewares/validate.js"
import { RestaurantSchema, type Restaurant } from "../schema/restaurants.js"
import { initializeRedisClient } from "../utils/client.js"
import { nanoid } from "nanoid"
import { restaurantKeyById, reviewDetailsKeyById, reviewKeyById } from "../utils/keys.js"
import { successResponse } from "../utils/responses.js"
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js"
import { ReviewSchema, type Review } from "../schema/review.js"

const routes = express.Router()

routes.post("/", validate(RestaurantSchema),  async (req, res, next) => {
    const data = req.body as Restaurant

    try {
        const client = await initializeRedisClient()
        const id = nanoid()
        const restaurantKey = restaurantKeyById(id)

        const hashData = { id, name: data.name, location: data.location }
        const addResult = await client.hSet(restaurantKey, hashData)

        console.log(`Added ${addResult} field`)
        
        successResponse({ res: res, data: hashData, message: "Added new restaurant"})
    } catch (error) {
        next(error)
    }
})

routes.post("/:restaurantId/reviews", [checkRestaurantExists, validate(ReviewSchema)], async (req: Request<{ restaurantId: string }>, res: any, next: any) => {
    const { restaurantId } = req.params
    const data = req.body as Review

    try {
        const client = await initializeRedisClient()
        const reviewId = nanoid()
        const reviewKey = reviewKeyById(restaurantId)
        const reviewDetailsKey = reviewDetailsKeyById(reviewId)
        const reviewData = { id: reviewId, ...data, timestamp: Date.now(), restaurantId }

        await Promise.all([
            client.lPush(reviewKey, reviewId),
            client.hSet(reviewDetailsKey, reviewData)
        ])

        successResponse({ res: res, data: reviewData, message: "Review added"})
    } catch (error) {
        next(error)
    }
})

routes.get("/:restaurantId", [checkRestaurantExists], async (req: Request<{ restaurantId: string }>, res: any, next: any) => {
    const { restaurantId } = req.params

    try {
        const client = await initializeRedisClient()
        const restaurantKey = restaurantKeyById(restaurantId)
        const [viewCount, restaurant] = await Promise.all([
            client.hIncrBy(restaurantKey, "viewCount", 1), // Each hit api, view increased
            client.hGetAll(restaurantKey)
        ])

        console.log(viewCount)
        successResponse({ res: res, data: restaurant })
    } catch (error) {
        next(error)
    }
})

export default routes