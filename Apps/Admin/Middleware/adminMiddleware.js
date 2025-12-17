import BasicUserModel from "../../../Core/Model/BasicUserModel.js";

const userModel = new BasicUserModel();

// Проверяет, что пользователь авторизован и является администратором
export default async function adminMiddleware(req, res, next) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Требуется авторизация"
            });
        }

        const dbUser = await userModel.getUserById(user.user_id);
        if (!dbUser || !dbUser.is_admin) {
            return res.status(403).json({
                success: false,
                error: "Недостаточно прав"
            });
        }

        next();
    } catch (e) {
        return res.status(500).json({
            success: false,
            error: "Неизвестная ошибка"
        });
    }
}
