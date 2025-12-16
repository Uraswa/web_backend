// Тестовый скрипт для проверки ordersService и outerLogisticsService
// Запуск: node test_orders_scenarios.js

import {Database} from '../Core/Model/Database.js';
import ordersService from '../Core/Services/ordersService.js';
import outerLogisticsService from '../Core/Services/outerLogisticsService.js';

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
    log('\n' + '='.repeat(80), colors.bright);
    log(title, colors.bright + colors.cyan);
    log('='.repeat(80), colors.bright);
}

function step(message) {
    log(`\n→ ${message}`, colors.blue);
}

function success(message) {
    log(`✓ ${message}`, colors.green);
}

function error(message) {
    log(`✗ ${message}`, colors.red);
}

// Хранилище ID созданных сущностей
const testData = {
    users: {},
    opps: {},
    shops: {},
    products: {},
    orders: {}
};

/**
 * Очистка всех таблиц
 */
async function clearDatabase() {
    const client = await Database.GetMasterClient();

    try {
        await client.query('BEGIN');

        // Порядок важен из-за внешних ключей
        await client.query('TRUNCATE order_product_statuses CASCADE');
        await client.query('TRUNCATE order_statuses CASCADE');
        await client.query('TRUNCATE order_products CASCADE');
        await client.query('TRUNCATE orders CASCADE');
        await client.query('TRUNCATE feedback CASCADE');
        await client.query('TRUNCATE products CASCADE');
        await client.query('TRUNCATE product_categories CASCADE');
        await client.query('TRUNCATE shops CASCADE');
        await client.query('TRUNCATE opp CASCADE');
        await client.query('TRUNCATE users_password_change_tokens CASCADE');
        await client.query('TRUNCATE users_activation_links CASCADE');
        await client.query('TRUNCATE user_profiles CASCADE');
        await client.query('TRUNCATE user_login_info CASCADE');
        await client.query('TRUNCATE users CASCADE');

        await client.query('COMMIT');

        // Очищаем хранилище логистических заказов в памяти
        outerLogisticsService._logisticsOrders = {};
        outerLogisticsService._nextLogisticsOrderId = 1;

        success('База данных очищена');
    } catch (err) {
        await client.query('ROLLBACK');
        error('Ошибка при очистке БД: ' + err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Создание тестовых данных
 */
async function createTestData() {
    const client = await Database.GetMasterClient();

    try {
        await client.query('BEGIN');

        // 1. Создаем пользователей
        // Покупатель
        const buyer = await client.query(
            `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
             VALUES (NOW(), true, true, false)
             RETURNING user_id`
        );
        testData.users.buyer = buyer.rows[0].user_id;

        await client.query(
            `INSERT INTO user_profiles (user_id, first_name, last_name)
             VALUES ($1, 'Иван', 'Покупатель')`,
            [testData.users.buyer]
        );

        // Продавец 1
        const seller1 = await client.query(
            `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
             VALUES (NOW(), true, true, false)
             RETURNING user_id`
        );
        testData.users.seller1 = seller1.rows[0].user_id;

        await client.query(
            `INSERT INTO user_profiles (user_id, first_name, last_name)
             VALUES ($1, 'Петр', 'Продавец-1')`,
            [testData.users.seller1]
        );

        // Продавец 2
        const seller2 = await client.query(
            `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
             VALUES (NOW(), true, true, false)
             RETURNING user_id`
        );
        testData.users.seller2 = seller2.rows[0].user_id;

        await client.query(
            `INSERT INTO user_profiles (user_id, first_name, last_name)
             VALUES ($1, 'Сергей', 'Продавец-2')`,
            [testData.users.seller2]
        );

        // 2. Создаем ПВЗ
        const opp1 = await client.query(
            `INSERT INTO opp (address, latitude, longitude, work_time)
             VALUES ('ПВЗ-1 ул. Ленина 1', 55.751244, 37.618423, '{"mon-fri": "9:00-18:00"}')
             RETURNING opp_id`
        );
        testData.opps.opp1 = opp1.rows[0].opp_id;

        const opp2 = await client.query(
            `INSERT INTO opp (address, latitude, longitude, work_time)
             VALUES ('ПВЗ-2 ул. Пушкина 2', 55.755826, 37.617300, '{"mon-fri": "9:00-18:00"}')
             RETURNING opp_id`
        );
        testData.opps.opp2 = opp2.rows[0].opp_id;

        const opp3 = await client.query(
            `INSERT INTO opp (address, latitude, longitude, work_time)
             VALUES ('ПВЗ-3 ул. Гагарина 3', 55.758998, 37.620407, '{"mon-fri": "9:00-18:00"}')
             RETURNING opp_id`
        );
        testData.opps.opp3 = opp3.rows[0].opp_id;

        // 3. Создаем магазины
        const shop1 = await client.query(
            `INSERT INTO shops (name, description, owner_id)
             VALUES ('Магазин продавца 1', 'Описание магазина 1', $1)
             RETURNING shop_id`,
            [testData.users.seller1]
        );
        testData.shops.shop1 = shop1.rows[0].shop_id;

        const shop2 = await client.query(
            `INSERT INTO shops (name, description, owner_id)
             VALUES ('Магазин продавца 2', 'Описание магазина 2', $1)
             RETURNING shop_id`,
            [testData.users.seller2]
        );
        testData.shops.shop2 = shop2.rows[0].shop_id;

        // 4. Создаем категории товаров
        const category1 = await client.query(
            `INSERT INTO product_categories (name)
             VALUES ('Компьютеры')
             RETURNING category_id`
        );
        testData.categories = testData.categories || {};
        testData.categories.computers = category1.rows[0].category_id;

        const category2 = await client.query(
            `INSERT INTO product_categories (name)
             VALUES ('Периферия')
             RETURNING category_id`
        );
        testData.categories.peripherals = category2.rows[0].category_id;

        // 5. Создаем товары
        const product1 = await client.query(
            `INSERT INTO products (name, description, price, count, shop_id, category_id, photos)
             VALUES ('Ноутбук', 'Игровой ноутбук', 50000, 100, $1, $2, '["laptop.jpg"]')
             RETURNING product_id`,
            [testData.shops.shop1, testData.categories.computers]
        );
        testData.products.laptop = product1.rows[0].product_id;

        const product2 = await client.query(
            `INSERT INTO products (name, description, price, count, shop_id, category_id, photos)
             VALUES ('Мышь', 'Игровая мышь', 2000, 100, $1, $2, '["mouse.jpg"]')
             RETURNING product_id`,
            [testData.shops.shop1, testData.categories.peripherals]
        );
        testData.products.mouse = product2.rows[0].product_id;

        const product3 = await client.query(
            `INSERT INTO products (name, description, price, count, shop_id, category_id, photos)
             VALUES ('Клавиатура', 'Механическая клавиатура', 3000, 100, $1, $2, '["keyboard.jpg"]')
             RETURNING product_id`,
            [testData.shops.shop2, testData.categories.peripherals]
        );
        testData.products.keyboard = product3.rows[0].product_id;

        await client.query('COMMIT');
        success(`Тестовые данные: buyer=${testData.users.buyer}, seller1=${testData.users.seller1}, seller2=${testData.users.seller2}`);
        success(`ПВЗ: opp1=${testData.opps.opp1}, opp2=${testData.opps.opp2}, opp3=${testData.opps.opp3}`);
        success(`Товары: laptop=${testData.products.laptop}, mouse=${testData.products.mouse}, keyboard=${testData.products.keyboard}`);
    } catch (err) {
        await client.query('ROLLBACK');
        error('Ошибка при создании тестовых данных: ' + err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Подготовка к сценарию
 */
async function prepareScenario(scenarioName) {
    section(scenarioName);
    log('Подготовка...', colors.magenta);
    await clearDatabase();
    await createTestData();
}

/**
 * Сценарий 1: Полный успешный флоу заказа
 */
async function scenario1_SuccessfulOrder() {
    await prepareScenario('СЦЕНАРИЙ 1: Полный успешный флоу заказа');

    try {
        // Шаг 1: Создание заказа
        step('1. Создание заказа (2 ноутбука)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp3, // Целевой ПВЗ
            [
                {product_id: testData.products.laptop, count: 2}
            ]
        );
        testData.orders.order1 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);
        log(JSON.stringify(order.products[0].status_info.current_distribution, null, 2), colors.yellow);

        // Шаг 2: Продавец приносит товары в ПВЗ-1
        step('2. Продавец приносит 2 ноутбука в ПВЗ-1');
        const receive1 = await ordersService.orderReceiveProduct(
            order.order_id,
            testData.products.laptop,
            2,
            testData.opps.opp1
        );
        success('Товары приняты в ПВЗ-1');
        log(JSON.stringify(receive1.data.logistics_info, null, 2), colors.yellow);

        // Шаг 3: Проверяем распределение
        step('3. Проверка текущего распределения товара');
        const status1 = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log(JSON.stringify(status1.data.current_distribution, null, 2), colors.yellow);

        // Шаг 4: ПВЗ передает товары в логистику
        step('4. ПВЗ-1 передает товары логисту');
        const logisticsOrderId = receive1.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id;
        const giveToDelivery = await ordersService.giveProductToDelivery(
            order.order_id,
            logisticsOrderId,
            testData.products.laptop,
            2,
            testData.opps.opp1
        );
        success(`Товары переданы в логистический заказ ${logisticsOrderId}`);

        // Шаг 5: Проверяем распределение после передачи в логистику
        step('5. Проверка распределения (товары в пути)');
        const status2 = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log(JSON.stringify(status2.data.current_distribution, null, 2), colors.yellow);

        // Шаг 6: Логист доставил товары в ПВЗ-3 (целевой)
        step('6. Логист доставил товары в ПВЗ-3 (целевой)');
        const receiveFromLogistics = await ordersService.receiveProductFromLogistics(logisticsOrderId);
        success('Товары получены в целевом ПВЗ-3');
        log(JSON.stringify(receiveFromLogistics.data, null, 2), colors.yellow);

        // Шаг 7: Проверяем распределение в целевом ПВЗ
        step('7. Проверка распределения (товары в целевом ПВЗ)');
        const status3 = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log(JSON.stringify(status3.data.current_distribution, null, 2), colors.yellow);

        // Шаг 8: Выдача заказа покупателю
        step('8. Выдача заказа покупателю из ПВЗ-3');
        const delivery = await ordersService.deliverOrder(order.order_id, testData.opps.opp3);
        success(`Заказ выдан: ${delivery.data.message}`);
        log(JSON.stringify(delivery.data, null, 2), colors.yellow);

        // Шаг 9: Финальная проверка распределения
        step('9. Финальная проверка распределения');
        const finalStatus = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log(JSON.stringify(finalStatus.data.current_distribution, null, 2), colors.yellow);

        success('✓ СЦЕНАРИЙ 1 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 1: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Сценарий 2: Отмена заказа на этапе waiting_for_product_arrival_in_opp
 */
async function scenario2_CancelBeforeArrival() {
    await prepareScenario('СЦЕНАРИЙ 2: Отмена заказа до прихода товаров');

    try {
        step('1. Создание заказа (1 мышь)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp2,
            [{product_id: testData.products.mouse, count: 1}]
        );
        testData.orders.order2 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Отмена заказа (товары еще не приняты в ПВЗ)');
        const cancel = await ordersService.cancelOrder(order.order_id, 'Передумал покупать');
        success('Заказ отменен');
        log(JSON.stringify(cancel.data, null, 2), colors.yellow);

        step('3. Проверка распределения после отмены');
        const status = await ordersService.getProductStatuses(testData.products.mouse, order.order_id);
        log(JSON.stringify(status.data.current_distribution, null, 2), colors.yellow);

        success('✓ СЦЕНАРИЙ 2 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 2: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Сценарий 3: Отмена заказа когда товары в at_start_opp
 */
async function scenario3_CancelAtStartOpp() {
    await prepareScenario('СЦЕНАРИЙ 3: Отмена заказа когда товары в исходном ПВЗ');

    try {
        step('1. Создание заказа (2 мыши)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp3,
            [{product_id: testData.products.mouse, count: 2}]
        );
        testData.orders.order3 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Продавец приносит товары в ПВЗ-1');
        await ordersService.orderReceiveProduct(order.order_id, testData.products.mouse, 2, testData.opps.opp1);
        success('Товары приняты в ПВЗ-1');

        step('3. Проверка распределения (at_start_opp)');
        const status1 = await ordersService.getProductStatuses(testData.products.mouse, order.order_id);
        log(JSON.stringify(status1.data.current_distribution, null, 2), colors.yellow);

        step('4. Отмена заказа');
        const cancel = await ordersService.cancelOrder(order.order_id, 'Отмена на этапе at_start_opp');
        success('Заказ отменен, созданы обратные заказы');
        log(JSON.stringify(cancel.data.return_orders, null, 2), colors.yellow);

        step('5. Проверка распределения после отмены');
        const status2 = await ordersService.getProductStatuses(testData.products.mouse, order.order_id);
        log(JSON.stringify(status2.data.current_distribution, null, 2), colors.yellow);

        success('✓ СЦЕНАРИЙ 3 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 3: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Сценарий 4: Отмена заказа когда товары в логистике
 */
async function scenario4_CancelInTransit() {
    await prepareScenario('СЦЕНАРИЙ 4: Отмена заказа когда товары в пути');

    try {
        step('1. Создание заказа (1 клавиатура)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp3,
            [{product_id: testData.products.keyboard, count: 1}]
        );
        testData.orders.order4 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Продавец 2 приносит клавиатуру в ПВЗ-2');
        const receive = await ordersService.orderReceiveProduct(
            order.order_id,
            testData.products.keyboard,
            1,
            testData.opps.opp2
        );
        success('Клавиатура принята в ПВЗ-2');

        step('3. ПВЗ-2 передает товар логисту');
        const logisticsOrderId = receive.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id;
        await ordersService.giveProductToDelivery(
            order.order_id,
            logisticsOrderId,
            testData.products.keyboard,
            1,
            testData.opps.opp2
        );
        success(`Товар передан в логистический заказ ${logisticsOrderId}`);

        step('4. Проверка распределения (sent_to_logistics)');
        const status1 = await ordersService.getProductStatuses(testData.products.keyboard, order.order_id);
        log(JSON.stringify(status1.data.current_distribution, null, 2), colors.yellow);

        step('5. Отмена заказа когда товар в пути');
        const cancel = await ordersService.cancelOrder(order.order_id, 'Отмена когда товар в логистике');
        success('Заказ отменен, созданы обратные заказы');
        log(JSON.stringify(cancel.data.return_orders, null, 2), colors.yellow);

        step('6. Проверка распределения после отмены');
        const status2 = await ordersService.getProductStatuses(testData.products.keyboard, order.order_id);
        log(JSON.stringify(status2.data.current_distribution, null, 2), colors.yellow);

        step('7. Проверка распределения обратного заказа');
        const status3 = await ordersService.getProductStatuses(testData.products.keyboard, cancel.data.return_orders[0].order_id);
        log(JSON.stringify(status3.data.current_distribution, null, 2), colors.yellow);


        success('✓ СЦЕНАРИЙ 4 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 4: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Сценарий 5: Выдача заказа с отклонением некоторых товаров
 */
async function scenario5_DeliveryWithRejection() {
    await prepareScenario('СЦЕНАРИЙ 5: Выдача заказа с отклонением товаров');

    try {
        step('1. Создание заказа (3 ноутбука + 2 мыши от одного продавца)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp2,
            [
                {product_id: testData.products.laptop, count: 3},
                {product_id: testData.products.mouse, count: 2}
            ]
        );
        testData.orders.order5 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Продавец 1 приносит все товары в ПВЗ-1');
        await ordersService.orderReceiveProduct(order.order_id, testData.products.laptop, 3, testData.opps.opp1);
        let logRes = await ordersService.orderReceiveProduct(order.order_id, testData.products.mouse, 2, testData.opps.opp1);
        success('Все товары приняты в ПВЗ-1');

        step('3. Формирование логистики и отправка');

        await ordersService.giveProductToDelivery(
            order.order_id,
            logRes.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id,
            testData.products.laptop,
            3,
            testData.opps.opp1
        );
        await ordersService.giveProductToDelivery(
            order.order_id,
            logRes.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id,
            testData.products.mouse,
            2,
            testData.opps.opp1
        );

        let giveToOppRes = await outerLogisticsService.addProductsToOpp(logRes.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id)


        step('4. Проверка распределения перед выдачей');
        const status2 = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log('Ноутбуки:', colors.yellow);
        log(JSON.stringify(status2.data.current_distribution, null, 2), colors.yellow);
        const status3 = await ordersService.getProductStatuses(testData.products.mouse, order.order_id);
        log('Мыши:', colors.yellow);
        log(JSON.stringify(status3.data.current_distribution, null, 2), colors.yellow);

        step('5. Выдача заказа с отклонением (1 ноутбук не понравился)');
        const delivery = await ordersService.deliverOrder(
            order.order_id,
            testData.opps.opp2,
            [
                {product_id: testData.products.laptop, count: 1} // Отклоняем 1 ноутбук
            ]
        );
        success('Заказ выдан частично');
        log(JSON.stringify(delivery.data, null, 2), colors.yellow);

        step('6. Проверка распределения после выдачи');
        const finalStatus1 = await ordersService.getProductStatuses(testData.products.laptop, order.order_id);
        log('Ноутбуки (2 выдано, 1 возврат):', colors.yellow);
        log(JSON.stringify(finalStatus1.data.current_distribution, null, 2), colors.yellow);

        const finalStatus2 = await ordersService.getProductStatuses(testData.products.mouse, order.order_id);
        log('Мыши (все выданы):', colors.yellow);
        log(JSON.stringify(finalStatus2.data.current_distribution, null, 2), colors.yellow);

        success('✓ СЦЕНАРИЙ 5 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 5: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Сценарий 6: Смешанный заказ (товары от разных продавцов, разные ПВЗ)
 */
async function scenario6_MixedOrder() {
    await prepareScenario('СЦЕНАРИЙ 6: Смешанный заказ (разные продавцы, разные ПВЗ)');

    try {
        step('1. Создание заказа (ноутбук + клавиатура от разных продавцов)');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp3, // Целевой ПВЗ
            [
                {product_id: testData.products.laptop, count: 1},    // Продавец 1
                {product_id: testData.products.keyboard, count: 1}   // Продавец 2
            ]
        );
        testData.orders.order6 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Продавец 1 приносит ноутбук в ПВЗ-1');
        await ordersService.orderReceiveProduct(order.order_id, testData.products.laptop, 1, testData.opps.opp1);
        success('Ноутбук принят в ПВЗ-1');

        step('3. Продавец 2 приносит клавиатуру в ПВЗ-2');
        await ordersService.orderReceiveProduct(order.order_id, testData.products.keyboard, 1, testData.opps.opp2);
        success('Клавиатура принята в ПВЗ-2');

        step('4. Проверка логистических заказов');
        log('Созданные логистические заказы:', colors.yellow);
        for (const [logId, logOrder] of Object.entries(outerLogisticsService._logisticsOrders)) {
            log(`  Логистический заказ ${logId}: ПВЗ-${logOrder.sourceOppId} → ПВЗ-${logOrder.targetOppId}`, colors.yellow);
            log(`    Товаров: ${logOrder.products.length}`, colors.yellow);
        }

        step('5. Отмена заказа (проверка создания обратных заказов для разных продавцов)');
        const cancel = await ordersService.cancelOrder(order.order_id, 'Смешанная отмена');
        success('Заказ отменен');
        log(`Создано обратных заказов: ${cancel.data.return_orders.length}`, colors.yellow);
        log(JSON.stringify(cancel.data.return_orders, null, 2), colors.yellow);

        success('✓ СЦЕНАРИЙ 6 ЗАВЕРШЕН УСПЕШНО');
    } catch (err) {
        error(`Ошибка в сценарии 6: ${err.message}`);
        console.error(err);
        throw err;
    }
}

/**
 * Главная функция запуска всех сценариев
 */
async function main() {
    log('\n' + '█'.repeat(80), colors.bright + colors.green);
    log('  ТЕСТИРОВАНИЕ СИСТЕМЫ ЗАКАЗОВ И ЛОГИСТИКИ', colors.bright + colors.green);
    log('█'.repeat(80) + '\n', colors.bright + colors.green);

    const scenarios = [
        {name: 'Сценарий 1', fn: scenario1_SuccessfulOrder},
        {name: 'Сценарий 2', fn: scenario2_CancelBeforeArrival},
        {name: 'Сценарий 3', fn: scenario3_CancelAtStartOpp},
        {name: 'Сценарий 4', fn: scenario4_CancelInTransit},
        {name: 'Сценарий 5', fn: scenario5_DeliveryWithRejection},
        {name: 'Сценарий 6', fn: scenario6_MixedOrder},
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const scenario of scenarios) {
        try {
            await scenario.fn();
            passedCount++;
        } catch (err) {
            error(`\n${scenario.name} провален!`);
            failedCount++;
        }
    }

    // Финальная очистка
    section('Финальная очистка');
    await clearDatabase();

    // Итоги
    log('\n' + '█'.repeat(80), colors.bright);
    if (failedCount === 0) {
        log(`  ВСЕ ${passedCount} ТЕСТОВ ЗАВЕРШЕНЫ УСПЕШНО! ✓`, colors.bright + colors.green);
    } else {
        log(`  ЗАВЕРШЕНО: ${passedCount} успешно, ${failedCount} провалено`, colors.bright + colors.yellow);
    }
    log('█'.repeat(80) + '\n', colors.bright);

    // Закрываем пул соединений
    await Database.pool.end();
    process.exit(failedCount > 0 ? 1 : 0);
}

// Запуск
main();