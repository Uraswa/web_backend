import mailService from "./Core/Services/mailService.js";
import dotenv from "dotenv"
dotenv.config();
await mailService.sendActivationMail("test@gmail.com", "http://" + process.env.API_URL + "/activation/" + "link")