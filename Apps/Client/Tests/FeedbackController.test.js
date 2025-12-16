import request from 'supertest';
import {app, server} from '../../../index.js'
import { setupTestDatabase } from './databaseTestSetup.js';
import { getTestAuthToken, getTestUserId } from './seedData.js';
const { Database } = await import('../../../Core/Model/Database.js');

let authToken;
let testUserId;

beforeAll(async () => {
  // Настраиваем тестовую БД
  await setupTestDatabase();

  // Получаем тестовый токен и ID пользователя
  authToken = getTestAuthToken();
  testUserId = getTestUserId();

  console.log("TEST USER ID", testUserId)

});

afterAll(async () => {
  if (server) {
    await server.close();
  }
});

describe('FeedbackController', () => {
  beforeEach(async () => {
    // Очищаем возможные отзывы перед каждым тестом

    if (testUserId && global.testProductId) {
      await Database.query(
        'DELETE FROM feedback WHERE user_id = $1 AND product_id = $2',
        [testUserId, global.testProductId]
      );
    }
  });

  describe('POST /api/products/:productId/feedback', () => {
    it('должен создавать новый отзыв с авторизацией', async () => {
      const feedbackData = {
        rate: 5,
        good_text: 'Отличный товар!',
        bad_text: 'Нет',
        comment: 'Рекомендую к покупке'
      };

      const response = await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken) // Используем Bearer токен
        .send(feedbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user_id', testUserId);
      expect(response.body.data).toHaveProperty('product_id', global.testProductId);
      expect(response.body.data).toHaveProperty('rate', 5);
      expect(response.body.data.good_text).toBe('Отличный товар!');
    });

    it('должен обновлять существующий отзыв', async () => {
      // Сначала создаем отзыв
      await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .send({
          rate: 3,
          comment: 'Средний товар'
        });

      // Обновляем отзыв
      const updatedFeedback = {
        rate: 4,
        good_text: 'Стал лучше',
        comment: 'Улучшилось качество'
      };

      const response = await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .send(updatedFeedback)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rate).toBe(4);
      expect(response.body.data.good_text).toBe('Стал лучше');
      expect(response.body.data.comment).toBe('Улучшилось качество');
    });

    it('должен возвращать ошибку при некорректном рейтинге', async () => {
      const invalidFeedback = {
        rate: 6, // Недопустимое значение (> 5)
        comment: 'Тест'
      };

      const response = await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .send(invalidFeedback)
        .expect(400); // или 200 с success: false, в зависимости от реализации

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('unvalid_rate'); // Проверяем, что ошибка про рейтинг
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .send({ rate: 5, comment: 'Тест' })
        // Не отправляем Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('авториз');
    });

    it('должен возвращать 401 с невалидным токеном', async () => {
      const response = await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', 'Bearer invalid-token-123')
        .send({ rate: 5, comment: 'Тест' })
        .expect(401); // или 403, в зависимости от реализации middleware

      expect(response.body.success).toBe(false);
    });

    it('должен возвращать 404 для несуществующего товара', async () => {
      const response = await request(app)
        .post('/api/products/999999/feedback')
        .set('Authorization', authToken)
        .send({ rate: 5, comment: 'Тест' })
        .expect(404); // или 200 с success: false

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/products/:productId/feedback', () => {
    it('должен удалять отзыв с авторизацией', async () => {
      // Сначала создаем отзыв
      await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .send({ rate: 5, comment: 'Отзыв для удаления' });

      // Удаляем отзыв
      const response = await request(app)
        .delete(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('удален');
    });

    it('должен возвращать 404 при попытке удалить несуществующий отзыв', async () => {
      const response = await request(app)
        .delete(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .expect(404); // или 200 с success: false

      expect(response.body.success).toBe(false);
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .delete(`/api/products/${global.testProductId}/feedback`)
        // Нет Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('не должен позволять удалять чужой отзыв', async () => {
      // Создаем второго тестового пользователя
      const client = await Database.GetMasterClient();

      try {
        // Создаем второго пользователя
        const user2Result = await client.query(`
          INSERT INTO users (registration_date, is_active, is_activated)
          VALUES (NOW(), true, true)
          RETURNING user_id
        `);
        const user2Id = user2Result.rows[0].user_id;

        // Создаем отзыв от второго пользователя
        await client.query(`
          INSERT INTO feedback (user_id, product_id, rate, comment)
          VALUES ($1, $2, $3, $4)
        `, [user2Id, global.testProductId, 5, 'Чужой отзыв']);

        // Пытаемся удалить чужой отзыв с токеном первого пользователя
        const response = await request(app)
          .delete(`/api/products/${global.testProductId}/feedback`)
          .set('Authorization', authToken)
          .expect(404); // или 403, в зависимости от реализации

        expect(response.body.success).toBe(false);

        // Очищаем
        await client.query('DELETE FROM feedback WHERE user_id = $1', [user2Id]);
        await client.query('DELETE FROM users WHERE user_id = $1', [user2Id]);

      } finally {
        client.release();
      }
    });
  });

  describe('GET /api/user/feedback', () => {
    it('должен возвращать отзывы текущего пользователя с авторизацией', async () => {
      // Сначала создаем несколько отзывов
      await request(app)
        .post(`/api/products/${global.testProductId}/feedback`)
        .set('Authorization', authToken)
        .send({ rate: 5, comment: 'Первый отзыв' });

      // Создаем второй продукт для отзыва
      const client = await Database.GetMasterClient();
      const product2Result = await client.query(`
        INSERT INTO products (category_id, shop_id, name, description, price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING product_id
      `, [global.testCategoryId, global.testShopId, 'Test Product 2', 'Description', 10000]);
      const product2Id = product2Result.rows[0].product_id;
      client.release();

      await request(app)
        .post(`/api/products/${product2Id}/feedback`)
        .set('Authorization', authToken)
        .send({ rate: 4, comment: 'Второй отзыв' });

      // Получаем отзывы пользователя
      const response = await request(app)
        .get('/api/user/feedback')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Проверяем структуру отзывов
      response.body.data.forEach(feedback => {
        expect(feedback).toHaveProperty('user_id', testUserId);
        expect(feedback).toHaveProperty('product_id');
        expect(feedback).toHaveProperty('rate');
        expect(feedback).toHaveProperty('comment');
        expect(feedback).toHaveProperty('product_name');
      });

      // Очищаем второй продукт
      const client2 = await Database.GetMasterClient();
      await client2.query('DELETE FROM products WHERE product_id = $1', [product2Id]);
      client2.release();
    });

    it('должен возвращать пустой массив если нет отзывов', async () => {
      // Удаляем все отзывы пользователя
      await Database.query('DELETE FROM feedback WHERE user_id = $1', [testUserId]);

      const response = await request(app)
        .get('/api/user/feedback')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('должен возвращать 401 без авторизации', async () => {
      const response = await request(app)
        .get('/api/user/feedback')
        // Нет Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('не должен показывать чужие отзывы', async () => {
      // Создаем второго пользователя и его отзыв
      const client = await Database.GetMasterClient();

      try {
        // Создаем второго пользователя
        const user2Result = await client.query(`
          INSERT INTO users (registration_date, is_active, is_activated)
          VALUES (NOW(), true, true)
          RETURNING user_id
        `);
        const user2Id = user2Result.rows[0].user_id;

        // Создаем отзыв от второго пользователя
        await client.query(`
          INSERT INTO feedback (user_id, product_id, rate, comment)
          VALUES ($1, $2, $3, $4)
        `, [user2Id, global.testProductId, 1, 'Чужой отзыв']);

        // Получаем отзывы первого пользователя
        const response = await request(app)
          .get('/api/user/feedback')
          .set('Authorization', authToken)
          .expect(200);

        // Проверяем, что в ответе нет отзывов второго пользователя
        const hasForeignReview = response.body.data.some(
          feedback => feedback.user_id === user2Id
        );
        expect(hasForeignReview).toBe(false);

        // Очищаем
        await client.query('DELETE FROM feedback WHERE user_id = $1', [user2Id]);
        await client.query('DELETE FROM users WHERE user_id = $1', [user2Id]);

      } finally {
        client.release();
      }
    });
  });
});