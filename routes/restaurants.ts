import express, { type NextFunction, type Request } from "express"

import { validate } from "../middlewares/validate.js"
import { RestaurantSchema, type Restaurant } from "../schema/restaurants.js"
import { initializeRedisClient } from "../utils/client.js"
import { nanoid } from "nanoid"
import { cuisineKey, cuisinesKey, restaurantCuisinesKeyById, restaurantKeyById, restaurantsByRatingKey, reviewDetailsKeyById, reviewKeyById } from "../utils/keys.js"
import { errorResponse, successResponse } from "../utils/responses.js"
import { checkRestaurantExists } from "../middlewares/checkRestaurantId.js"
import { ReviewSchema, type Review } from "../schema/review.js"

const routes = express.Router()

routes.get("/", async ( req, res, next) => {
    const { page = 1, limit = 10 } = req.query
    const start = (Number(page) - 1 ) * Number(limit)
    const end = start + Number(limit)

    try {
        const client = await initializeRedisClient()
        const restaurantIds = await client.zRange(restaurantsByRatingKey, start, end, { REV: true})
        const restaurants = await Promise.all(restaurantIds.map(id => client.hGetAll(restaurantKeyById(id))))

        successResponse({ res: res, data: restaurants })
    } catch (error) {
        next(error)
    }
})

routes.post("/", validate(RestaurantSchema),  async (req, res, next) => {
    const data = req.body as Restaurant

    try {
        const client = await initializeRedisClient()
        const id = nanoid()
        const restaurantKey = restaurantKeyById(id)

        const hashData = { id, name: data.name, location: data.location }
        const addResult = await Promise.all([
            ...data.cuisines.map(cuisine => Promise.all([
                client.sAdd(cuisinesKey, cuisine),
                client.sAdd(cuisineKey(cuisine), id),
                client.sAdd(restaurantCuisinesKeyById(id), cuisine)
            ])),
            client.hSet(restaurantKey, hashData),
            client.zAdd(restaurantsByRatingKey, {
                score: 0,
                value: id,
            })
        ])

        console.log(`Added ${addResult} field`)
        
        successResponse({ res: res, data: hashData, message: "Added new restaurant"})
    } catch (error) {
        next(error)
    }
})

routes.get("/:restaurantId", [checkRestaurantExists], async (req: Request<{ restaurantId: string }>, res: any, next: any) => {
    const { restaurantId } = req.params

    try {
        const client = await initializeRedisClient()
        const restaurantKey = restaurantKeyById(restaurantId)
        const [viewCount, restaurant, cuisines] = await Promise.all([
            client.hIncrBy(restaurantKey, "viewCount", 1), // Each hit api, view increased
            client.hGetAll(restaurantKey),
            client.sMembers(restaurantCuisinesKeyById(restaurantId)),
        ])

        successResponse({ res: res, data: { ...restaurant, cuisines } })
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
        const restaurantKey = restaurantKeyById(restaurantId)

        const [reviewCount, setResult, totalStars] = await Promise.all([
            client.lPush(reviewKey, reviewId),
            client.hSet(reviewDetailsKey, reviewData),
            client.hIncrByFloat(restaurantKey, "totalStars", data.rating)
        ])

        const averageRating = Number((totalStars / reviewCount).toFixed(1))
        await Promise.all([
            client.zAdd(restaurantsByRatingKey, {
                score: averageRating,
                value: restaurantId,
            }),
            client.hSet(restaurantKey, "avgStars", averageRating),
        ])

        successResponse({ res: res, data: reviewData, message: "Review added"})
    } catch (error) {
        next(error)
    }
})

routes.get("/:restaurantId/reviews", [checkRestaurantExists], async (req: Request<{ restaurantId: string }>, res: any, next: any) => {
    const { restaurantId } = req.params
    const { page = 1, limit = 10 } = req.query
    const start = (Number(page) - 1) * Number(limit)
    const end = start + Number(limit) - 1

    try {
        const client = await initializeRedisClient()
        const reviewKey = reviewKeyById(restaurantId)
        const reviewIds = await client.lRange(reviewKey, start, end)
        const reviews = await Promise.all(reviewIds.map(id => client.hGetAll(reviewDetailsKeyById(id))))
        
        successResponse({ res: res, data: reviews })
    } catch (error) {
        next(error)
    }
})

routes.delete("/:restaurantId/reviews/:reviewId", [checkRestaurantExists], async (req: Request<{ restaurantId: string, reviewId: string }>, res: any, next: any) => {
    const { restaurantId, reviewId } = req.params
    try {
        const client = await initializeRedisClient()
        const reviewKey = reviewKeyById(restaurantId)
        const reviewDetailsKey = reviewDetailsKeyById(reviewId)
        const [removeResult, deleteResult] = await Promise.all([
            client.lRem(reviewKey, 0, reviewId),
            client.del(reviewDetailsKey)
        ])

        if ( removeResult === 0 && deleteResult === 0 ) {
            errorResponse({ res: res, status: 404, error: "Review not found" })
        } else {
            successResponse({ res: res, data: reviewId, message: "Review deleted" })
        }
    } catch (error) {
        next(error)
    }
})

export default routes