import BasicOrderModel from "../../../Core/Model/BasicOrderModel.js";
import { Database } from "../../../Core/Model/Database.js";

class OrderModel extends BasicOrderModel {
    constructor() {
        super();
    }

    // Страница списка заказов, в которых есть товары данного продавца и инфой в какой ПВЗ отнести
    async getOrdersByShop(shopId) {
    const query = `
        SELECT 
            o.order_id,
            o.opp_id,
            o.created_date,
            opp.address AS opp_address,
            opp.work_time AS opp_work_time,
            os.status AS current_status,
            p.product_id,
            p.name AS product_name,
            p.photos AS product_photos,
            op.price,
            op.ordered_count
        FROM order_products op
        JOIN products p ON op.product_id = p.product_id
        JOIN orders o ON op.order_id = o.order_id
        LEFT JOIN opp ON o.opp_id = opp.opp_id
        LEFT JOIN (
            SELECT DISTINCT ON (order_id) order_id, status
            FROM order_statuses
            ORDER BY order_id, date DESC
        ) os ON o.order_id = os.order_id
        WHERE p.shop_id = $1
        ORDER BY o.created_date DESC
    `;
    const result = await Database.query(query, [shopId]);
    return result.rows;
}

    async hasOrderForOwner(orderId, ownerId) {
        const query = `
            SELECT 1
            FROM order_products op
            JOIN products p ON op.product_id = p.product_id
            JOIN shops s ON p.shop_id = s.shop_id
            WHERE op.order_id = $1 AND s.owner_id = $2
            LIMIT 1
        `;
        const result = await Database.query(query, [orderId, ownerId]);
        return result.rowCount > 0;
    }

    async getSellerOrderDetails(orderId, ownerId) {
        const query = `
            SELECT
                o.order_id,
                o.created_date,
                o.opp_id,
                opp.address AS opp_address,
                opp.work_time AS opp_work_time,
                os.status AS current_status,
                up.first_name AS receiver_first_name,
                up.last_name AS receiver_last_name,
                s.shop_id,
                s.name AS shop_name,
                p.product_id,
                p.name AS product_name,
                p.photos AS product_photos,
                op.ordered_count,
                op.price,
                op.opp_received_count
            FROM orders o
            JOIN order_products op ON o.order_id = op.order_id
            JOIN products p ON op.product_id = p.product_id
            JOIN shops s ON p.shop_id = s.shop_id
            JOIN user_profiles up ON o.receiver_id = up.user_id
            LEFT JOIN opp ON o.opp_id = opp.opp_id
            LEFT JOIN (
                SELECT DISTINCT ON (order_id) order_id, status
                FROM order_statuses
                ORDER BY order_id, date DESC
            ) os ON o.order_id = os.order_id
            WHERE o.order_id = $1 AND s.owner_id = $2
            ORDER BY s.shop_id, p.product_id
        `;
        const result = await Database.query(query, [orderId, ownerId]);
        return result.rows;
    }
}

export default new OrderModel();
