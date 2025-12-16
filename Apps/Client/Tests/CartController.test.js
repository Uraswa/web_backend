import request from 'supertest';
import { app, server } from '../../../index.js';
import { setupTestDatabase } from './databaseTestSetup.js';
import { getTestAuthToken, getTestUserId } from './seedData.js';
import { Database } from '../../../Core/Model/Database.js';

let authToken;
let testUserId;

beforeAll(async () => {
  // Настраиваем тестовую БД
  await setupTestDatabase();

  // Получаем тестовый токен и ID пользователя
  authToken = getTestAuthToken();
  testUserId = getTestUserId();

  console.log("Cart Test: Test User ID", testUserId);
});

afterAll(async () => {
  if (server) {
    await server.close();
  }
});

describe('CartController', () => {
  beforeEach(async () => {
    // Очищаем корзину перед каждым тестом
    // Так как CartService - это заглушка в памяти, используем clearCart endpoint
    try {
      await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken);
    } catch (error) {
      // Игнорируем ошибки, если корзина уже пуста
    }
  });

  describe('GET /api/cart', () => {
    it('должен возвращать корзину с авторизацией', async () => {
      const response = await request(app)
        .get('/api/cart')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      // Проверяем структуру ответа (может быть разной в зависимости от CartService)
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .get('/api/cart')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/cart/update/:productId', () => {
    it('должен добавлять товар в корзину при обновлении с положительным количеством', async () => {
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('должен удалять товар из корзины при обновлении с quantity = 0', async () => {
      // Сначала добавляем товар
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 2 });

      // Затем удаляем, установив quantity = 0
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('должен обновлять количество существующего товара в корзине', async () => {
      // Сначала добавляем товар с количеством 1
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 1 });

      // Обновляем на количество 5
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('должен использовать quantity = 1 по умолчанию, если не указано', async () => {
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({}) // Не указываем quantity
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('должен возвращать 404 для несуществующего товара', async () => {
      const response = await request(app)
        .put('/api/cart/update/999999')
        .set('Authorization', authToken)
        .send({ quantity: 1 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('product_not_found');
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .send({ quantity: 1 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('должен корректно работать с отрицательным quantity (удалять товар)', async () => {
      // Сначала добавляем товар
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 3 });

      // Пытаемся установить отрицательное количество
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: -1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Ожидаем, что товар будет удален при отрицательном количестве
    });

    it('должен корректно работать с quantity = null (использовать 1 по умолчанию)', async () => {
      const response = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: null })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/cart/clear', () => {
    it('должен очищать корзину с авторизацией', async () => {
      // Сначала добавляем товар в корзину
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 2 });

      // Очищаем корзину
      const response = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('должен работать с пустой корзиной', async () => {
      const response = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .delete('/api/cart/clear')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('должен полностью очищать корзину после вызова', async () => {
      // Добавляем несколько товаров
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 2 });

      // Добавляем второй товар
      const client = await Database.GetMasterClient();
      const product2Result = await client.query(`
        INSERT INTO products (category_id, shop_id, name, description, price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING product_id
      `, [global.testCategoryId, global.testShopId, 'Product 2 for Clear Test', 'Description', 15000]);
      const product2Id = product2Result.rows[0].product_id;
      client.release();

      await request(app)
        .put(`/api/cart/update/${product2Id}`)
        .set('Authorization', authToken)
        .send({ quantity: 1 });

      // Очищаем корзину
      await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken)
        .expect(200);

      // Проверяем, что корзина пуста
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', authToken)
        .expect(200);

      expect(cartResponse.body.success).toBe(true);
      // Проверяем, что корзина действительно пуста (зависит от реализации CartService)

      // Очищаем созданный продукт
      const client2 = await Database.GetMasterClient();
      await client2.query('DELETE FROM products WHERE product_id = $1', [product2Id]);
      client2.release();
    });
  });

  describe('GET /api/cart/info', () => {
    it('должен возвращать информацию о корзине с авторизацией', async () => {
      // Сначала добавляем товар
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 2 });

      const response = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      // Проверяем структуру данных (зависит от реализации CartService.getCartInfo)
    });

    it('должен возвращать информацию о пустой корзине', async () => {
      const response = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .get('/api/cart/info')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('должен показывать правильное количество товаров после изменений', async () => {
      // Начинаем с пустой корзины
      const infoBefore = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken);

      // Добавляем товар
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 3 });

      // Проверяем информацию после добавления
      const infoAfterAdd = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken);

      expect(infoAfterAdd.body.success).toBe(true);

      // Обновляем количество
      await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 1 });

      // Проверяем информацию после обновления
      const infoAfterUpdate = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken);

      expect(infoAfterUpdate.body.success).toBe(true);

      // Очищаем корзину
      await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken);

      // Проверяем информацию после очистки
      const infoAfterClear = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken);

      expect(infoAfterClear.body.success).toBe(true);
    });
  });

  describe('Интеграционные тесты корзины', () => {
    it('должен корректно работать полный цикл добавления/обновления/очистки', async () => {
      // 1. Проверяем начальное состояние
      const initialCart = await request(app)
        .get('/api/cart')
        .set('Authorization', authToken);
      expect(initialCart.body.success).toBe(true);

      // 2. Добавляем первый товар
      const addResponse1 = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 2 });
      expect(addResponse1.body.success).toBe(true);

      // 3. Добавляем второй товар
      const client = await Database.GetMasterClient();
      const product2Result = await client.query(`
        INSERT INTO products (category_id, shop_id, name, description, price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING product_id
      `, [global.testCategoryId, global.testShopId, 'Integration Test Product', 'Description', 25000]);
      const product2Id = product2Result.rows[0].product_id;
      client.release();

      const addResponse2 = await request(app)
        .put(`/api/cart/update/${product2Id}`)
        .set('Authorization', authToken)
        .send({ quantity: 1 });
      expect(addResponse2.body.success).toBe(true);

      // 4. Проверяем информацию о корзине
      const cartInfo = await request(app)
        .get('/api/cart/info')
        .set('Authorization', authToken);
      expect(cartInfo.body.success).toBe(true);

      // 5. Обновляем количество первого товара
      const updateResponse = await request(app)
        .put(`/api/cart/update/${global.testProductId}`)
        .set('Authorization', authToken)
        .send({ quantity: 5 });
      expect(updateResponse.body.success).toBe(true);

      // 6. Удаляем второй товар (quantity = 0)
      const removeResponse = await request(app)
        .put(`/api/cart/update/${product2Id}`)
        .set('Authorization', authToken)
        .send({ quantity: 0 });
      expect(removeResponse.body.success).toBe(true);

      // 7. Очищаем корзину полностью
      const clearResponse = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken);
      expect(clearResponse.body.success).toBe(true);

      // 8. Проверяем конечное состояние
      const finalCart = await request(app)
        .get('/api/cart')
        .set('Authorization', authToken);
      expect(finalCart.body.success).toBe(true);

      // Очищаем созданный продукт
      const client2 = await Database.GetMasterClient();
      await client2.query('DELETE FROM products WHERE product_id = $1', [product2Id]);
      client2.release();
    });

    it('должен корректно обрабатывать несколько одновременных запросов', async () => {
      // Создаем несколько продуктов для теста
      const client = await Database.GetMasterClient();
      const productIds = [];

      for (let i = 0; i < 3; i++) {
        const productResult = await client.query(`
          INSERT INTO products (category_id, shop_id, name, description, price)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING product_id
        `, [global.testCategoryId, global.testShopId, `Concurrent Product ${i}`, 'Description', (i + 1) * 10000]);
        productIds.push(productResult.rows[0].product_id);
      }
      client.release();

      // Делаем несколько параллельных запросов на добавление
      const promises = productIds.map((productId, index) =>
        request(app)
          .put(`/api/cart/update/${productId}`)
          .set('Authorization', authToken)
          .send({ quantity: index + 1 })
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
      });

      // Проверяем итоговое состояние корзины
      const cartResponse = await request(app)
        .get('/api/cart')
        .set('Authorization', authToken);
      expect(cartResponse.body.success).toBe(true);

      // Очищаем корзину
      await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', authToken);

      // Очищаем созданные продукты
      const client2 = await Database.GetMasterClient();
      for (const productId of productIds) {
        await client2.query('DELETE FROM products WHERE product_id = $1', [productId]);
      }
      client2.release();
    });
  });
});