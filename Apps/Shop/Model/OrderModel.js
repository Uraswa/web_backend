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
            opp.address AS opp_address,
            p.product_id,
            p.name AS product_name,
            op.ordered_count
        FROM order_products op
        JOIN products p ON op.product_id = p.product_id
        JOIN orders o ON op.order_id = o.order_id
        LEFT JOIN opp ON o.opp_id = opp.opp_id
        WHERE p.shop_id = $1
        ORDER BY o.created_date DESC
    `;
    const result = await Database.query(query, [shopId]);
    return result.rows;
}
}

export default new OrderModel();