// Apps/OPP/Model/OPPModel.js

import { Database } from '../../../Core/Model/Database.js';
import OrdersService from '../../../Core/Services/ordersService.js';

class OPPModel {

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
     * Использует новую систему order_product_statuses для отображения статусов товаров
     */
    async getOrdersWithDetails(opp_id) {
        try {
            // Получаем все заказы для данного ПВЗ
            const query = `
                SELECT
                    o.order_id,
                    o.order_type,
                    o.created_date,
                    o.received_date,
                    o.receiver_id,
                    up.first_name,
                    up.last_name,
                    os.status as order_status,
                    os.date as status_date
                FROM orders o
                JOIN user_profiles up ON o.receiver_id = up.user_id
                LEFT JOIN (
                    SELECT DISTINCT ON (order_id) order_id, status, date
                    FROM order_statuses
                    ORDER BY order_id, date DESC
                ) os ON o.order_id = os.order_id
                WHERE o.opp_id = $1
                ORDER BY o.created_date DESC
            `;

            const ordersResult = await Database.query(query, [opp_id]);
            const orders = [];

            // Для каждого заказа получаем детали товаров и их статусы
            for (const orderRow of ordersResult.rows) {
                const orderWithDetails = await OrdersService.getOrderWithDetails(orderRow.order_id);

                if (orderWithDetails) {
                    // Вычисляем сводную информацию по статусам товаров
                    let totalProductsCount = 0;
                    let productsInTargetOpp = 0;
                    let totalAmount = 0;

                    for (const product of orderWithDetails.products) {
                        totalProductsCount += product.ordered_count;
                        totalAmount += parseFloat(product.price) * product.ordered_count;

                        // Проверяем сколько товара в целевом ПВЗ (готово к выдаче)
                        if (product.status_info && product.status_info.current_distribution) {
                            const dist = product.status_info.current_distribution;
                            productsInTargetOpp += (dist.by_opp && dist.by_opp[opp_id]) || 0;
                        }
                    }

                    orders.push({
                        order_id: orderRow.order_id,
                        order_type: orderRow.order_type,
                        created_date: orderRow.created_date,
                        received_date: orderRow.received_date,
                        first_name: orderRow.first_name,
                        last_name: orderRow.last_name,
                        order_status: orderRow.order_status,
                        status_date: orderRow.status_date,
                        products_count: totalProductsCount,
                        products_in_target_opp: productsInTargetOpp,
                        total_amount: totalAmount.toFixed(2),
                        can_be_issued: productsInTargetOpp > 0 && orderRow.order_status !== 'completed'
                    });
                }
            }

            return orders;

        } catch (error) {
            console.error('Ошибка в getOrdersWithDetails:', error);
            throw error;
        }
    }

    /**
     * Выдать заказ клиенту
     * Использует OrdersService.deliverOrder() для работы с order_product_statuses
     */
    async issueOrder(order_id, opp_id, issued_by_user_id) {
        try {
            // Вызываем метод deliverOrder из OrdersService
            // Он автоматически:
            // 1. Проверяет что товары в целевом ПВЗ
            // 2. Создает статусы 'delivered' для всех товаров
            // 3. Устанавливает order_status = 'completed' если все товары выданы
            const result = await OrdersService.deliverOrder(order_id, opp_id);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Дополнительно записываем кто выдал заказ в order_statuses
            const client = await Database.GetMasterClient();
            try {
                await client.query('BEGIN');

                // Обновляем order_statuses с информацией о том, кто выдал
                const existingStatus = await client.query(
                    `SELECT * FROM order_statuses
                     WHERE order_id = $1 AND status = 'completed'
                     ORDER BY date DESC LIMIT 1`,
                    [order_id]
                );

                if (existingStatus.rows.length > 0) {
                    // Обновляем существующий статус completed
                    await client.query(
                        `UPDATE order_statuses
                         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{issued_by}', $2::text::jsonb)
                         WHERE order_id = $1 AND status = 'completed'`,
                        [order_id, issued_by_user_id.toString()]
                    );
                }

                // Обновляем received_date в таблице orders
                await client.query(
                    `UPDATE orders
                     SET received_date = NOW()
                     WHERE order_id = $1 AND received_date IS NULL`,
                    [order_id]
                );

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

            return result;

        } catch (error) {
            console.error('Ошибка в issueOrder:', error);
            throw error;
        }
    }
}

export default new OPPModel();
