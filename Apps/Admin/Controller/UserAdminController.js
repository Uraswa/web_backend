import UserAdminModel from "../Model/UserAdminModel.js";

class UserAdminController {
    
    // Список активных пользователей для выбора продавца (поиск по email/имени)
    async listActiveUsers(req, res) {
        try {
            const { search } = req.query;
            const users = await UserAdminModel.findActiveUsers(search);

            return res.status(200).json({
                success: true,
                data: users
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при получении пользователей"
            });
        }
    }
}

export default new UserAdminController();
