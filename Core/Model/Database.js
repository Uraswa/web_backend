import PoolWrapper from "../Db/PoolWrapper.js";
import dotenv from "dotenv"
dotenv.config();

const Database = new PoolWrapper({
    ports: [5432],
    base: {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD
    }
})

export {
   Database
}