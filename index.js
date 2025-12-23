import dotenv from "dotenv"
import authRoutes from "./Apps/Auth/router.js";
import clientRoutes from "./Apps/Client/router.js";
import adminRoutes from "./Apps/Admin/router.js";
import oppRoutes from "./Apps/OPP/router.js";
import shopRouter from "./Apps/Shop/router.js"

dotenv.config();

import express from 'express'
import cors from "cors";
import cookieParser from "cookie-parser";
import tokenService from "./Core/Services/tokenService.js";

const app = express()
app.disable('etag');

const corsOptions = {
    origin: [
        "http://localhost:9000",
        "http://127.0.0.1:9000",
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser());
app.use(cors({
    origin: [
        "http://localhost:9000",
        "http://127.0.0.1:9000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// console.log(tokenService.generateTokens({user_id: 1}, '999h', '9999h'))

const router = express.Router()
app.use(router);

authRoutes(router)
clientRoutes(router)
adminRoutes(router)
oppRoutes(router)
shopRouter(router)

let server = app.listen(8000, () => {
    console.log("started server")
})

export {
    app,
    server
}
