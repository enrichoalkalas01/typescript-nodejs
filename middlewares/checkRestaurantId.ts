import type { Request, Response, NextFunction } from "express"

import { initializeRedisClient } from "../utils/client.js"
import { restaurantKeyById } from "../utils/keys.js"
import { errorResponse } from "../utils/responses.js"

export const checkRestaurantExists = async (req: Request, res: Response, next: NextFunction) => {
    const { restaurantId } = req.params
    
    if ( !restaurantId ) {
        errorResponse({ res: res, status: 400, error: "Restaurant ID not found"})
    } else {
        const client = await initializeRedisClient()
        const restaurantKey = restaurantKeyById(restaurantId)
        const exists = await client.exists(restaurantKey)
        
        if ( !exists ) {
            errorResponse({ res: res, status: 404, error: "Restaurant not found"})
        } else {
            next()
        }
    }
}