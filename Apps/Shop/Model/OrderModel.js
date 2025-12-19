import BasicOrderModel from "../../../Core/Model/BasicOrderModel.js";
import { Database } from "../../../Core/Model/Database.js";

class OrderModel extends BasicOrderModel {
    constructor() {
        super();
    }

    // Страница списка заказов, в которых есть товары данного продавца и инфой в какой ПВЗ отнести
    async getOrdersByShop(shopId) {
        const query = `
            SELECT o.order_id,
                   o.order_type,
                   o.receiver_id,
                   o.opp_id,
                   o.created_date,
                   o.received_date,
                   opp.address AS opp_address,
                   opp.latitude AS opp_latitude,
                   opp.longitude AS opp_longitude,
                   json_agg(json_build_object(
                       'product_id', p.product_id,
                       'name', p.name,
                       'price', op.price,
                       'ordered_count', op.ordered_count
                   )) AS products
            FROM ${this.orderProductsTable} op
            JOIN products p ON op.product_id = p.product_id
            JOIN ${this.tableName} o ON op.order_id = o.order_id
            LEFT JOIN opp ON o.opp_id = opp.opp_id
            WHERE p.shop_id = $1
            GROUP BY o.order_id, opp.opp_id
            ORDER BY o.created_date DESC
        `;
        const result = await Database.query(query, [shopId]);
        return result.rows;
    }
}

export default new OrderModel();
