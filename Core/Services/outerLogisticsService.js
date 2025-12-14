// ===== Core\Services\outerLogisticsService.js =====
import {Database} from "../Model/Database.js";

class OuterLogisticsService {

    // Хранилище логистических заказов в памяти
    // Формат: { [logisticsOrderId]: { sourceOppId, targetOppId, products: [] } }
    _logisticsOrders = {};
    _nextLogisticsOrderId = 1;

    /**
     * Проверка готовности заказа к отправке и создание логистических заказов
     * @param {number} orderId - ID заказа
     * @param {number} productId - ID товара (не используется в текущей реализации)
     * @param {number} count - Количество товара (не используется в текущей реализации)
     * @param {number} oppId - ID ПВЗ, куда прибыл товар
     * @returns {Promise<Object>} Результат операции
     */
    async orderReceiveProduct(orderId, productId, count, oppId) {
        try {
            const ordersService = (await import('./ordersService.js')).default;

            // Получаем информацию о заказе
            const orderResult = await Database.query(
                `SELECT o.order_id, o.opp_id as target_opp_id, o.receiver_id
                 FROM orders o
                 WHERE o.order_id = $1`,
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                throw new Error('Заказ не найден');
            }

            const order = orderResult.rows[0];

            // Получаем все товары заказа
            const productsResult = await Database.query(
                `SELECT op.product_id, op.ordered_count
                 FROM order_products op
                 WHERE op.order_id = $1`,
                [orderId]
            );

            // Проверяем условия для каждого товара
            let allProductsReady = true;
            let totalOrdered = 0;
            let totalAtStartOpp = 0;

            for (const product of productsResult.rows) {
                totalOrdered += product.ordered_count;

                const statusInfo = await ordersService.getProductStatuses(product.product_id, orderId);
                const distribution = statusInfo.data.current_distribution;

                // Проверяем, что waiting_for_product_arrival_in_opp = 0
                if (distribution.waiting_for_product_arrival_in_opp > 0) {
                    allProductsReady = false;
                    break;
                }

                // Суммируем товары в at_start_opp
                totalAtStartOpp += distribution.at_start_opp;
            }

            // Проверяем, что все товары в at_start_opp
            if (allProductsReady && totalAtStartOpp === totalOrdered) {
                // Все товары готовы к отправке - вызываем planOrderDelivery
                const planResult = await this.planOrderDelivery([order]);

                return {
                    success: true,
                    data: {
                        message: 'Все товары заказа получены и готовы к отправке',
                        order_ready: true,
                        logistics_info: planResult.data
                    }
                };
            } else {
                return {
                    success: true,
                    data: {
                        message: 'Товар получен, ожидаются остальные товары заказа',
                        order_ready: false,
                        waiting_count: totalOrdered - totalAtStartOpp
                    }
                };
            }

        } catch (error) {
            console.error('Ошибка в orderReceiveProduct:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Создать логистический заказ вручную (для отмены заказа или других операций)
     * @param {number} sourceOppId - ID ПВЗ отправления
     * @param {number} targetOppId - ID ПВЗ назначения
     * @param {Array} products - Массив товаров [{productId, productName, clientOrderId, clientReceiverId, count, price}]
     * @returns {Object} Результат операции с ID созданного логистического заказа
     */
    createLogisticsOrder(sourceOppId, targetOppId, products) {
        try {
            // Проверяем, есть ли уже логистический заказ для этого маршрута
            //TODO пока что это полная дичь, потому что логистический заказ создается для пути (ПВЗ1, ПВЗ2).
            // существующий заказ может быть уже в пути напримиер, а мы херачим туда новые товары, пока что это чисто mock.
            let existingLogisticsOrder = null;
            for (const [id, lo] of Object.entries(this._logisticsOrders)) {
                if (lo.sourceOppId === sourceOppId && lo.targetOppId === targetOppId) {
                    existingLogisticsOrder = lo;
                    break;
                }
            }

            if (existingLogisticsOrder) {
                // Добавляем товары к существующему логистическому заказу
                for (const product of products) {
                    const existingProductIndex = existingLogisticsOrder.products.findIndex(
                        p => p.productId === product.productId && p.clientOrderId === product.clientOrderId
                    );

                    if (existingProductIndex >= 0) {
                        // Обновляем количество
                        existingLogisticsOrder.products[existingProductIndex].count += product.count;
                    } else {
                        // Добавляем новый товар
                        existingLogisticsOrder.products.push(product);
                    }
                }

                return {
                    success: true,
                    data: {
                        message: `Товары добавлены в существующий логистический заказ для маршрута ${sourceOppId}→${targetOppId}`,
                        logistics_order_id: existingLogisticsOrder.logisticsOrderId,
                        is_new: false
                    }
                };
            } else {
                // Создаем новый логистический заказ
                const logisticsOrderId = this._nextLogisticsOrderId++;

                const logisticsOrder = {
                    logisticsOrderId,
                    sourceOppId,
                    targetOppId,
                    createdDate: new Date(),
                    products: products.map(p => ({...p})) // копируем массив
                };

                this._logisticsOrders[logisticsOrderId] = logisticsOrder;

                return {
                    success: true,
                    data: {
                        message: `Создан новый логистический заказ ${logisticsOrderId} для маршрута ${sourceOppId}→${targetOppId}`,
                        logistics_order_id: logisticsOrderId,
                        is_new: true
                    }
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Планирование доставки для массива заказов
     * Создает логистические заказы для доставки товаров в целевые ПВЗ
     * @param {Array} orders - Массив заказов (обычно обратные заказы при отмене)
     * @returns {Promise<Object>} Результат планирования с созданными логистическими заказами
     */
    async planOrderDelivery(orders, client = null) {
        let shouldReleaseClient = false;

        try {
            const ordersService = (await import('./ordersService.js')).default;

            // Создаем подключение к БД если не передано
            if (!client) {
                client = await Database.GetMasterClient();
                shouldReleaseClient = true;
            }

            // Группируем товары по уникальным маршрутам (start_opp_id, target_opp_id)
            const routeMap = new Map(); // key: "start_opp_id-target_opp_id" -> {sourceOppId, targetOppId, products[]}

            for (const order of orders) {
                const orderId = order.order_id;
                const targetOppId = order.opp_id;
                const receiverId = order.receiver_id;

                // Получаем все товары заказа
                const productsResult = await Database.query(
                    `SELECT op.product_id, op.ordered_count, op.price,
                            p.name as product_name
                     FROM order_products op
                     JOIN products p ON op.product_id = p.product_id
                     WHERE op.order_id = $1`,
                    [orderId]
                );

                for (const product of productsResult.rows) {
                    const productId = product.product_id;

                    // Получаем текущее распределение товара
                    const statusInfo = await ordersService.getProductStatuses(productId, orderId);

                    if (!statusInfo.success) {
                        console.error(`Ошибка при получении статусов товара ${productId}:`, statusInfo.error);
                        continue;
                    }

                    const distribution = statusInfo.data.current_distribution;

                    // Обрабатываем товары по ПВЗ из by_opp
                    if (distribution.by_opp) {
                        for (const [oppId, count] of Object.entries(distribution.by_opp)) {
                            const oppIdNum = parseInt(oppId);

                            // Создаем логистический заказ только если товар не в целевом ПВЗ
                            if (oppIdNum !== targetOppId && count > 0) {
                                const routeKey = `${oppIdNum}-${targetOppId}`;

                                if (!routeMap.has(routeKey)) {
                                    routeMap.set(routeKey, {
                                        sourceOppId: oppIdNum,
                                        targetOppId: targetOppId,
                                        products: []
                                    });
                                }

                                routeMap.get(routeKey).products.push({
                                    productId: productId,
                                    productName: product.product_name,
                                    clientOrderId: orderId,
                                    clientReceiverId: receiverId,
                                    count: count,
                                    price: product.price
                                });
                            }
                        }
                    }

                    // Обрабатываем товары в статусе sent_to_logistics_unvalid
                    if (Object.keys(distribution.sent_to_logistics_unvalid).length > 0) {
                        const totalUnvalidCount = Object.values(distribution.sent_to_logistics_unvalid)
                            .reduce((sum, count) => sum + count, 0);

                        if (totalUnvalidCount > 0) {
                            const startOppId = 0;
                            const routeKey = `${startOppId}-${targetOppId}`;

                            if (!routeMap.has(routeKey)) {
                                routeMap.set(routeKey, {
                                    sourceOppId: startOppId,
                                    targetOppId: targetOppId,
                                    products: []
                                });
                            }

                            routeMap.get(routeKey).products.push({
                                productId: productId,
                                productName: product.product_name,
                                clientOrderId: orderId,
                                clientReceiverId: receiverId,
                                count: totalUnvalidCount,
                                price: product.price
                            });
                        }
                    }
                }
            }

            // Создаем логистические заказы для каждого маршрута
            const createdLogisticsOrders = [];

            for (const [routeKey, routeData] of routeMap.entries()) {
                const result = this.createLogisticsOrder(
                    routeData.sourceOppId,
                    routeData.targetOppId,
                    routeData.products
                );

                if (result.success) {
                    createdLogisticsOrders.push({
                        route: routeKey,
                        logistics_order_id: result.data.logistics_order_id,
                        is_new: result.data.is_new,
                        source_opp_id: routeData.sourceOppId,
                        target_opp_id: routeData.targetOppId,
                        products: routeData.products,
                        products_count: routeData.products.length
                    });
                }
            }

            // Добавляем статусы sent_to_logistics для каждого товара в логистических заказах
            for (const logisticsOrder of createdLogisticsOrders) {
                const logisticsOrderId = logisticsOrder.logistics_order_id;
                const sourceOppId = logisticsOrder.source_opp_id;

                for (const product of logisticsOrder.products) {
                    // Формируем данные для статуса
                    const statusData = {
                        logistics_order_id: logisticsOrderId
                    };

                    // Если товар был передан из ПВЗ (sourceOppId !== 0), добавляем from_opp_id
                    if (sourceOppId !== 0) {
                        statusData.from_opp_id = sourceOppId;
                    }

                    // Вставляем запись в order_product_statuses
                    await client.query(
                        `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                         VALUES ($1, $2, 'sent_to_logistics', $3, NOW(), $4)`,
                        [
                            product.clientOrderId,
                            product.productId,
                            product.count,
                            JSON.stringify(statusData)
                        ]
                    );
                }
            }

            return {
                success: true,
                data: {
                    message: `Создано/обновлено ${createdLogisticsOrders.length} логистических заказов`,
                    logistics_orders: createdLogisticsOrders.map(lo => ({
                        route: lo.route,
                        logistics_order_id: lo.logistics_order_id,
                        is_new: lo.is_new,
                        source_opp_id: lo.source_opp_id,
                        target_opp_id: lo.target_opp_id,
                        products_count: lo.products_count
                    }))
                }
            };

        } catch (error) {
            console.error('Ошибка в planOrderDelivery:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            // Освобождаем подключение только если создали его сами
            if (shouldReleaseClient && client) {
                client.release();
            }
        }
    }



}

export default new OuterLogisticsService();