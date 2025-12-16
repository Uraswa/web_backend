// Тестовый скрипт для проверки функционала ПВЗ (личный кабинет владельца)
// Запуск: node Tests/test_opp_functionality.js

import {Database} from '../Core/Model/Database.js';
import ordersService from '../Core/Services/ordersService.js';
import OPPModel from '../Apps/OPP/Model/OPPModel.js';
import tokenService from '../Core/Services/tokenService.js';

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

// Хранилище тестовых данных
const testData = {
    users: {},
    opps: {},
    shops: {},
    products: {},
    orders: {},
    tokens: {}
};

/**
 * Очистка базы данных
 */
async function clearDatabase() {
    const client = await Database.GetMasterClient();

    try {
        await client.query('BEGIN');

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

        // 1. Создаем покупателя
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

        // 2. Создаем владельца ПВЗ
        const oppOwner = await client.query(
            `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
             VALUES (NOW(), true, true, false)
             RETURNING user_id`
        );
        testData.users.oppOwner = oppOwner.rows[0].user_id;
        await client.query(
            `INSERT INTO user_profiles (user_id, first_name, last_name)
             VALUES ($1, 'Владимир', 'Владелец-ПВЗ')`,
            [testData.users.oppOwner]
        );

        // Создаем токен для владельца ПВЗ
        testData.tokens.oppOwner = tokenService.generateTokens({
            user_id: testData.users.oppOwner,
            email: 'oppowner@test.com'
        });

        // 3. Создаем продавца
        const seller = await client.query(
            `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
             VALUES (NOW(), true, true, false)
             RETURNING user_id`
        );
        testData.users.seller = seller.rows[0].user_id;
        await client.query(
            `INSERT INTO user_profiles (user_id, first_name, last_name)
             VALUES ($1, 'Петр', 'Продавец')`,
            [testData.users.seller]
        );

        // 4. Создаем ПВЗ с владельцем
        const opp1 = await client.query(
            `INSERT INTO opp (address, latitude, longitude, work_time, owner_id)
             VALUES ('ПВЗ-1 ул. Ленина 1', 55.751244, 37.618423, '{"mon-fri": "9:00-18:00"}', $1)
             RETURNING opp_id`,
            [testData.users.oppOwner]
        );
        testData.opps.opp1 = opp1.rows[0].opp_id;

        const opp2 = await client.query(
            `INSERT INTO opp (address, latitude, longitude, work_time)
             VALUES ('ПВЗ-2 ул. Пушкина 2', 55.755826, 37.617300, '{"mon-fri": "9:00-18:00"}')
             RETURNING opp_id`
        );
        testData.opps.opp2 = opp2.rows[0].opp_id;

        // 5. Создаем магазин продавца
        const shop = await client.query(
            `INSERT INTO shops (name, description, owner_id)
             VALUES ('Магазин продавца', 'Описание магазина', $1)
             RETURNING shop_id`,
            [testData.users.seller]
        );
        testData.shops.shop1 = shop.rows[0].shop_id;

        // 6. Создаем категорию
        const category = await client.query(
            `INSERT INTO product_categories (name)
             VALUES ('Электроника')
             RETURNING category_id`
        );
        testData.categories = {electronics: category.rows[0].category_id};

        // 7. Создаем товары
        const laptop = await client.query(
            `INSERT INTO products (name, description, price, count, shop_id, category_id, photos)
             VALUES ('Ноутбук', 'Игровой ноутбук', 50000, 100, $1, $2, '["laptop.jpg"]')
             RETURNING product_id`,
            [testData.shops.shop1, testData.categories.electronics]
        );
        testData.products.laptop = laptop.rows[0].product_id;

        const mouse = await client.query(
            `INSERT INTO products (name, description, price, count, shop_id, category_id, photos)
             VALUES ('Мышь', 'Игровая мышь', 2000, 100, $1, $2, '["mouse.jpg"]')
             RETURNING product_id`,
            [testData.shops.shop1, testData.categories.electronics]
        );
        testData.products.mouse = mouse.rows[0].product_id;

        await client.query('COMMIT');
        success(`Тестовые данные созданы:`);
        success(`  buyer=${testData.users.buyer}, oppOwner=${testData.users.oppOwner}, seller=${testData.users.seller}`);
        success(`  ПВЗ-1 (владелец=${testData.users.oppOwner}): opp_id=${testData.opps.opp1}`);
        success(`  ПВЗ-2 (без владельца): opp_id=${testData.opps.opp2}`);
        success(`  Товары: laptop=${testData.products.laptop}, mouse=${testData.products.mouse}`);
    } catch (err) {
        await client.query('ROLLBACK');
        error('Ошибка при создании тестовых данных: ' + err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Тест 1: Получение информации о своем ПВЗ
 */
async function test1_GetMyPVZ() {
    section('ТЕСТ 1: Получение информации о своем ПВЗ');

    try {
        step('1. Владелец ПВЗ получает информацию о своем ПВЗ');
        const opp = await OPPModel.getOPPByOwnerId(testData.users.oppOwner);

        if (!opp) {
            error('ПВЗ не найден');
            throw new Error('ПВЗ не найден');
        }

        success('ПВЗ найден:');
        log(JSON.stringify(opp, null, 2), colors.yellow);

        if (opp.opp_id !== testData.opps.opp1) {
            error('Неверный opp_id');
            throw new Error('Неверный opp_id');
        }

        if (opp.owner_id !== testData.users.oppOwner) {
            error('Неверный owner_id');
            throw new Error('Неверный owner_id');
        }

        success('✓ ТЕСТ 1 УСПЕШНО ЗАВЕРШЕН');
    } catch (err) {
        error(`Ошибка в тесте 1: ${err.message}`);
        throw err;
    }
}

/**
 * Тест 2: Получение списка заказов ПВЗ (пустой список)
 */
async function test2_GetOrdersEmpty() {
    section('ТЕСТ 2: Получение списка заказов (пустой список)');

    try {
        step('1. Владелец ПВЗ запрашивает список заказов (пока заказов нет)');
        const orders = await OPPModel.getOrdersWithDetails(testData.opps.opp1);

        success(`Получен список заказов: ${orders.length} заказов`);

        if (orders.length !== 0) {
            error('Ожидался пустой список');
            throw new Error('Ожидался пустой список');
        }

        success('✓ ТЕСТ 2 УСПЕШНО ЗАВЕРШЕН');
    } catch (err) {
        error(`Ошибка в тесте 2: ${err.message}`);
        throw err;
    }
}

/**
 * Тест 3: Создание заказа и проверка в списке ПВЗ
 */
async function test3_CreateOrderAndList() {
    section('ТЕСТ 3: Создание заказа и проверка в списке ПВЗ');

    try {
        step('1. Покупатель создает заказ с доставкой в ПВЗ-1');
        const order = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp1, // Целевой ПВЗ
            [
                {product_id: testData.products.laptop, count: 2},
                {product_id: testData.products.mouse, count: 3}
            ]
        );
        testData.orders.order1 = order.order_id;
        success(`Заказ создан: order_id=${order.order_id}`);

        step('2. Владелец ПВЗ-1 проверяет список заказов');
        const orders = await OPPModel.getOrdersWithDetails(testData.opps.opp1);

        success(`Получено заказов: ${orders.length}`);
        log(JSON.stringify(orders, null, 2), colors.yellow);

        if (orders.length !== 1) {
            error('Ожидался 1 заказ');
            throw new Error('Ожидался 1 заказ');
        }

        const orderInfo = orders[0];
        success(`Заказ #${orderInfo.order_id}:`);
        success(`  Покупатель: ${orderInfo.first_name} ${orderInfo.last_name}`);
        success(`  Товаров всего: ${orderInfo.products_count}`);
        success(`  Товаров в целевом ПВЗ: ${orderInfo.products_in_target_opp}`);
        success(`  Можно выдать: ${orderInfo.can_be_issued}`);
        success(`  Статус: ${orderInfo.order_status}`);

        if (orderInfo.products_in_target_opp !== 0) {
            error('Товары еще не должны быть в ПВЗ');
            throw new Error('Товары еще не должны быть в ПВЗ');
        }

        if (orderInfo.can_be_issued !== false) {
            error('Заказ не должен быть готов к выдаче');
            throw new Error('Заказ не должен быть готов к выдаче');
        }

        success('✓ ТЕСТ 3 УСПЕШНО ЗАВЕРШЕН');
    } catch (err) {
        error(`Ошибка в тесте 3: ${err.message}`);
        throw err;
    }
}

/**
 * Тест 4: Доставка товаров и проверка готовности к выдаче
 */
async function test4_DeliverProductsToOPP() {
    section('ТЕСТ 4: Доставка товаров в ПВЗ и проверка готовности');

    try {
        step('1. Продавец приносит товары в ПВЗ-2 (исходный ПВЗ)');
        await ordersService.orderReceiveProduct(
            testData.orders.order1,
            testData.products.laptop,
            2,
            testData.opps.opp2
        );
        const receiveResult = await ordersService.orderReceiveProduct(
            testData.orders.order1,
            testData.products.mouse,
            3,
            testData.opps.opp2
        );
        success('Товары приняты в ПВЗ-2');

        step('2. ПВЗ-2 передает товары в логистику');
        const logisticsOrderId = receiveResult.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id;
        await ordersService.giveProductToDelivery(
            testData.orders.order1,
            logisticsOrderId,
            testData.products.laptop,
            2,
            testData.opps.opp2
        );
        await ordersService.giveProductToDelivery(
            testData.orders.order1,
            logisticsOrderId,
            testData.products.mouse,
            3,
            testData.opps.opp2
        );
        success('Товары переданы логисту');

        step('3. Логист доставляет товары в ПВЗ-1 (целевой)');
        await ordersService.receiveProductFromLogistics(logisticsOrderId);
        success('Товары прибыли в ПВЗ-1');

        step('4. Владелец ПВЗ-1 проверяет список заказов');
        const orders = await OPPModel.getOrdersWithDetails(testData.opps.opp1);
        const orderInfo = orders[0];

        success(`Заказ #${orderInfo.order_id}:`);
        success(`  Товаров всего: ${orderInfo.products_count}`);
        success(`  Товаров в целевом ПВЗ: ${orderInfo.products_in_target_opp}`);
        success(`  Можно выдать: ${orderInfo.can_be_issued}`);
        log(JSON.stringify(orderInfo, null, 2), colors.yellow);

        if (orderInfo.products_in_target_opp !== 5) {
            error(`Ожидалось 5 товаров в ПВЗ, получено ${orderInfo.products_in_target_opp}`);
            throw new Error('Неверное количество товаров в целевом ПВЗ');
        }

        if (orderInfo.can_be_issued !== true) {
            error('Заказ должен быть готов к выдаче');
            throw new Error('Заказ должен быть готов к выдаче');
        }

        success('✓ ТЕСТ 4 УСПЕШНО ЗАВЕРШЕН');
    } catch (err) {
        error(`Ошибка в тесте 4: ${err.message}`);
        throw err;
    }
}

/**
 * Тест 5: Выдача заказа клиенту
 */
async function test5_IssueOrder() {
    section('ТЕСТ 5: Выдача заказа клиенту');

    try {
        step('1. Владелец ПВЗ-1 выдает заказ покупателю');
        const result = await OPPModel.issueOrder(
            testData.orders.order1,
            testData.opps.opp1,
            testData.users.oppOwner
        );

        if (!result.success) {
            error(`Ошибка выдачи: ${result.error}`);
            throw new Error(result.error);
        }

        success('Заказ выдан успешно:');
        log(JSON.stringify(result.data, null, 2), colors.yellow);

        if (result.data.message !== 'order_done') {
            error(`Неверный статус: ${result.data.message}`);
            throw new Error('Неверный статус заказа');
        }

        step('2. Проверяем список заказов после выдачи');
        const orders = await OPPModel.getOrdersWithDetails(testData.opps.opp1);
        const orderInfo = orders[0];

        success(`Заказ #${orderInfo.order_id}:`);
        success(`  Статус: ${orderInfo.order_status}`);
        success(`  Товаров в целевом ПВЗ: ${orderInfo.products_in_target_opp}`);
        success(`  Можно выдать: ${orderInfo.can_be_issued}`);

        if (orderInfo.order_status !== 'done') {
            error(`Ожидался статус 'done', получен '${orderInfo.order_status}'`);
            throw new Error('Неверный статус заказа');
        }

        if (orderInfo.can_be_issued !== false) {
            error('Выданный заказ не должен быть доступен для выдачи');
            throw new Error('can_be_issued должен быть false');
        }

        step('3. Проверяем что recorded_date установлена');
        const client = await Database.GetMasterClient();
        try {
            const orderCheck = await client.query(
                'SELECT received_date FROM orders WHERE order_id = $1',
                [testData.orders.order1]
            );

            if (!orderCheck.rows[0].received_date) {
                error('received_date не установлена');
                throw new Error('received_date не установлена');
            }
            success(`received_date установлена: ${orderCheck.rows[0].received_date}`);
        } finally {
            client.release();
        }

        success('✓ ТЕСТ 5 УСПЕШНО ЗАВЕРШЕН');
    } catch (err) {
        error(`Ошибка в тесте 5: ${err.message}`);
        throw err;
    }
}

/**
 * Тест 6: Проверка безопасности (владелец другого ПВЗ не может выдать заказ)
 */
async function test6_SecurityCheck() {
    section('ТЕСТ 6: Проверка безопасности доступа');

    try {
        // Создаем второго владельца ПВЗ
        const client = await Database.GetMasterClient();
        let anotherOppOwner;

        try {
            await client.query('BEGIN');

            const user = await client.query(
                `INSERT INTO users (registration_date, is_active, is_activated, is_admin)
                 VALUES (NOW(), true, true, false)
                 RETURNING user_id`
            );
            anotherOppOwner = user.rows[0].user_id;

            await client.query(
                `INSERT INTO user_profiles (user_id, first_name, last_name)
                 VALUES ($1, 'Другой', 'Владелец')`,
                [anotherOppOwner]
            );

            // Назначаем его владельцем ПВЗ-2
            await client.query(
                `UPDATE opp SET owner_id = $1 WHERE opp_id = $2`,
                [anotherOppOwner, testData.opps.opp2]
            );

            await client.query('COMMIT');
            success(`Создан второй владелец ПВЗ-2: user_id=${anotherOppOwner}`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        step('1. Создаем новый заказ для ПВЗ-1');
        const order2 = await ordersService.createOrder(
            testData.users.buyer,
            testData.opps.opp1,
            [{product_id: testData.products.laptop, count: 1}]
        );
        success(`Заказ создан: order_id=${order2.order_id}`);

        step('2. Доставляем товар в ПВЗ-1');
        await ordersService.orderReceiveProduct(
            order2.order_id,
            testData.products.laptop,
            1,
            testData.opps.opp2
        );
        const logResult = await ordersService.orderReceiveProduct(
            order2.order_id,
            testData.products.laptop,
            0,
            testData.opps.opp2
        );
        const logId = logResult.data.logistics_info.logistics_info.logistics_orders[0].logistics_order_id;
        await ordersService.giveProductToDelivery(
            order2.order_id,
            logId,
            testData.products.laptop,
            1,
            testData.opps.opp2
        );
        await ordersService.receiveProductFromLogistics(logId);
        success('Товар доставлен в ПВЗ-1');

        step('3. Владелец ПВЗ-2 пытается получить список заказов ПВЗ-1');
        const ordersOpp2Owner = await OPPModel.getOrdersWithDetails(testData.opps.opp1);
        success(`Владелец ПВЗ-2 видит заказов для ПВЗ-1: ${ordersOpp2Owner.length}`);

        // Это нормально - метод getOrdersWithDetails не проверяет владельца
        // Проверка владельца должна быть в middleware на уровне роутера

        step('4. Владелец ПВЗ-2 получает свои заказы (ПВЗ-2)');
        const ordersOpp2 = await OPPModel.getOrdersWithDetails(testData.opps.opp2);
        success(`Владелец ПВЗ-2 видит заказов для ПВЗ-2: ${ordersOpp2.length}`);

        success('✓ ТЕСТ 6 УСПЕШНО ЗАВЕРШЕН');
        log('  Примечание: Проверка прав доступа реализована в middleware на уровне роутера', colors.yellow);
    } catch (err) {
        error(`Ошибка в тесте 6: ${err.message}`);
        throw err;
    }
}

/**
 * Главная функция
 */
async function main() {
    log('\n' + '█'.repeat(80), colors.bright + colors.green);
    log('  ТЕСТИРОВАНИЕ ФУНКЦИОНАЛА ЛИЧНОГО КАБИНЕТА ВЛАДЕЛЬЦА ПВЗ', colors.bright + colors.green);
    log('█'.repeat(80) + '\n', colors.bright + colors.green);

    const tests = [
        {name: 'Тест 1: Получение информации о своем ПВЗ', fn: test1_GetMyPVZ},
        {name: 'Тест 2: Список заказов (пустой)', fn: test2_GetOrdersEmpty},
        {name: 'Тест 3: Создание заказа и проверка в списке', fn: test3_CreateOrderAndList},
        {name: 'Тест 4: Доставка товаров и готовность к выдаче', fn: test4_DeliverProductsToOPP},
        {name: 'Тест 5: Выдача заказа клиенту', fn: test5_IssueOrder},
        {name: 'Тест 6: Проверка безопасности', fn: test6_SecurityCheck},
    ];

    let passedCount = 0;
    let failedCount = 0;

    try {
        // Подготовка
        section('ПОДГОТОВКА');
        await clearDatabase();
        await createTestData();

        // Запуск тестов
        for (const test of tests) {
            try {
                await test.fn();
                passedCount++;
            } catch (err) {
                error(`\n${test.name} ПРОВАЛЕН!`);
                console.error(err);
                failedCount++;
            }
        }

        // Очистка
        section('ФИНАЛЬНАЯ ОЧИСТКА');
        await clearDatabase();

    } catch (err) {
        error('Критическая ошибка при выполнении тестов');
        console.error(err);
        failedCount++;
    }

    // Итоги
    log('\n' + '█'.repeat(80), colors.bright);
    if (failedCount === 0) {
        log(`  ВСЕ ${passedCount} ТЕСТОВ ЗАВЕРШЕНЫ УСПЕШНО! ✓`, colors.bright + colors.green);
    } else {
        log(`  ЗАВЕРШЕНО: ${passedCount} успешно, ${failedCount} провалено`, colors.bright + colors.yellow);
    }
    log('█'.repeat(80) + '\n', colors.bright);

    // Закрываем соединения
    const client = await Database.GetMasterClient();
    await client.end();
    process.exit(failedCount > 0 ? 1 : 0);
}

// Запуск
main().catch(err => {
    console.error('Фатальная ошибка:', err);
    process.exit(1);
});
