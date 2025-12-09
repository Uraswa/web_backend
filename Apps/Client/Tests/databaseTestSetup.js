import {Database} from '../../../Core/Model/Database.js';
import {seedData} from './seedData.js';

// Функция для очистки и заполнения тестовой базы данных
export const setupTestDatabase = async () => {
    try {
        // Очищаем таблицы (в обратном порядке из-за foreign keys)
        const tables = [
            'order_statuses',
            'order_products',
            'orders',
            'feedback',
            'products',
            'product_categories',
            'shops',
            'user_profiles',
            'user_login_info',
            'users'
        ];

        for (const table of tables) {
            try {
                await Database.query(`DELETE
                                      FROM ${table} CASCADE`);
            } catch (error) {
                console.warn(`Не удалось очистить таблицу ${table}:`, error.message);
            }
        }

        // Заполняем тестовыми данными
        await seedData();

        console.log('Тестовая БД успешно настроена');
    } catch (error) {
        console.error('Ошибка при настройке тестовой БД:', error);
        throw error;
    }
};

// Функция для создания тестового пользователя и получения токена
export const createTestUser = async () => {
    // Здесь можно использовать миграции для создания тестового пользователя
    // или mock данные, в зависимости от реализации авторизации
    return {
        user_id: 1,
        email: 'test@example.com',
        password: 'testpassword123'
    };
};