import dotenv from "dotenv"
import authRoutes from "./Apps/Auth/router.js";
import clientRoutes from "./Apps/Client/router.js";
import oppRoutes from "./Apps/OPP/router.js";

dotenv.config();

import express from 'express'
import cors from "cors";
import cookieParser from "cookie-parser";
import tokenService from "./Core/Services/tokenService.js";

const app = express()
app.use(express.json())
app.use(cookieParser());
// app.use(cors({
//     origin: "http://localhost:9000",
//     credentials: true, // разрешаем куки и авторизационные заголовки
//     allowedHeaders: ['Content-Type', 'Authorization']
// }))

//console.log(tokenService.generateTokens({user_id: 34395}, '999h', '9999h'))

const router = express.Router()
app.use(router);
app.disable('etag');


authRoutes(router)
clientRoutes(router)
oppRoutes(router)

let server = app.listen(8000, () => {
    console.log("started server")
})

export {
    app,
    server
}