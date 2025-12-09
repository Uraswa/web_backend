import dotenv from "dotenv"
import authRoutes from "./Apps/Auth/router.js";
import clientRoutes from "./Apps/Client/router.js";

dotenv.config();

import express from 'express'
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express()
app.use(express.json())
app.use(cookieParser());
// app.use(cors({
//     origin: "http://localhost:9000",
//     credentials: true, // разрешаем куки и авторизационные заголовки
//     allowedHeaders: ['Content-Type', 'Authorization']
// }))

const router = express.Router()
app.use(router);
app.disable('etag');


authRoutes(router)
clientRoutes(router)


app.listen(8000, () => {
    console.log("started server")
})