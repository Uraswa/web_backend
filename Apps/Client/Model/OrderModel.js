import BasicOrderModel from "../../../Core/Model/BasicOrderModel.js";
import { Database } from "../../../Core/Model/Database.js";

class OrderModel extends BasicOrderModel {
    constructor() {
        super();
    }

    async createFromCart(userId, oppId, cartItems) {
        const client = await Database.GetMasterClient();
        try {
            await client.query('BEGIN');

            // Создаем заказ
            const orderQuery = `
                INSERT INTO ${this.tableName} (receiver_id, opp_id, order_type)
                VALUES ($1, $2, 'client')
                RETURNING *
            `;
            const orderResult = await client.query(orderQuery, [userId, oppId]);
            const order = orderResult.rows[0];

            // Добавляем товары из корзины
            for (const item of cartItems) {
                const productQuery = `
                    INSERT INTO ${this.orderProductsTable} 
                    (order_id, product_id, ordered_count, price)
                    VALUES ($1, $2, $3, $4)
                `;
                await client.query(productQuery, [
                    order.order_id,
                    item.product_id,
                    item.quantity,
                    item.price
                ]);
            }

            // Добавляем начальный статус
            const statusQuery = `
                INSERT INTO ${this.orderStatusesTable} (order_id, status)
                VALUES ($1, 'packing')
            `;
            await client.query(statusQuery, [order.order_id]);

            await client.query('COMMIT');
            return await this.findById(order.order_id);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getOrderSummary(orderId) {
        const order = await this.findById(orderId);
        if (!order) return null;

        const products = await this.getOrderProducts(orderId);
        const total = await this.calculateTotal(orderId);

        return {
            ...order,
            products,
            total
        };
    }
}

export default new OrderModel();