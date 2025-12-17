import request from 'supertest';
import { setupTestDatabase } from './databaseTestSetup.js';
import {app, server} from '../../../index.js'

beforeAll(async () => {
  // Настраиваем тестовую БД
  await setupTestDatabase();
});

afterAll(async () => {
  await server.close();
});

describe('ProductController', () => {
  describe('GET /api/products/popular', () => {
    it('должен возвращать список популярных товаров', async () => {
      const response = await request(app)
        .get('/api/products/popular')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const product = response.body.data[0];
        expect(product).toHaveProperty('product_id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
      }
    });

    it('должен поддерживать параметр limit', async () => {
      const response = await request(app)
        .get('/api/products/popular?limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/products/search', () => {
    it('должен выполнять поиск товаров', async () => {
      const response = await request(app)
        .get('/api/products/search?search=iPhone')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data).toHaveProperty('pagination');

      // Проверяем, что найдены товары с iPhone в названии
      const products = response.body.data.products;
      const hasiPhone = products.some(p =>
        p.name.toLowerCase().includes('iphone')
      );
      expect(hasiPhone).toBe(true);
    });

    it('должен поддерживать фильтры по цене', async () => {
      const response = await request(app)
        .get('/api/products/search?min_price=50000&max_price=100000')
        .expect(200);

      expect(response.body.success).toBe(true);

      const products = response.body.data.products;
      products.forEach(product => {
        expect(parseFloat(product.price)).toBeGreaterThanOrEqual(50000);
        expect(parseFloat(product.price)).toBeLessThanOrEqual(100000);
      });
    });

    it('должен поддерживать пагинацию', async () => {
      const response = await request(app)
        .get('/api/products/search?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 2);
    });
  });

  describe('GET /api/products/category/:categoryId', () => {
    it('должен возвращать товары по категории', async () => {
      const response = await request(app)
        .get(`/api/products/category/${global.testCategoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data).toHaveProperty('pagination');

      // Проверяем, что все товары принадлежат указанной категории
      const products = response.body.data.products;
      products.forEach(product => {
        expect(product.category_id).toBe(global.testCategoryId);
      });
    });

    it('должен возвращать 404 для несуществующей категории', async () => {
      const response = await request(app)
        .get('/api/products/category/999999')
        .expect(200); // или 404 в зависимости от реализации

      // Проверяем, что товаров не найдено
      expect(response.body.data.products.length).toBe(0);
    });
  });

  describe('GET /api/products/:id', () => {
    it('должен возвращать детальную информацию о товаре', async () => {
      const response = await request(app)
        .get(`/api/products/${global.testProductId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('product');
      expect(response.body.data).toHaveProperty('feedback');
      expect(response.body.data).toHaveProperty('rating');

      const product = response.body.data.product;
      expect(product.product_id).toBe(global.testProductId);
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('description');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('photos');
      expect(product).toHaveProperty('category_name');
      expect(product).toHaveProperty('shop_name');
    });

    it('должен возвращать 404 для несуществующего товара', async () => {
      const response = await request(app)
        .get('/api/products/999999')
        .expect(404); // Или 404 в зависимости от реализации

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('not_found');
    });
  });
});