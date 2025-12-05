import tokenService  from "../Services/tokenService.js";
export default function (req, res, next) {
    try {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            next();
            return;
        }

        const accessToken = authorizationHeader.split(' ')[1];
        if (!accessToken) {
            next();
            return;
        }

        const userData = tokenService.validateAccessToken(accessToken);
        if (!userData) {
            next();
            return;
        }

        console.log("USER AUTHORIZED")
        return res.status(400).json({
            success: false,
            error: "Пользователь авторизован"
        })
    } catch (e) {
        return res.status(500).json({
            success: false,
            error: "Неизвестная ошибка"
        })
    }

};