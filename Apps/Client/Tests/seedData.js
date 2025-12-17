import {Database} from '../../../Core/Model/Database.js';
import tokenService from "../../../Core/Services/tokenService.js";

export const seedData = async () => {
    const client = await Database.GetMasterClient();

    try {
        await client.query('BEGIN');

        // 1. Создаем пользователя
        const userResult = await client.query(`
            INSERT INTO users (registration_date, is_active, is_activated)
            VALUES (NOW(), true, true)
            RETURNING user_id
        `);
        const userId = userResult.rows[0].user_id;


        // 3. Добавляем профиль пользователя
        await client.query(`
            INSERT INTO user_profiles (user_id, first_name, last_name)
            VALUES ($1, 'Test', 'User')
        `, [userId]);

        // 4. Создаем категории товаров
        const categories = [
            {name: 'Электроника', parent_id: null, parent_index: null},
            {name: 'Смартфоны', parent_id: 1, parent_index: 0},
            {name: 'Ноутбуки', parent_id: 1, parent_index: 0},
            {name: 'Одежда', parent_id: null, parent_index: null},
            {name: 'Обувь', parent_id: 4, parent_index: 3}
        ];

        let currentCategoryIndex = 0;
        for (const category of categories) {
            const categoryResult = await client.query(`
                INSERT INTO product_categories (name, parent_category_id)
                VALUES ($1, $2)
                RETURNING category_id
            `, [category.name, category.parent_id]);

            for (const category1 of categories) {
                if (category1.parent_index === currentCategoryIndex) {
                    category1.parent_id = categoryResult.rows[0].category_id
                }
            }

            if (category.name === 'Смартфоны') {
                global.testCategoryId = categoryResult.rows[0].category_id;
            }

            category.category_id = categoryResult.rows[0].category_id;

            currentCategoryIndex++;
        }

        // 5. Создаем магазин
        const shopResult = await client.query(`
            INSERT INTO shops (owner_id, name, description)
            VALUES ($1, 'Test Shop', 'Магазин для тестирования')
            RETURNING shop_id
        `, [userId]);
        const shopId = shopResult.rows[0].shop_id;
        global.testShopId = shopId;

        // 6. Создаем товары
        const products = [
            {
                category_id: categories[1].category_id,
                shop_id: shopId,
                name: 'iPhone 13 Pro',
                description: 'Смартфон Apple',
                photos: '["iphone.jpg"]',
                price: 89999.99
            },
            {
                category_id: categories[1].category_id,
                shop_id: shopId,
                name: 'Samsung Galaxy S21',
                description: 'Смартфон Samsung',
                photos: '["samsung.jpg"]',
                price: 69999.99
            },
            {
                category_id: categories[2].category_id, // Ноутбуки
                shop_id: shopId,
                name: 'MacBook Pro',
                description: 'Ноутбук Apple',
                photos: '["macbook.jpg"]',
                price: 149999.99
            }
        ];

        for (const product of products) {
            const productResult = await client.query(`
                INSERT INTO products (category_id, shop_id, name, description, photos, price)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING product_id
            `, [
                product.category_id,
                product.shop_id,
                product.name,
                product.description,
                product.photos,
                product.price
            ]);

            if (product.name === 'iPhone 13 Pro') {
                global.testProductId = productResult.rows[0].product_id;
            }
        }

        // 7. Создаем ПВЗ
        const oppResult = await client.query(`
            INSERT INTO opp (address, latitude, longitude, enabled, work_time)
            VALUES ('Тестовый адрес, 123', 55.7558, 37.6176, true, '{"mon": "09:00-20:00"}')
            RETURNING opp_id
        `);
        global.testOppId = oppResult.rows[0].opp_id;

        const {
            accessToken,
            refreshToken
        } = tokenService.generateTokens({
            user_id: userId
        }, '999h', '9999h')

        global.testAuthToken = accessToken;
        global.testUserId = userId;

        await client.query(`
            INSERT INTO users_tokens (user_id, refreshtoken)
            VALUES ($1, $2)
        `, [userId, refreshToken]);

        await client.query('COMMIT');

        console.log('Тестовые данные успешно созданы');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при создании тестовых данных:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Функция для получения Bearer токена
export const getTestAuthToken = () => {
    if (!global.testAuthToken) {
        throw new Error('Тестовый токен не создан. Запустите seedTestData() сначала.');
    }
    return `Bearer ${global.testAuthToken}`;
};

// Функция для получения ID тестового пользователя
export const getTestUserId = () => {
    return global.testUserId;
};