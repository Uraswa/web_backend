// Core/Middleware/oppOwnerMiddleware.js

import { Database } from "../Model/Database.js";

/**
 * Middleware для проверки что пользователь является владельцем ПВЗ
 * Добавляет req.user_opp с информацией о ПВЗ
 */
export const requireOPPOwner = async (req, res, next) => {
    try {
        const user_id = req.user.user_id;

        // Проверяем что у пользователя есть ПВЗ
        const query = `SELECT opp_id, address FROM opp WHERE owner_id = $1`;
        const result = await Database.query(query, [user_id]);

        if (!result.rows || result.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'У вас нет ПВЗ или вы не являетесь владельцем'
            });
        }

        // Сохраняем информацию о ПВЗ в req для использования в контроллере
        req.user_opp = result.rows[0];

        next();
    } catch (e) {
        console.error('Error in requireOPPOwner:', e);
        return res.status(500).json({
            success: false,
            error: "Ошибка проверки прав доступа"
        });
    }
};

/**
 * Middleware для проверки что заказ принадлежит ПВЗ владельца
 * Используется при изменении конкретного заказа
 */
export const requireOrderOwner = async (req, res, next) => {
    try {
        const user_id = req.user.user_id;
        const order_id = req.params.id;

        // Проверяем что заказ находится в ПВЗ этого владельца
        const query = `
            SELECT o.order_id 
            FROM orders o
            JOIN opp ON o.opp_id = opp.opp_id
            WHERE o.order_id = $1 AND opp.owner_id = $2
        `;
        const result = await Database.query(query, [order_id, user_id]);

        if (!result.rows || result.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Заказ не найден или не принадлежит вашему ПВЗ'
            });
        }

        next();
    } catch (e) {
        console.error('Error in requireOrderOwner:', e);
        return res.status(500).json({
            success: false,
            error: "Ошибка проверки прав доступа"
        });
    }
};