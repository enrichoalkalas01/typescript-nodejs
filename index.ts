import express from 'express'

import { errorHandler } from './middlewares/errorHandler.js'

import restaurantsRoutes from "./routes/restaurants.js"
import cuisinesRoutes from "./routes/cuisines.js"

const PORT = process.env.PORT || 5800
const app = express()

app.use(express.json())

app.use("/restaurants", restaurantsRoutes)
app.use("/cuisines", cuisinesRoutes)

app.use(errorHandler)

app.listen(PORT, () => { console.log(`Server is running in port ${PORT}`)})
.on("error", (error) => {
    throw new Error(error.message)
})

