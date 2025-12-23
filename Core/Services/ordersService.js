import {Database} from "../Model/Database.js";
import OuterLogisticsService from "./outerLogisticsService.js";
import {
    ArrivedInOppFromSellerDto,
    ArrivedInOppReturnOrderDto,
    SentToLogisticsReturnDto,
    DeliveredDto,
    RefundedDto,
    WaitingForProductArrivalDto, PlanOrderDeliveryOrderDto
} from './order_product_statuses_dtos/index.js';

class OrdersService {

    /**
     * Получить статусы товара с количеством для каждого статуса
     * @param {number} productId - ID товара
     * @param {number} orderId - ID заказа (опционально)
     * @returns {Promise<Object>} Статусы с количеством
     */
    async getProductStatuses(productId, orderId = null, client = null) {
        try {
            let query = `
                SELECT ops.order_product_status,
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

            const result = await (client ? client : Database).query(query, params);

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
            sent_to_logistics_unvalid: {}, // товары, не принадлежащие своему логистическому заказу (бывает когда товар везли для заказа, но в процессе перевозки заказ был отменен)
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
                    if (data.is_target_opp && data.is_start_opp) {
                        distribution.at_target_opp += count;
                    } else if (data.is_start_opp) {
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
                        } else if (distribution.sent_to_logistics_unvalid[prevLogisticsId] >= count) {
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

                    if (arrivedInopp[data.opp_id]) {
                        arrivedInopp[data.opp_id] -= count;
                    }

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

                        if (arrivedInopp[data.opp_id]) {
                            arrivedInopp[data.opp_id] -= count;
                        }

                    } else if (fromStatus === 'at_target_opp') {
                        distribution.at_target_opp -= count;

                        if (arrivedInopp[data.opp_id]) {
                            arrivedInopp[data.opp_id] -= count;
                        }

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
                        s.name     as shop_name,
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
                        p.name     as product_name,
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

            // 2. Собираем информацию о товарах для возврата
            const productsToReturn = [];

            for (const row of orderResult.rows) {
                // Получаем текущее распределение статусов товара
                const statusInfo = await this.getProductStatuses(row.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                productsToReturn.push({
                    product_id: row.product_id,
                    product_name: row.product_name,
                    seller_id: row.seller_id,
                    price: row.price,
                    distribution: distribution,
                    order_id: orderId
                });
            }

            // 3. Вызываем функцию возврата товаров
            const returnOrders = await this.returnProducts(client, productsToReturn, reason, targetOppId);

            // 4. Меняем статус заказа на canceled
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
     * Возврат товаров продавцам
     * @param {Object} client - Транзакция БД
     * @param {Array} products - Массив товаров для возврата [{product_id, count, seller_id, distribution, price, product_name, order_id}]
     * @param {string} reason - Причина возврата
     * @param {number} prevOrderTargetId - ID целевого ПВЗ заказа, товары из которого возвращаем
     * @returns {Promise<Array>} Массив созданных обратных заказов
     */
    async returnProducts(client, products, reason, prevOrderTargetId) {
        // 1. Обрабатываем товары в статусе waiting_for_product_arrival_in_opp
        for (const product of products) {
            if (product.distribution.waiting_for_product_arrival_in_opp > 0) {
                // Возвращаем на склад
                await this._unreserveProduct(
                    client,
                    product.product_id,
                    product.distribution.waiting_for_product_arrival_in_opp
                );

                // Записываем статус refunded
                await client.query(
                    `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                     VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                    [
                        product.order_id,
                        product.product_id,
                        product.distribution.waiting_for_product_arrival_in_opp,
                        JSON.stringify(new RefundedDto(
                            reason,
                            'waiting_for_product_arrival_in_opp',
                            {returnedToStock: true}
                        ))
                    ]
                );
            }
        }

        // 2. Группируем товары по продавцам для создания обратных заказов
        const productsBySeller = new Map(); // seller_id -> [{product_id, count, distribution, ...}]

        for (const product of products) {
            // Суммируем количество товаров в логистике
            const sentToLogisticsTotal = Object.values(product.distribution.sent_to_logistics).reduce((sum, count) => sum + count, 0);
            const returnableCount = product.distribution.at_start_opp + product.distribution.at_target_opp + sentToLogisticsTotal;

            if (returnableCount > 0) {
                if (!productsBySeller.has(product.seller_id)) {
                    productsBySeller.set(product.seller_id, []);
                }

                productsBySeller.get(product.seller_id).push({
                    ...product,
                    returnableCount
                });
            }
        }

        // 3. Создаем обратные заказы для каждого продавца
        const returnOrders = [];

        for (const [sellerId, sellerProducts] of productsBySeller.entries()) {
            //Нужно вычислить ПВЗ куда возвращаем
            let sellerOppIds = new Set();
            for (let sellerProduct of sellerProducts) {
                for (let opp_id in sellerProduct.distribution.by_opp) {
                    sellerOppIds.add(Number.parseInt(opp_id));
                }
            }

            sellerOppIds.delete(prevOrderTargetId);
            if (sellerOppIds.size === 0) {
                throw new Error(`Ошибка: непонятно куда возвращать товар!`);
            }

            let [newTargetOppId] = sellerOppIds;

            // Создаем заказ типа 'client' для продавца (сумма = 0)
            const returnOrderResult = await client.query(
                `INSERT INTO orders (order_type, receiver_id, opp_id, created_date)
                 VALUES ('client', $1, $2, NOW())
                 RETURNING *`,
                [sellerId, newTargetOppId]
            );

            const returnOrder = returnOrderResult.rows[0];

            // Добавляем товары в обратный заказ
            for (const product of sellerProducts) {
                await client.query(
                    `INSERT INTO order_products (order_id, product_id, ordered_count, price, opp_received_count)
                     VALUES ($1, $2, $3, 0, 0)`,
                    [returnOrder.order_id, product.product_id, product.returnableCount]
                );

                for (let opp_id in product.distribution.by_opp) {
                    if (product.distribution.by_opp[opp_id] === 0) continue;
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                        [
                            returnOrder.order_id,
                            product.product_id,
                            product.distribution.by_opp[opp_id],
                            JSON.stringify(new ArrivedInOppReturnOrderDto(
                                opp_id,
                                opp_id === prevOrderTargetId,  // is_start_opp
                                opp_id === newTargetOppId, // is_target_opp
                                product.order_id
                            ))
                        ]
                    );
                }

                // Для товаров в sent_to_logistics: создаем статусы для каждого logistics_order_id
                for (const [logisticsOrderId, count] of Object.entries(product.distribution.sent_to_logistics)) {
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
                                    product.order_id
                                ))
                            ]
                        );
                    }
                }
            }

            returnOrders.push(
                new PlanOrderDeliveryOrderDto(
                    returnOrder.order_id,
                    sellerId,
                    newTargetOppId,
                    sellerProducts[0].order_id)
            )

        }

        // 4. Планируем доставку для обратных заказов
        if (returnOrders.length > 0) {
            const planResult = await OuterLogisticsService.planOrderDelivery(returnOrders, client);
            if (!planResult.success) {
                throw new Error(`Ошибка при планировании доставки: ${planResult.error}`);
            }
        }

        // 5. Записываем статусы refunded для всех возвращаемых товаров
        for (const product of products) {
            const distribution = product.distribution;

            for (let opp_id in distribution.by_opp) {

                if (distribution.by_opp[opp_id] === 0) continue;

                await client.query(
                    `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                     VALUES ($1, $2, 'refunded', $3, NOW(), $4)`,
                    [
                        product.order_id,
                        product.product_id,
                        distribution.at_start_opp,
                        JSON.stringify(new RefundedDto(
                            reason,
                            opp_id === prevOrderTargetId ? 'at_target_opp' : 'at_start_opp',
                            {returnOrderCreated: true, opp_id: opp_id}
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
                            product.order_id,
                            product.product_id,
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

        return returnOrders;
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
                 WHERE op.order_id = $1
                   AND op.product_id = $2`,
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


            if (oppId == orderCheck.rows[0].target_opp_id) {
                // Добавляем статус arrived_in_opp
                await client.query(
                    `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                     VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                    [
                        orderId,
                        productId,
                        count,
                        JSON.stringify({opp_id: oppId, is_target_opp: true, is_start_opp: true})
                    ]
                );
            } else {
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
            }

            await client.query('COMMIT');


            const logisticsResult = await OuterLogisticsService.orderReceiveProduct(orderId, productId, count, oppId);

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
     * @param {Array} rejectedProducts - Массив отклоненных товаров [{product_id, count}]
     * @returns {Promise<Object>} Результат операции
     */
    async deliverOrder(orderId, oppId, rejectedProducts = []) {
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

            // Получаем все товары заказа с информацией о продавцах
            const productsResult = await client.query(
                `SELECT op.product_id, op.ordered_count, op.price, p.name as product_name, s.owner_id as seller_id
                 FROM order_products op
                          JOIN products p ON op.product_id = p.product_id
                          JOIN shops s ON p.shop_id = s.shop_id
                 WHERE op.order_id = $1`,
                [orderId]
            );

            if (productsResult.rows.length === 0) {
                throw new Error('Товары в заказе не найдены');
            }

            // Создаем карту отклоненных товаров для быстрого доступа
            const rejectedMap = new Map();
            for (const rejected of rejectedProducts) {
                rejectedMap.set(rejected.product_id, rejected.count);
            }

            let totalDelivered = 0;
            let totalRejected = 0;
            let totalOrdered = 0;
            let allProductsInTargetOpp = true;
            const productsToReturn = [];

            // Обрабатываем каждый товар
            for (const product of productsResult.rows) {
                totalOrdered += product.ordered_count;

                // Получаем распределение товара
                const statusInfo = await this.getProductStatuses(product.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                // Проверяем, сколько товара в целевом ПВЗ
                const countInTargetOpp = distribution.by_opp[targetOppId] || 0;

                // Проверяем, отклонен ли этот товар
                const rejectedCount = rejectedMap.get(product.product_id) || 0;

                if (rejectedCount > 0) {
                    // Проверяем, что отклоняемое количество не превышает доступное
                    if (rejectedCount > countInTargetOpp) {
                        throw new Error(
                            `Нельзя отклонить ${rejectedCount} шт. товара ${product.product_name}. ` +
                            `В целевом ПВЗ доступно только ${countInTargetOpp} шт.`
                        );
                    }

                    // Добавляем товар в список для возврата
                    productsToReturn.push({
                        product_id: product.product_id,
                        product_name: product.product_name,
                        seller_id: product.seller_id,
                        price: product.price,
                        distribution: {
                            ...distribution,
                            // Для возврата используем только количество в целевом ПВЗ
                            at_target_opp: rejectedCount,
                            at_start_opp: 0,
                            sent_to_logistics: {},
                            waiting_for_product_arrival_in_opp: 0
                        },
                        order_id: orderId
                    });

                    totalRejected += rejectedCount;
                }

                // Выдаем оставшиеся товары (не отклоненные)
                const countToDeliver = countInTargetOpp - rejectedCount;

                if (countToDeliver > 0) {
                    // Добавляем статус delivered для выданных товаров
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'delivered', $3, NOW(), $4)`,
                        [
                            orderId,
                            product.product_id,
                            countToDeliver,
                            JSON.stringify(new DeliveredDto(targetOppId))
                        ]
                    );

                    totalDelivered += countToDeliver;
                }

                // Проверяем, все ли товары этого типа были в целевом ПВЗ
                if (countInTargetOpp < product.ordered_count) {
                    allProductsInTargetOpp = false;
                }
            }

            // Обрабатываем возврат отклоненных товаров
            let returnOrders = [];
            if (productsToReturn.length > 0) {
                returnOrders = await this.returnProducts(
                    client,
                    productsToReturn,
                    'Отклонено покупателем при получении',
                    targetOppId
                );
            }

            if (totalDelivered === 0 && totalRejected === 0) {
                throw new Error('Нет товаров для выдачи в целевом ПВЗ');
            }

            // Если все товары были обработаны (выданы или отклонены), завершаем заказ
            const allProcessed = (totalDelivered + totalRejected) === totalOrdered;
            if (allProductsInTargetOpp && allProcessed) {
                await client.query(
                    `INSERT INTO order_statuses (order_id, status, date, data)
                     VALUES ($1, 'done', NOW(), $2)`,
                    [
                        orderId,
                        JSON.stringify({
                            completed_at: new Date().toISOString(),
                            opp_id: targetOppId,
                            all_products_delivered: true,
                            rejected_count: totalRejected,
                            delivered_count: totalDelivered
                        })
                    ]
                );
            }

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    message: allProductsInTargetOpp && allProcessed
                        ? 'order_done'
                        : 'order_not_done',
                    order_id: orderId,
                    opp_id: oppId,
                    delivered_count: totalDelivered,
                    rejected_count: totalRejected,
                    total_ordered: totalOrdered,
                    is_completed: allProductsInTargetOpp && allProcessed,
                    partial_delivery: !allProductsInTargetOpp,
                    return_orders: returnOrders
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
                 WHERE op.order_id = $1
                   AND op.product_id = $2`,
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

            // Вызываем OuterLogisticsService.giveProductToDelivery
            const logisticsResult = await OuterLogisticsService.giveProductToDelivery(
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
            const result = await OuterLogisticsService.addProductsToOpp(logisticsOrderIdentifier);

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

    /**
     * Получить историю статусов заказа для клиента
     * @param {number} orderId - ID заказа
     * @returns {Promise<Array>} История статусов в формате [{name: "Упаковывается", time: timestamp}]
     */
    async getOrderStatusHistory(orderId) {
        try {
            const statusHistory = [];

            // 1. Получаем базовую информацию о заказе
            const orderResult = await Database.query(
                `SELECT created_date, received_date
                 FROM orders
                 WHERE order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            const order = orderResult.rows[0];

            // 2. Статус "Упаковывается" - всегда есть, время создания заказа
            statusHistory.push({
                name: "Упаковывается",
                time: order.created_date
            });

            // 3. Получаем все товары заказа с заказанным количеством
            const productsResult = await Database.query(
                `SELECT product_id, ordered_count
                 FROM order_products
                 WHERE order_id = $1`,
                [orderId]
            );

            if (productsResult.rows.length === 0) {
                return statusHistory;
            }

            // Создаем карту product_id -> ordered_count
            const orderedCountMap = {};
            for (const product of productsResult.rows) {
                orderedCountMap[product.product_id] = product.ordered_count;
            }

            // 4. Проверяем статус "Передан в доставку"
            // Все товары должны иметь статус sent_to_logistics в истории
            const sentToLogisticsResult = await Database.query(
                `SELECT product_id, SUM(count) as total_sent, MAX(date) as last_sent_date
                 FROM order_product_statuses
                 WHERE order_id = $1
                   AND order_product_status = 'sent_to_logistics'
                 GROUP BY product_id`,
                [orderId]
            );

            // Проверяем, все ли товары полностью отправлены
            let allProductsSent = true;
            let maxSentDate = null;

            for (const product of productsResult.rows) {
                const sentRecord = sentToLogisticsResult.rows.find(r => r.product_id === product.product_id);
                const totalSent = sentRecord ? parseInt(sentRecord.total_sent) : 0;

                if (totalSent < product.ordered_count) {
                    allProductsSent = false;
                    break;
                }

                if (sentRecord && sentRecord.last_sent_date) {
                    if (!maxSentDate || sentRecord.last_sent_date > maxSentDate) {
                        maxSentDate = sentRecord.last_sent_date;
                    }
                }
            }

            if (allProductsSent && maxSentDate) {
                statusHistory.push({
                    name: "Передан в доставку",
                    time: maxSentDate
                });
            }

            // 5. Проверяем статус "Ожидает в ПВЗ"
            // Все товары должны иметь статус arrived_in_opp с is_target_opp = true
            const arrivedInTargetOppResult = await Database.query(
                `SELECT product_id, SUM(count) as total_arrived, MAX(date) as last_arrived_date
                 FROM order_product_statuses
                 WHERE order_id = $1
                   AND order_product_status = 'arrived_in_opp'
                   AND data ->> 'is_target_opp' = 'true'
                 GROUP BY product_id`,
                [orderId]
            );

            // Проверяем, все ли товары прибыли в целевой ПВЗ
            let allProductsInTargetOpp = true;
            let maxArrivedDate = null;

            for (const product of productsResult.rows) {
                const arrivedRecord = arrivedInTargetOppResult.rows.find(r => r.product_id === product.product_id);
                const totalArrived = arrivedRecord ? parseInt(arrivedRecord.total_arrived) : 0;

                if (totalArrived < product.ordered_count) {
                    allProductsInTargetOpp = false;
                    break;
                }

                if (arrivedRecord && arrivedRecord.last_arrived_date) {
                    if (!maxArrivedDate || arrivedRecord.last_arrived_date > maxArrivedDate) {
                        maxArrivedDate = arrivedRecord.last_arrived_date;
                    }
                }
            }

            if (allProductsInTargetOpp && maxArrivedDate) {
                statusHistory.push({
                    name: "Ожидает в ПВЗ",
                    time: maxArrivedDate
                });
            }

            // 6. Проверяем статус "Завершен"
            // Заказ должен иметь статус done в таблице order_statuses
            const doneStatusResult = await Database.query(
                `SELECT date
                 FROM order_statuses
                 WHERE order_id = $1
                   AND status = 'done'
                 ORDER BY date DESC
                 LIMIT 1`,
                [orderId]
            );

            const cancelOrderResult = await Database.query(
                `SELECT date
                 FROM order_statuses
                 WHERE order_id = $1
                   AND status = 'canceled'
                 ORDER BY date DESC
                 LIMIT 1`,
                [orderId]
            );

            if (doneStatusResult.rows.length > 0) {
                statusHistory.push({
                    name: "Завершен",
                    time: order.received_date || doneStatusResult.rows[0].date
                });
            } else if (cancelOrderResult.rows.length > 0) {
                statusHistory.push({
                    name: "Отменен",
                    time: cancelOrderResult.rows[0].date
                });
            }

            return statusHistory;

        } catch (error) {
            console.error('Ошибка в getOrderStatusHistory:', error);
            throw error;
        }
    }
}

export default new OrdersService();