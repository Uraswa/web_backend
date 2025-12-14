import { Database } from "../Model/Database.js";
import OuterLogisticsService from "./OuterLogisticsService.js";
import {
    ArrivedInOppFromSellerDto,
    ArrivedInOppReturnOrderDto,
    SentToLogisticsReturnDto,
    DeliveredDto,
    RefundedDto,
    WaitingForProductArrivalDto
} from './order_product_statuses_dtos/index.js';

class OrdersService {

    /**
     * Получить статусы товара с количеством для каждого статуса
     * @param {number} productId - ID товара
     * @param {number} orderId - ID заказа (опционально)
     * @returns {Promise<Object>} Статусы с количеством
     */
    async getProductStatuses(productId, orderId = null) {
        try {
            let query = `
                SELECT
                    ops.order_product_status,
                    ops.count,
                    ops.date,
                    ops.data,
                    o.order_id,
                    o.opp_id as target_opp_id
                FROM order_product_statuses ops
                LEFT JOIN orders o ON ops.order_id = o.order_id
                WHERE ops.product_id = $1
            `;

            const params = [productId];

            if (orderId) {
                query += ` AND o.order_id = $2`;
                params.push(orderId);
            }

            query += ` ORDER BY ops.date ASC`;

            const result = await Database.query(query, params);

            // Группируем по статусам и суммируем количество
            const statusMap = {};

            for (const row of result.rows) {
                const status = row.order_product_status;

                if (!statusMap[status]) {
                    statusMap[status] = {
                        status: status,
                        total_count: 0,
                        entries: []
                    };
                }

                statusMap[status].total_count += row.count;
                statusMap[status].entries.push({
                    count: row.count,
                    date: row.date,
                    data: row.data,
                    order_id: row.order_id
                });
            }

            // Вычисляем текущее распределение товара
            const currentDistribution = this._calculateCurrentDistribution(result.rows);

            return {
                success: true,
                data: {
                    statuses: Object.values(statusMap),
                    current_distribution: currentDistribution,
                    history: result.rows
                }
            };

        } catch (error) {
            console.error('Ошибка в getProductStatuses:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Вычислить текущее распределение товара по статусам
     * @private
     * @param {Array} history - История статусов товара (отсортированная по дате)
     * @returns {Object} Текущее распределение товара
     */
    _calculateCurrentDistribution(history) {
        // Инициализация структуры результата
        const distribution = {
            waiting_for_product_arrival_in_opp: 0,
            at_start_opp: 0,         // вычисляемый: arrived_in_opp с is_start_opp: true
            at_target_opp: 0,        // вычисляемый: arrived_in_opp с is_target_opp: true,
            by_opp: {},
            sent_to_logistics: {},   // {logistics_order_id: count}
            sent_to_logistics_unvalid: {}, // товары, не принадлежащие своему логистическому заказу
            delivered: 0,
            refunded: 0
        };

        // Временная структура для отслеживания arrived_in_opp по opp_id
        const arrivedInopp = {}; // {opp_id: count}

        // Обрабатываем историю статусов в хронологическом порядке
        for (const record of history) {
            const status = record.order_product_status;
            const count = record.count;
            const data = record.data || {};

            switch (status) {
                case 'waiting_for_product_arrival_in_opp':
                    // Начальный статус - товар еще не поступил в ПВЗ
                    distribution.waiting_for_product_arrival_in_opp += count;
                    break;

                case 'arrived_in_opp':
                    const oppId = data.opp_id;

                    // Определяем, откуда пришел товар
                    if (data.from_logistics_order_id) {
                        // Товар пришел из логистики
                        const logisticsOrderId = data.from_logistics_order_id;

                        if (distribution.sent_to_logistics[logisticsOrderId] >= count) {
                            distribution.sent_to_logistics[logisticsOrderId] -= count;
                            if (distribution.sent_to_logistics[logisticsOrderId] === 0) {
                                delete distribution.sent_to_logistics[logisticsOrderId];
                            }
                        } else {
                            // Товар не принадлежит этому логистическому заказу (ошибка)
                            console.warn(`Товар из logistics_order_id ${logisticsOrderId} не найден в sent_to_logistics`);
                        }
                    } else if (data.from_seller) {
                        // Товар пришел от продавца
                        distribution.waiting_for_product_arrival_in_opp -= count;
                    }

                    // Добавляем товар в ПВЗ
                    if (oppId) {
                        arrivedInopp[oppId] = (arrivedInopp[oppId] || 0) + count;
                    }

                    // Определяем, это стартовый или целевой ПВЗ
                    if (data.is_start_opp) {
                        distribution.at_start_opp += count;
                    } else if (data.is_target_opp) {
                        distribution.at_target_opp += count;
                    }
                    break;

                case 'sent_to_logistics':
                    const logisticsOrderId = data.logistics_order_id;

                    // Товар уходит из arrived_in_opp
                    // Определяем, откуда убирать товар на основе метаданных или логики
                    if (data.from_opp_id) {
                        const fromoppId = data.from_opp_id;
                        if (arrivedInopp[fromoppId] >= count) {
                            arrivedInopp[fromoppId] -= count;
                        }

                        // Определяем, это был start или target opp
                        // Обычно товар отправляется из стартового ПВЗ к целевому
                        if (distribution.at_start_opp >= count) {
                            distribution.at_start_opp -= count;
                        } else if (distribution.at_target_opp >= count) {
                            distribution.at_target_opp -= count;
                        }
                    } else if (data.previous_logistics_order_id) {
                        // Это обратный заказ - товар уже в логистике, просто меняем его направление
                        const prevLogisticsId = data.previous_logistics_order_id;
                        if (distribution.sent_to_logistics[prevLogisticsId] >= count) {
                            distribution.sent_to_logistics[prevLogisticsId] -= count;
                            if (distribution.sent_to_logistics[prevLogisticsId] === 0) {
                                delete distribution.sent_to_logistics[prevLogisticsId];
                            }
                        } else if (distribution.sent_to_logistics_unvalid[prevLogisticsId] >= count){
                            distribution.sent_to_logistics_unvalid[prevLogisticsId] -= count;
                            if (distribution.sent_to_logistics_unvalid[prevLogisticsId] === 0) {
                                delete distribution.sent_to_logistics_unvalid[prevLogisticsId];
                            }
                        } else {
                            if (!distribution.sent_to_logistics_unvalid[prevLogisticsId]) {
                                distribution.sent_to_logistics_unvalid[prevLogisticsId] = 0;
                            }
                            distribution.sent_to_logistics_unvalid[prevLogisticsId] += count;
                        }
                    } else {
                        // По умолчанию товар отправляется из стартового ПВЗ
                        if (distribution.at_start_opp >= count) {
                            distribution.at_start_opp -= count;
                        } else if (distribution.at_target_opp >= count) {
                            distribution.at_target_opp -= count;
                        }
                    }

                    // Добавляем в логистику
                    if (logisticsOrderId) {
                        distribution.sent_to_logistics[logisticsOrderId] =
                            (distribution.sent_to_logistics[logisticsOrderId] || 0) + count;
                    } else {
                        console.warn('Отсутствует logistics_order_id для статуса sent_to_logistics');
                    }
                    break;

                case 'delivered':
                    // Товар выдан покупателю из целевого ПВЗ
                    distribution.at_target_opp -= count;
                    distribution.delivered += count;
                    break;

                case 'refunded':
                    // Товар возвращен
                    const fromStatus = data.from_status;

                    // Убираем товар из исходного статуса
                    if (fromStatus === 'waiting_for_product_arrival_in_opp') {
                        distribution.waiting_for_product_arrival_in_opp -= count;
                    } else if (fromStatus === 'at_start_opp') {
                        distribution.at_start_opp -= count;
                    } else if (fromStatus === 'at_target_opp') {
                        distribution.at_target_opp -= count;
                    } else if (fromStatus === 'sent_to_logistics') {
                        // Нужно найти и уменьшить соответствующий logistics_order_id
                        // Это сложнее, так как нужно знать конкретный logistics_order_id
                        if (data.from_logistics_order_id) {
                            const logisticsId = data.from_logistics_order_id;
                            if (distribution.sent_to_logistics[logisticsId] >= count) {
                                distribution.sent_to_logistics[logisticsId] -= count;
                                if (distribution.sent_to_logistics[logisticsId] === 0) {
                                    delete distribution.sent_to_logistics[logisticsId];
                                }
                            }
                        }
                    }

                    distribution.refunded += count;
                    break;

                default:
                    console.warn(`Неизвестный статус: ${status}`);
            }
        }

        distribution.by_opp = arrivedInopp;
        return distribution;
    }

    /**
     * Создание нового клиентского заказа
     * @param {number} receiverId - ID получателя
     * @param {number} targetOppId - ID целевого ПВЗ для доставки
     * @param {Array} products - Массив товаров [{product_id, count}]
     * @returns {Promise<Object>} Созданный заказ
     */
    async createOrder(receiverId, targetOppId, products) {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // 1. Проверяем доступность товаров
            for (const product of products) {
                const availabilityCheck = await client.query(
                    `SELECT product_id, count, price, name
                     FROM products
                     WHERE product_id = $1`,
                    [product.product_id]
                );

                if (availabilityCheck.rows.length === 0) {
                    throw new Error(`Товар ${product.product_id} не найден`);
                }

                const availableProduct = availabilityCheck.rows[0];

                if (availableProduct.count < product.count) {
                    throw new Error(
                        `Недостаточно товара "${availableProduct.name}". ` +
                        `Доступно: ${availableProduct.count}, требуется: ${product.count}`
                    );
                }
            }

            // 2. Резервируем товары (уменьшаем доступное количество)
            for (const product of products) {
                await client.query(
                    `UPDATE products
                     SET count = count - $1
                     WHERE product_id = $2`,
                    [product.count, product.product_id]
                );
            }

            // 3. Создаем клиентский заказ
            const orderResult = await client.query(
                `INSERT INTO orders (order_type, receiver_id, opp_id, created_date)
                 VALUES ('client', $1, $2, NOW())
                 RETURNING *`,
                [receiverId, targetOppId]
            );

            const order = orderResult.rows[0];

            // 4. Добавляем товары в заказ
            for (const product of products) {
                // Получаем актуальную цену товара
                const priceResult = await client.query(
                    `SELECT price
                     FROM products
                     WHERE product_id = $1`,
                    [product.product_id]
                );

                const price = priceResult.rows[0].price;

                await client.query(
                    `INSERT INTO order_products (order_id, product_id, ordered_count, price, opp_received_count)
                     VALUES ($1, $2, $3, $4, 0)`,
                    [order.order_id, product.product_id, product.count, price]
                );

                // 5. Создаем начальный статус для товара: waiting_for_product_arrival_in_opp
                await client.query(
                    `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                     VALUES ($1, $2, 'waiting_for_product_arrival_in_opp', $3, NOW(), $4)`,
                    [
                        order.order_id,
                        product.product_id,
                        product.count,
                        JSON.stringify(new WaitingForProductArrivalDto(order.order_id))
                    ]
                );
            }

            await client.query('COMMIT');

            // Возвращаем созданный заказ с деталями
            return await this.getOrderWithDetails(order.order_id);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка при создании заказа:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Получить заказ с полной информацией
     * @param {number} orderId - ID заказа
     * @returns {Promise<Object>} Детали заказа
     */
    async getOrderWithDetails(orderId) {
        try {
            // 1. Получаем основную информацию о заказе
            const orderResult = await Database.query(
                `SELECT o.*,
                        up.first_name,
                        up.last_name,
                        opp.address,
                        opp.latitude,
                        opp.longitude
                 FROM orders o
                 JOIN user_profiles up ON o.receiver_id = up.user_id
                 JOIN opp ON o.opp_id = opp.opp_id
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                return null;
            }

            const order = orderResult.rows[0];

            // 2. Получаем товары заказа
            const productsResult = await Database.query(
                `SELECT op.*, 
                        p.name, 
                        p.photos, 
                        p.description,
                        p.shop_id,
                        s.name as shop_name,
                        s.owner_id as seller_id
                 FROM order_products op
                 JOIN products p ON op.product_id = p.product_id
                 JOIN shops s ON p.shop_id = s.shop_id
                 WHERE op.order_id = $1`,
                [orderId]
            );

            order.products = productsResult.rows;

            // Для каждого товара получаем его текущие статусы
            for (const product of order.products) {
                const statusInfo = await this.getProductStatuses(product.product_id, orderId);
                product.status_info = statusInfo.data;
            }

            // 3. Вычисляем общую стоимость
            order.total = productsResult.rows.reduce(
                (sum, product) => sum + parseFloat(product.price) * product.ordered_count,
                0
            ).toFixed(2);

            return order;

        } catch (error) {
            console.error('Ошибка в getOrderWithDetails:', error);
            throw error;
        }
    }

    /**
     * Отменить заказ (полный возврат)
     * @param {number} orderId - ID заказа
     * @param {string} reason - Причина отмены
     * @returns {Promise<Object>} Результат операции
     */
    async cancelOrder(orderId, reason = 'Отменен пользователем') {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // 1. Получаем заказ с товарами и информацией о продавцах
            const orderResult = await client.query(
                `SELECT o.*,
                        op.product_id,
                        op.ordered_count,
                        op.price,
                        p.name as product_name,
                        s.owner_id as seller_id,
                        s.shop_id
                 FROM orders o
                 JOIN order_products op ON o.order_id = op.order_id
                 JOIN products p ON op.product_id = p.product_id
                 JOIN shops s ON p.shop_id = s.shop_id
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            const order = orderResult.rows[0];
            const targetOppId = order.opp_id;

            // 2. Собираем информацию о товарах и группируем по продавцам
            const productsBySeller = new Map(); // seller_id -> [{product_id, count, distribution, ...}]

            for (const row of orderResult.rows) {
                // Получаем текущее распределение статусов товара
                const statusInfo = await this.getProductStatuses(row.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                // Обрабатываем товары в статусе waiting_for_product_arrival_in_opp - возвращаем на склад
                if (distribution.waiting_for_product_arrival_in_opp > 0) {
                    await this._unreserveProduct(
                        client,
                        row.product_id,
                        distribution.waiting_for_product_arrival_in_opp
                    );

                    // Записываем статус refunded
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                        [
                            orderId,
                            row.product_id,
                            distribution.waiting_for_product_arrival_in_opp,
                            JSON.stringify(new RefundedDto(
                                reason,
                                'waiting_for_product_arrival_in_opp',
                                { returnedToStock: true }
                            ))
                        ]
                    );
                }

                // Для остальных товаров (at_start_opp, at_target_opp, sent_to_logistics) создаем обратные заказы
                // Суммируем количество товаров в логистике
                const sentToLogisticsTotal = Object.values(distribution.sent_to_logistics).reduce((sum, count) => sum + count, 0);
                const returnableCount = distribution.at_start_opp + distribution.at_target_opp + sentToLogisticsTotal;

                if (returnableCount > 0) {
                    if (!productsBySeller.has(row.seller_id)) {
                        productsBySeller.set(row.seller_id, []);
                    }

                    productsBySeller.get(row.seller_id).push({
                        product_id: row.product_id,
                        product_name: row.product_name,
                        count: returnableCount,
                        price: row.price,
                        distribution: distribution
                    });
                }
            }

            // 3. Создаем обратные заказы для каждого продавца
            const returnOrders = [];

            for (const [sellerId, products] of productsBySeller.entries()) {

                // Создаем заказ типа 'client' для продавца (сумма = 0)
                const returnOrderResult = await client.query(
                    `INSERT INTO orders (order_type, receiver_id, opp_id, created_date)
                     VALUES ('client', $1, $2, NOW())
                     RETURNING *`,
                    [sellerId, targetOppId]
                );

                const returnOrder = returnOrderResult.rows[0];

                // Добавляем товары в обратный заказ
                for (const product of products) {

                    const statusInfo = await this.getProductStatuses(product.product_id, orderId);
                    const distribution = statusInfo.data.current_distribution;

                    await client.query(
                        `INSERT INTO order_products (order_id, product_id, ordered_count, price, opp_received_count)
                         VALUES ($1, $2, $3, 0, 0)`,
                        [returnOrder.order_id, product.product_id, product.count]
                    );

                    // Для товаров в at_target_opp: создаем статус arrived_in_opp с is_start_opp: true
                    // (для обратного пути целевой ПВЗ покупателя становится стартовым ПВЗ)
                    if (distribution.at_target_opp > 0) {
                        await client.query(
                            `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                             VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                            [
                                returnOrder.order_id,
                                product.product_id,
                                distribution.at_target_opp,
                                JSON.stringify(new ArrivedInOppReturnOrderDto(
                                    targetOppId,
                                    true,  // is_start_opp
                                    false, // is_target_opp
                                    orderId
                                ))
                            ]
                        );
                    }

                    // Для товаров в at_start_opp: создаем статус arrived_in_opp с is_target_opp: true
                    // (для продавца исходный ПВЗ становится целевым ПВЗ для возврата)
                    if (distribution.at_start_opp > 0) {
                        await client.query(
                            `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                             VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                            [
                                returnOrder.order_id,
                                product.product_id,
                                distribution.at_start_opp,
                                JSON.stringify(new ArrivedInOppReturnOrderDto(
                                    null,  // opp_id - TODO: нужно получить ID исходного ПВЗ из истории статусов
                                    false, // is_start_opp
                                    true,  // is_target_opp
                                    orderId
                                ))
                            ]
                        );
                    }

                    // Для товаров в sent_to_logistics: создаем статусы для каждого logistics_order_id
                    for (const [logisticsOrderId, count] of Object.entries(distribution.sent_to_logistics)) {
                        if (count > 0) {
                            await client.query(
                                `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                                 VALUES ($1, $2, 'sent_to_logistics', $3, NOW(), $4)`,
                                [
                                    returnOrder.order_id,
                                    product.product_id,
                                    count,
                                    JSON.stringify(new SentToLogisticsReturnDto(
                                        parseInt(logisticsOrderId),
                                        orderId
                                    ))
                                ]
                            );
                        }
                    }
                }

                returnOrders.push({
                    order_id: returnOrder.order_id,
                    receiver_id: sellerId,
                    opp_id: targetOppId,
                    original_order_id: orderId
                });
            }

            // 4. Планируем доставку для обратных заказов
            if (returnOrders.length > 0) {
                const planResult = await OuterLogisticsService.planOrderDelivery(returnOrders);
                if (!planResult.success) {
                    throw new Error(`Ошибка при планировании доставки: ${planResult.error}`);
                }
            }

            // 5. Записываем статусы refunded для всех возвращаемых товаров
            for (const row of orderResult.rows) {
                const statusInfo = await this.getProductStatuses(row.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                // at_start_opp
                if (distribution.at_start_opp > 0) {
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                        [
                            orderId,
                            row.product_id,
                            distribution.at_start_opp,
                            JSON.stringify(new RefundedDto(
                                reason,
                                'at_start_opp',
                                { returnOrderCreated: true }
                            ))
                        ]
                    );
                }

                // at_target_opp
                if (distribution.at_target_opp > 0) {
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                        [
                            orderId,
                            row.product_id,
                            distribution.at_target_opp,
                            JSON.stringify(new RefundedDto(
                                reason,
                                'at_target_opp',
                                { returnOrderCreated: true }
                            ))
                        ]
                    );
                }

                // sent_to_logistics - обрабатываем каждый logistics_order_id отдельно
                for (const [logisticsOrderId, count] of Object.entries(distribution.sent_to_logistics)) {
                    if (count > 0) {
                        await client.query(
                            `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                             VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                            [
                                orderId,
                                row.product_id,
                                count,
                                JSON.stringify(new RefundedDto(
                                    reason,
                                    'sent_to_logistics',
                                    {
                                        returnOrderCreated: true,
                                        fromLogisticsOrderId: parseInt(logisticsOrderId)
                                    }
                                ))
                            ]
                        );
                    }
                }
            }

            // 6. Меняем статус заказа на canceled
            await client.query(
                `INSERT INTO order_statuses (order_id, status, data, date)
                 VALUES ($1, 'canceled', $2, NOW())`,
                [
                    orderId,
                    JSON.stringify({
                        reason,
                        canceled_at: new Date().toISOString(),
                        return_orders: returnOrders.map(o => o.order_id)
                    })
                ]
            );

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    message: 'Заказ успешно отменен',
                    order_id: orderId,
                    reason,
                    return_orders: returnOrders
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка при отмене заказа:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Возврат товара на склад (снятие резервации)
     * @private
     */
    async _unreserveProduct(client, productId, count) {
        await client.query(
            `UPDATE products
             SET count = count + $1
             WHERE product_id = $2`,
            [count, productId]
        );
    }

    /**
     * Получить список заказов пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Array>} Список заказов
     */
    async getUserOrders(userId) {
        try {
            const ordersResult = await Database.query(
                `SELECT o.*, opp.address
                 FROM orders o
                 JOIN opp ON o.opp_id = opp.opp_id
                 WHERE o.receiver_id = $1
                 ORDER BY o.created_date DESC`,
                [userId]
            );

            const orders = [];

            for (const order of ordersResult.rows) {
                const fullOrder = await this.getOrderWithDetails(order.order_id);
                orders.push(fullOrder);
            }

            return orders;

        } catch (error) {
            console.error('Ошибка в getUserOrders:', error);
            throw error;
        }
    }

    /**
     * Прием товара в ПВЗ от продавца
     * @param {number} orderId - ID заказа
     * @param {number} productId - ID товара
     * @param {number} count - Количество товара
     * @param {number} oppId - ID ПВЗ, куда прибыл товар
     * @returns {Promise<Object>} Результат операции
     */
    async orderReceiveProduct(orderId, productId, count, oppId) {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // Проверяем, что заказ существует
            const orderCheck = await client.query(
                `SELECT o.order_id, o.opp_id as target_opp_id
                 FROM orders o
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderCheck.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            // Проверяем, что товар есть в заказе
            const productCheck = await client.query(
                `SELECT op.ordered_count
                 FROM order_products op
                 WHERE op.order_id = $1 AND op.product_id = $2`,
                [orderId, productId]
            );

            if (productCheck.rows.length === 0) {
                throw new Error('Товар не найден в заказе');
            }

            // Получаем текущее распределение товара для проверки
            const statusInfo = await this.getProductStatuses(productId, orderId);
            const distribution = statusInfo.data.current_distribution;

            // Проверяем, что не превышаем количество товара в статусе waiting
            if (count > distribution.waiting_for_product_arrival_in_opp) {
                throw new Error(
                    `Нельзя принять ${count} шт. В ожидании только ${distribution.waiting_for_product_arrival_in_opp} шт.`
                );
            }

            // Добавляем статус arrived_in_opp
            await client.query(
                `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                 VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                [
                    orderId,
                    productId,
                    count,
                    JSON.stringify(new ArrivedInOppFromSellerDto(oppId))
                ]
            );

            await client.query('COMMIT');

            // Вызываем outerLogisticsService.orderReceiveProduct для проверки готовности к отправке
            const outerLogisticsService = (await import('./outerLogisticsService.js')).default;
            const logisticsResult = await outerLogisticsService.orderReceiveProduct(orderId, productId, count, oppId);

            return {
                success: true,
                data: {
                    message: `Товар принят в ПВЗ ${oppId}`,
                    order_id: orderId,
                    product_id: productId,
                    count: count,
                    opp_id: oppId,
                    logistics_info: logisticsResult.data
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка в orderReceiveProduct:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Выдача заказа покупателю из ПВЗ
     * @param {number} orderId - ID заказа
     * @param {number} oppId - ID ПВЗ, откуда выдается заказ
     * @returns {Promise<Object>} Результат операции
     */
    async deliverOrder(orderId, oppId) {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // Получаем информацию о заказе
            const orderResult = await client.query(
                `SELECT o.order_id, o.opp_id as target_opp_id, o.receiver_id
                 FROM orders o
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            const order = orderResult.rows[0];
            const targetOppId = order.target_opp_id;

            // Проверяем, что выдача происходит из целевого ПВЗ
            if (oppId !== targetOppId) {
                throw new Error(`Заказ можно выдать только из целевого ПВЗ ${targetOppId}`);
            }

            // Получаем все товары заказа
            const productsResult = await client.query(
                `SELECT op.product_id, op.ordered_count, p.name as product_name
                 FROM order_products op
                 JOIN products p ON op.product_id = p.product_id
                 WHERE op.order_id = $1`,
                [orderId]
            );

            if (productsResult.rows.length === 0) {
                throw new Error('Товары в заказе не найдены');
            }

            let totalDelivered = 0;
            let totalOrdered = 0;
            let allProductsInTargetOpp = true;

            // Обрабатываем каждый товар
            for (const product of productsResult.rows) {
                totalOrdered += product.ordered_count;

                // Получаем распределение товара
                const statusInfo = await this.getProductStatuses(product.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                // Проверяем, сколько товара в целевом ПВЗ
                const countInTargetOpp = distribution.by_opp[targetOppId] || 0;

                if (countInTargetOpp > 0) {
                    // Добавляем статус delivered для товаров в целевом ПВЗ
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'delivered', $3, NOW(), $4)`,
                        [
                            orderId,
                            product.product_id,
                            countInTargetOpp,
                            JSON.stringify(new DeliveredDto(targetOppId))
                        ]
                    );

                    totalDelivered += countInTargetOpp;
                }

                // Проверяем, все ли товары этого типа были в целевом ПВЗ
                if (countInTargetOpp < product.ordered_count) {
                    allProductsInTargetOpp = false;
                }
            }

            if (totalDelivered === 0) {
                throw new Error('Нет товаров для выдачи в целевом ПВЗ');
            }

            // Если все товары были в целевом ПВЗ, завершаем заказ
            if (allProductsInTargetOpp && totalDelivered === totalOrdered) {
                await client.query(
                    `INSERT INTO order_statuses (order_id, status, date, data)
                     VALUES ($1, 'completed', NOW(), $2)`,
                    [
                        orderId,
                        JSON.stringify({
                            completed_at: new Date().toISOString(),
                            opp_id: targetOppId,
                            all_products_delivered: true
                        })
                    ]
                );
            }

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    message: allProductsInTargetOpp
                        ? 'order_done'
                        : 'order_not_done',
                    order_id: orderId,
                    opp_id: oppId,
                    delivered_count: totalDelivered,
                    total_ordered: totalOrdered,
                    is_completed: allProductsInTargetOpp && totalDelivered === totalOrdered,
                    partial_delivery: !allProductsInTargetOpp
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка в deliverOrder:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Передача товара в логистическую доставку
     * @param {number} orderId - ID заказа
     * @param {number} logisticsOrderIdentifier - ID логистического заказа
     * @param {number} productId - ID товара
     * @param {number} count - Количество товара
     * @param {number} oppId - ID ПВЗ, откуда передается товар
     * @returns {Promise<Object>} Результат операции
     */
    async giveProductToDelivery(orderId, logisticsOrderIdentifier, productId, count, oppId) {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // Проверяем, что заказ существует
            const orderCheck = await client.query(
                `SELECT o.order_id
                 FROM orders o
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderCheck.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            // Проверяем, что товар есть в заказе
            const productCheck = await client.query(
                `SELECT op.ordered_count
                 FROM order_products op
                 WHERE op.order_id = $1 AND op.product_id = $2`,
                [orderId, productId]
            );

            if (productCheck.rows.length === 0) {
                throw new Error('Товар не найден в заказе');
            }

            // Получаем текущее распределение товара
            const statusInfo = await this.getProductStatuses(productId, orderId);
            const distribution = statusInfo.data.current_distribution;

            // Проверяем, что в указанном ПВЗ есть достаточно товара
            const countInOpp = distribution.by_opp[oppId] || 0;
            if (count > countInOpp) {
                throw new Error(
                    `Недостаточно товара в ПВЗ ${oppId}. Доступно: ${countInOpp}, требуется: ${count}`
                );
            }

            await client.query('COMMIT');

            // Вызываем outerLogisticsService.giveProductToDelivery
            const outerLogisticsService = (await import('./outerLogisticsService.js')).default;
            const logisticsResult = await outerLogisticsService.giveProductToDelivery(
                orderId,
                logisticsOrderIdentifier,
                productId,
                count,
                oppId
            );

            if (!logisticsResult.success) {
                throw new Error(logisticsResult.error);
            }

            return {
                success: true,
                data: {
                    message: 'Товар передан в логистическую доставку',
                    order_id: orderId,
                    product_id: productId,
                    count: count,
                    opp_id: oppId,
                    logistics_order_id: logisticsOrderIdentifier,
                    logistics_info: logisticsResult.data
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка в giveProductToDelivery:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Прием товаров из логистической доставки в ПВЗ
     * @param {number} logisticsOrderIdentifier - ID логистического заказа
     * @returns {Promise<Object>} Результат операции
     */
    async receiveProductFromLogistics(logisticsOrderIdentifier) {
        try {
            // Вызываем outerLogisticsService.addProductsToOpp
            const outerLogisticsService = (await import('./outerLogisticsService.js')).default;
            const result = await outerLogisticsService.addProductsToOpp(logisticsOrderIdentifier);

            if (!result.success) {
                throw new Error(result.error);
            }

            return {
                success: true,
                data: {
                    message: 'Товары из логистического заказа получены в ПВЗ',
                    logistics_order_id: logisticsOrderIdentifier,
                    logistics_info: result.data
                }
            };

        } catch (error) {
            console.error('Ошибка в receiveProductFromLogistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new OrdersService();