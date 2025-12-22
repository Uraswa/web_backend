// ===== Core\Services\outerLogisticsService.js =====
import {Database} from "../Model/Database.js";
import {
    ArrivedInOppFromLogisticsDto, PlanOrderDeliveryOrderDto,
    SentToLogisticsDto
} from './order_product_statuses_dtos/index.js';
import ordersService from "./ordersService.js";


class OuterLogisticsService {

    // Хранилище логистических заказов в памяти
    // Формат: { [logisticsOrderId]: { sourceOppId, targetOppId, products: [] } }
    _logisticsOrders = {};
    _nextLogisticsOrderId = 1;
    _mockLogisticsEnabled = (process.env.MOCK_LOGISTICS || '').toLowerCase() === 'true';

    constructor() {
        // Создаем несколько демо логистических заказов
        this._initializeDemoLogisticsOrders();
    }

    /**
     * Инициализация демо логистических заказов в памяти
     * @private
     */
    _initializeDemoLogisticsOrders() {
        // Логистический заказ 1: ПВЗ 1 → ПВЗ 2
        this._logisticsOrders[1] = {
            logisticsOrderId: 1,
            sourceOppId: 1,
            targetOppId: 2,
            createdDate: new Date('2025-01-10T10:00:00'),
            products: [
                {
                    productId: 1,
                    productName: 'Демо товар 1',
                    clientOrderId: 101,
                    clientReceiverId: 5,
                    count: 3,
                    price: 1500.00
                },
                {
                    productId: 2,
                    productName: 'Демо товар 2',
                    clientOrderId: 101,
                    clientReceiverId: 5,
                    count: 2,
                    price: 2500.00
                }
            ]
        };

        // Логистический заказ 2: ПВЗ 3 → ПВЗ 1
        this._logisticsOrders[2] = {
            logisticsOrderId: 2,
            sourceOppId: 3,
            targetOppId: 1,
            createdDate: new Date('2025-01-11T14:30:00'),
            products: [
                {
                    productId: 5,
                    productName: 'Демо товар 5',
                    clientOrderId: 102,
                    clientReceiverId: 7,
                    count: 1,
                    price: 5000.00
                }
            ]
        };

        // Логистический заказ 3: ПВЗ 2 → ПВЗ 4
        this._logisticsOrders[3] = {
            logisticsOrderId: 3,
            sourceOppId: 2,
            targetOppId: 4,
            createdDate: new Date('2025-01-12T09:15:00'),
            products: [
                {
                    productId: 3,
                    productName: 'Демо товар 3',
                    clientOrderId: 103,
                    clientReceiverId: 8,
                    count: 5,
                    price: 800.00
                },
                {
                    productId: 4,
                    productName: 'Демо товар 4',
                    clientOrderId: 104,
                    clientReceiverId: 9,
                    count: 2,
                    price: 3200.00
                }
            ]
        };

        // Логистический заказ 4: ПВЗ 1 → ПВЗ 3
        this._logisticsOrders[4] = {
            logisticsOrderId: 4,
            sourceOppId: 1,
            targetOppId: 3,
            createdDate: new Date('2025-01-13T16:45:00'),
            products: [
                {
                    productId: 6,
                    productName: 'Демо товар 6',
                    clientOrderId: 105,
                    clientReceiverId: 10,
                    count: 4,
                    price: 1200.00
                }
            ]
        };

        // Обновляем счетчик ID
        this._nextLogisticsOrderId = 5;

        console.log(`[OuterLogisticsService] Инициализировано ${Object.keys(this._logisticsOrders).length} демо логистических заказов`);
    }

    /**
     * Проверка готовности заказа к отправке и создание логистических заказов
     * @param {number} orderId - ID заказа
     * @param {number} productId - ID товара (не используется в текущей реализации)
     * @param {number} count - Количество товара (не используется в текущей реализации)
     * @param {number} oppId - ID ПВЗ, куда прибыл товар
     * @returns {Promise<Object>} Результат операции
     */
    async orderReceiveProduct(orderId, productId, count, oppId, auto_add_to_logistics = false) {
        try {
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
                const planResult = await this.planOrderDelivery([
                    new PlanOrderDeliveryOrderDto(
                        order.order_id,
                        order.receiver_id,
                        order.target_opp_id)
                ],  null, auto_add_to_logistics);

                if (this._mockLogisticsEnabled && planResult?.success && planResult?.data?.logistics_orders) {
                    for (const logisticsOrder of planResult.data.logistics_orders) {
                        if (logisticsOrder?.logistics_order_id) {
                            await this.addProductsToOpp(logisticsOrder.logistics_order_id);
                        }
                    }
                }

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
     * Передача товара логисту для доставки
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

            // Проверяем существование логистического заказа
            const logisticsOrder = this._logisticsOrders[logisticsOrderIdentifier];
            if (!logisticsOrder) {
                throw new Error(`Логистический заказ ${logisticsOrderIdentifier} не найден`);
            }

            // Проверяем, что товар есть в логистическом заказе
            const productInLogistics = logisticsOrder.products.find(
                p => p.productId === productId && p.clientOrderId === orderId
            );

            if (!productInLogistics) {
                throw new Error(
                    `Товар ${productId} из заказа ${orderId} не найден в логистическом заказе ${logisticsOrderIdentifier}`
                );
            }

            // Проверяем количество
            if (count > productInLogistics.count) {
                throw new Error(
                    `Нельзя передать ${count} шт. В логистическом заказе только ${productInLogistics.count} шт.`
                );
            }

            // Добавляем статус sent_to_logistics
            await client.query(
                `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                 VALUES ($1, $2, 'sent_to_logistics', $3, NOW(), $4)`,
                [
                    orderId,
                    productId,
                    count,
                    JSON.stringify(new SentToLogisticsDto(logisticsOrderIdentifier, oppId))
                ]
            );

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    message: `Товар передан в логистический заказ ${logisticsOrderIdentifier}`,
                    logistics_order_id: logisticsOrderIdentifier,
                    product_id: productId,
                    count: count,
                    opp_id: oppId
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
     * Прием товаров из логистического заказа в целевой ПВЗ
     * @param {number} logisticsOrderIdentifier - ID логистического заказа
     * @returns {Promise<Object>} Результат операции
     */
    async addProductsToOpp(logisticsOrderIdentifier) {
        const client = await Database.GetMasterClient();

        try {
            await client.query('BEGIN');

            // Получаем логистический заказ из памяти
            const logisticsOrder = this._logisticsOrders[logisticsOrderIdentifier];
            if (!logisticsOrder) {
                throw new Error(`Логистический заказ ${logisticsOrderIdentifier} не найден`);
            }

            const targetOppId = logisticsOrder.targetOppId;
            const products = logisticsOrder.products;

            if (!products || products.length === 0) {
                throw new Error(`Логистический заказ ${logisticsOrderIdentifier} не содержит товаров`);
            }

            // Для каждого товара в логистическом заказе добавляем статус arrived_in_opp
            for (const product of products) {
                await client.query(
                    `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                     VALUES ($1, $2, 'arrived_in_opp', $3, NOW(), $4)`,
                    [
                        product.clientOrderId,
                        product.productId,
                        product.count,
                        JSON.stringify(new ArrivedInOppFromLogisticsDto(logisticsOrderIdentifier, targetOppId))
                    ]
                );
            }

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    message: `Все товары из логистического заказа ${logisticsOrderIdentifier} получены в ПВЗ ${targetOppId}`,
                    logistics_order_id: logisticsOrderIdentifier,
                    target_opp_id: targetOppId,
                    products_count: products.length,
                    total_items: products.reduce((sum, p) => sum + p.count, 0)
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка в addProductsToOpp:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.release();
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
     * @param {PlanOrderDeliveryOrderDto[]} orders - Массив заказов для которых нужно спланировать логистику
     * @returns {Promise<Object>} Результат планирования с созданными логистическими заказами
     */
    async planOrderDelivery(orders, client = null, auto_add_to_logistics = true) {
        let shouldReleaseClient = false;

        try {

            // Создаем подключение к БД если не передано
            if (!client) {
                client = await Database.GetMasterClient();
                shouldReleaseClient = true;
            }

            // Группируем товары по уникальным маршрутам (start_opp_id, target_opp_id)
            const routeMap = new Map(); // key: "start_opp_id-target_opp_id" -> {sourceOppId, targetOppId, products[]}

            for (const order of orders) {
                const orderId = order.order_id;
                const targetOppId = order.target_opp_id;
                const receiverId = order.receiver_id;

                // Получаем все товары заказа
                const productsResult = await client.query(
                    `SELECT op.product_id,
                            op.ordered_count,
                            op.price,
                            p.name as product_name
                     FROM order_products op
                              JOIN products p ON op.product_id = p.product_id
                     WHERE op.order_id = $1`,
                    [orderId]
                );

                for (const product of productsResult.rows) {
                    const productId = product.product_id;

                    // Получаем текущее распределение товара
                    const statusInfo = await ordersService.getProductStatuses(productId, orderId, client);

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

                        for (let unvalidLogisticsOrderId in distribution.sent_to_logistics_unvalid) {
                            if (distribution.sent_to_logistics_unvalid[unvalidLogisticsOrderId] === 0) continue;

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
                                count: distribution.sent_to_logistics_unvalid[unvalidLogisticsOrderId],
                                previousLogisticsOrderId: unvalidLogisticsOrderId,
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

            if (auto_add_to_logistics) {
                // Добавляем статусы sent_to_logistics для каждого товара в логистических заказах
                for (const logisticsOrder of createdLogisticsOrders) {
                    const logisticsOrderId = logisticsOrder.logistics_order_id;
                    const sourceOppId = logisticsOrder.source_opp_id;

                    for (const product of logisticsOrder.products) {
                        // Вставляем запись в order_product_statuses
                        await client.query(
                            `INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data)
                             VALUES ($1, $2, 'sent_to_logistics', $3, NOW(), $4)`,
                            [
                                product.clientOrderId,
                                product.productId,
                                product.count,
                                JSON.stringify(new SentToLogisticsDto(
                                    logisticsOrderId,
                                    sourceOppId !== 0 ? sourceOppId : null,
                                    product.previousLogisticsOrderId ? product.previousLogisticsOrderId : null
                                ))
                            ]
                        );
                    }
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
