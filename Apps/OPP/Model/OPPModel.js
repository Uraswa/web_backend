// Apps/OPP/Model/OPPModel.js

import BasicOrderModel from '../../../Core/Model/BasicOrderModel.js';
import { Database } from '../../../Core/Model/Database.js';

class OPPModel extends BasicOrderModel {

    /**
     * Получить ПВЗ по ID владельца
     */
    async getOPPByOwnerId(owner_id) {
        const query = `SELECT * FROM opp WHERE owner_id = $1`;
        const result = await Database.query(query, [owner_id]);
        return result.rows[0] || null;
    }

    /**
     * Получить все заказы ПВЗ с деталями
     * Возвращает список заказов с информацией о получателе, статусе, сумме
     */
    async getOrdersWithDetails(opp_id) {
        const query = `
            SELECT 
                o.order_id,
                o.order_type,
                o.created_date,
                o.received_date,
                up.first_name,
                up.last_name,
                os.status as current_status,
                os.date as status_date,
                COUNT(op.product_id) as products_count,
                COALESCE(SUM(op.ordered_count * op.price), 0) as total_amount
            FROM orders o
            JOIN user_profiles up ON o.receiver_id = up.user_id
            LEFT JOIN (
                SELECT DISTINCT ON (order_id) order_id, status, date
                FROM order_statuses
                ORDER BY order_id, date DESC
            ) os ON o.order_id = os.order_id
            LEFT JOIN order_products op ON o.order_id = op.order_id
            WHERE o.opp_id = $1
            GROUP BY o.order_id, o.order_type, o.created_date, o.received_date,
                     up.first_name, up.last_name, os.status, os.date
            ORDER BY o.created_date DESC
        `;

        const result = await Database.query(query, [opp_id]);
        return result.rows;
    }

    /**
     * Выдать заказ клиенту (сменить статус на done)
     * - Проверяет что заказ в статусе waiting
     * - Меняет статус на done
     * - Записывает received_date
     * - Сохраняет ID выдавшего в data
     */
    async issueOrder(order_id, issued_by_user_id) {
        const client = await Database.GetMasterClient();
        try {
            await client.query('BEGIN');

            // Проверяем текущий статус заказа
            const statusCheck = `
                SELECT status
                FROM order_statuses
                WHERE order_id = $1
                ORDER BY date DESC
                LIMIT 1
            `;
            const statusResult = await client.query(statusCheck, [order_id]);

            if (!statusResult.rows[0]) {
                throw new Error('Заказ не найден');
            }

            const currentStatus = statusResult.rows[0].status;

            // Можно выдать только заказ в статусе waiting
            if (currentStatus !== 'waiting') {
                throw new Error(`Нельзя выдать заказ со статусом "${currentStatus}". Заказ должен быть в статусе "waiting"`);
            }

            // Обновляем статус на done и сохраняем кто выдал
            const updateStatusQuery = `
                UPDATE order_statuses
                SET status = 'done',
                    date = NOW(),
                    data = jsonb_build_object('issued_by', $2::integer)
                WHERE order_id = $1
                RETURNING *
            `;
            await client.query(updateStatusQuery, [order_id, issued_by_user_id]);

            // Обновляем received_date в таблице orders
            const updateOrderQuery = `
                UPDATE orders 
                SET received_date = NOW() 
                WHERE order_id = $1
                RETURNING *
            `;
            const result = await client.query(updateOrderQuery, [order_id]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

export default new OPPModel();