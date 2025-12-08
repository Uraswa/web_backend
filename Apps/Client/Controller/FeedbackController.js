import FeedbackModel from "../Model/FeedbackModel.js";

class FeedbackController {

    // Добавление отзыва
    async addFeedback(req, res) {
        try {
            const user = req.user;
            const { productId } = req.params;
            const { rate, good_text, bad_text, comment } = req.body;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            if (!rate || rate < 1 || rate > 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Рейтинг должен быть от 1 до 5'
                });
            }

            // Проверяем, не оставлял ли уже пользователь отзыв
            const existingFeedback = await FeedbackModel.findByUserAndProduct(user.user_id, productId);

            let feedback;
            if (existingFeedback) {
                // Обновляем существующий отзыв
                feedback = await FeedbackModel.update(user.user_id, productId, {
                    rate,
                    good_text,
                    bad_text,
                    comment
                });
            } else {
                // Создаем новый отзыв
                feedback = await FeedbackModel.create(user.user_id, productId, {
                    rate,
                    good_text,
                    bad_text,
                    comment
                });
            }

            return res.status(200).json({
                success: true,
                data: feedback
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при добавлении отзыва'
            });
        }
    }

    // Удаление отзыва
    async deleteFeedback(req, res) {
        try {
            const user = req.user;
            const { productId } = req.params;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const deleted = await FeedbackModel.delete(user.user_id, productId);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Отзыв не найден'
                });
            }

            return res.status(200).json({
                success: true,
                data: { message: 'Отзыв удален' }
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при удалении отзыва'
            });
        }
    }

    // Получение отзывов пользователя
    async getUserFeedback(req, res) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Требуется авторизация'
                });
            }

            const feedback = await FeedbackModel.findByUserId(user.user_id);

            return res.status(200).json({
                success: true,
                data: feedback
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении отзывов'
            });
        }
    }
}

export default new FeedbackController();