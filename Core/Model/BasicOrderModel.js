import { Database } from './Database.js';

export default  class BasicOrderModel {
    constructor() {
        this.tableName = 'orders';
        this.orderProductsTable = 'order_products';
        this.orderStatusesTable = 'order_statuses';
    }

    async findById(orderId) {
        const query = `
            SELECT o.*, 
                   up.first_name, up.last_name,
                   opp.address, opp.latitude, opp.longitude,
                   os.status as current_status
            FROM ${this.tableName} o
            JOIN user_profiles up ON o.receiver_id = up.user_id
            JOIN opp ON o.opp_id = opp.opp_id
            LEFT JOIN (
                SELECT DISTINCT ON (order_id) order_id, status
                FROM order_statuses
                ORDER BY order_id, date DESC
            ) os ON o.order_id = os.order_id
            WHERE o.order_id = $1
        `;
        const result = await Database.query(query, [orderId]);
        return result.rows[0] || null;
    }

    async findByUserId(userId) {
        const query = `
            SELECT o.*, 
                   opp.address,
                   os.status as current_status
            FROM ${this.tableName} o
            JOIN opp ON o.opp_id = opp.opp_id
            LEFT JOIN (
                SELECT DISTINCT ON (order_id) order_id, status
                FROM order_statuses
                ORDER BY order_id, date DESC
            ) os ON o.order_id = os.order_id
            WHERE o.receiver_id = $1
            ORDER BY o.created_date DESC
        `;
        const result = await Database.query(query, [userId]);
        return result.rows;
    }

    async findByOppId(oppId) {
        const query = `
            SELECT o.*,
                   up.first_name, up.last_name,
                   os.status as current_status
            FROM ${this.tableName} o
            JOIN user_profiles up ON o.receiver_id = up.user_id
            LEFT JOIN (
                SELECT DISTINCT ON (order_id) order_id, status
                FROM order_statuses
                ORDER BY order_id, date DESC
            ) os ON o.order_id = os.order_id
            WHERE o.opp_id = $1
            ORDER BY o.created_date DESC
        `;
        const result = await Database.query(query, [oppId]);
        return result.rows;
    }

    async getOrderProducts(orderId) {
        const query = `
            SELECT op.*, p.name, p.photos, (
                SELECT SUM(ops.count) 
                FROM order_product_statuses ops 
                WHERE ops.order_id = op.order_id
                  and ops.product_id = p.product_id 
                  and ops.order_product_status = 'refunded'
            ) as returned_count, p.shop_id
            FROM order_products op
            JOIN products p ON op.product_id = p.product_id
            WHERE op.order_id = $1
        `;
        const result = await Database.query(query, [orderId]);
        return result.rows;
    }

    async getOrderStatusHistory(orderId) {
        const query = `
            SELECT * FROM ${this.orderStatusesTable} 
            WHERE order_id = $1 
            ORDER BY date DESC
        `;
        const result = await Database.query(query, [orderId]);
        return result.rows;
    }


    async calculateTotal(orderId) {
        const query = `
            SELECT SUM(ordered_count * price) as total
            FROM ${this.orderProductsTable}
            WHERE order_id = $1
        `;
        const result = await Database.query(query, [orderId]);
        return result.rows[0].total || 0;
    }
}
