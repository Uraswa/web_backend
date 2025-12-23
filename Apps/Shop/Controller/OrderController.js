import OrderModel from "../Model/OrderModel.js";
import ordersService from "../../../Core/Services/ordersService.js";

class OrderController {
    // Список заказов продавца с ПВЗ и товарами
    async listByShop(req, res) {
        try {
            const shopId = parseInt(req.params.shopId);
            const orders = await OrderModel.getOrdersByShop(shopId);

            let ordersResult = [];

            for (let order of orders) {

                let products = await OrderModel.getOrderProducts(order.order_id);
                let orderProducts = [];

                let su = 0;

                let hasUngivenProducts = false;
                for (let prod of products) {
                    if (prod.shop_id != shopId) continue;
                    if (!hasUngivenProducts) {
                        let statuses = await ordersService.getProductStatuses(prod.product_id, order.order_id);
                        if (statuses.success && statuses.data.current_distribution.waiting_for_product_arrival_in_opp > 0) {
                            hasUngivenProducts = true;
                        }
                    }
                    orderProducts.push(prod);
                    su += prod.ordered_count * Number.parseFloat(prod.price)
                }

                if (!hasUngivenProducts) continue

                order.products = orderProducts;
                order.total = su;
                ordersResult.push(order);

            }

            res.json(ordersResult);
        } catch (err) {
            console.error(err);
            res.status(500).json({error: 'Ошибка получения заказов'});
        }
    }

    async getSellerOrderDetails(req, res) {
        try {
            const ownerId = Number.parseInt(req.user?.user_id, 10);
            if (!Number.isFinite(ownerId)) {
                return res.status(401).json({success: false, error: 'unauthorized'});
            }

            const orderId = Number.parseInt(req.params.orderId, 10);
            if (!Number.isFinite(orderId)) {
                return res.status(400).json({success: false, error: 'invalid_order_id'});
            }

            const rows = await OrderModel.getSellerOrderDetails(orderId, ownerId);
            if (!rows || rows.length === 0) {
                return res.status(404).json({success: false, error: 'order_not_found'});
            }

            const first = rows[0];
            const items = rows.map((row) => ({
                shop_id: row.shop_id,
                shop_name: row.shop_name,
                product_id: row.product_id,
                product_name: row.product_name,
                product_photos: row.product_photos,
                ordered_count: row.ordered_count,
                price: row.price,
                opp_received_count: row.opp_received_count,
            }));

            const total = items.reduce((sum, item) => sum + Number(item.ordered_count) * Number(item.price), 0);

            return res.status(200).json({
                success: true,
                data: {
                    order: {
                        order_id: first.order_id,
                        created_date: first.created_date,
                        opp_id: first.opp_id,
                        opp_address: first.opp_address,
                        opp_work_time: first.opp_work_time,
                        current_status: first.current_status,
                        receiver_first_name: first.receiver_first_name,
                        receiver_last_name: first.receiver_last_name,
                    },
                    items,
                    total: Number.isFinite(total) ? total.toFixed(2) : "0.00",
                }
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({success: false, error: 'Ошибка получения деталей заказа'});
        }
    }
}

export default new OrderController();
