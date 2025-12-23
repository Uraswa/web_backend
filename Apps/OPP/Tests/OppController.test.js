import request from 'supertest';
import { app, server } from '../../../index.js';
import { seedOppTestData } from './oppTestUtils.js';
import OuterLogisticsService from '../../../Core/Services/outerLogisticsService.js';

let context;

const authHeader = (token) => ({
  Authorization: token
});

const extractLogisticsOrderId = (body) => {
  const info = body?.data?.logistics_info;
  if (!info) {
    return undefined;
  }

  const orders =
    info.logistics_orders ||
    info?.logistics_info?.logistics_orders ||
    [];

  return orders[0]?.logistics_order_id;
};

describe('OPP API endpoints', () => {
  beforeEach(async () => {
    context = await seedOppTestData();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('GET /api/opp/:oppId/statistics', () => {
    it('возвращает статистику ПВЗ', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/statistics`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total_orders');
      expect(res.body.data).toHaveProperty('active_orders');
    });

    it('требует авторизацию', async () => {
      await request(app)
        .get(`/api/opp/${context.targetOppId}/statistics`)
        .expect(401);
    });

    it('запрещает доступ к чужому ПВЗ', async () => {
      await request(app)
        .get(`/api/opp/${context.targetOppId}/statistics`)
        .set(authHeader(context.outsiderToken))
        .expect(403);
    });

    it('возвращает 404 для несуществующего ПВЗ', async () => {
      await request(app)
        .get('/api/opp/999999/statistics')
        .set(authHeader(context.ownerToken))
        .expect(404);
    });
  });

  describe('GET /api/opp/:oppId/orders', () => {
    it('возвращает список заказов', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/orders`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });

    it('поддерживает фильтр по статусу', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/orders?status=done`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orders.length).toBeGreaterThanOrEqual(0);
    });

    it('возвращает 401 без авторизации', async () => {
      await request(app)
        .get(`/api/opp/${context.targetOppId}/orders`)
        .expect(401);
    });

    it('возвращает 403 для чужого владельца', async () => {
      await request(app)
        .get(`/api/opp/${context.targetOppId}/orders`)
        .set(authHeader(context.outsiderToken))
        .expect(403);
    });
  });

  describe('GET /api/opp/:oppId/orders/:orderId', () => {
    it('возвращает детали заказа', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/orders/${context.orderId}`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.order_id).toBe(context.orderId);
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    it('возвращает 404 для неизвестного заказа', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/orders/999999`)
        .set(authHeader(context.ownerToken))
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('order_not_found');
    });

    it('запрещает доступ не владельцу ПВЗ', async () => {
      await request(app)
        .get(`/api/opp/${context.targetOppId}/orders/${context.orderId}`)
        .set(authHeader(context.outsiderToken))
        .expect(403);
    });
  });

  describe('GET /api/opp/:oppId/logistics-orders', () => {
    it('возвращает пустой список без логистических заказов', async () => {
      const res = await request(app)
        .get(`/api/opp/${context.startOppId}/logistics-orders`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });

    async function createManualLogisticsOrder(sourceOppId = context.startOppId) {
      const products = [
        {
          productId: context.productId,
          productName: 'Test Phone',
          clientOrderId: context.orderId,
          clientReceiverId: context.buyerId,
          count: context.orderedCount,
          price: context.productPrice
        }
      ];

      await OuterLogisticsService.createLogisticsOrder(
        sourceOppId,
        context.targetOppId,
        products
      );
    }

    it('фильтрует исходящие логистические заказы', async () => {
      await createManualLogisticsOrder();

      const res = await request(app)
        .get(`/api/opp/${context.startOppId}/logistics-orders?direction=outgoing`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.direction).toBe('outgoing');
    });

    it('фильтрует входящие логистические заказы', async () => {
      await createManualLogisticsOrder();

      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/logistics-orders?direction=incoming`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.direction).toBe('incoming');
    });

    it('возвращает пусто для неизвестного направления', async () => {
      await receiveFromSeller();

      const res = await request(app)
        .get(`/api/opp/${context.targetOppId}/logistics-orders?direction=something`)
        .set(authHeader(context.ownerToken))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });
  });

  async function receiveFromSeller(count = context.orderedCount) {
    const res = await request(app)
      .post(`/api/opp/${context.startOppId}/receive-from-seller`)
      .set(authHeader(context.ownerToken))
      .send({
        order_id: context.orderId,
        product_id: context.productId,
        count
      })
      .expect(200);

    return res.body;
  }

  async function giveToLogistics(logisticsOrderId, count = context.orderedCount) {
    const res = await request(app)
      .post(`/api/opp/${context.startOppId}/give-to-logistics`)
      .set(authHeader(context.ownerToken))
      .send({
        order_id: context.orderId,
        logistics_order_id: logisticsOrderId,
        product_id: context.productId,
        count
      })
      .expect(200);

    return res.body;
  }

  async function receiveFromLogistics(logisticsOrderId) {
    const res = await request(app)
      .post(`/api/opp/${context.targetOppId}/receive-from-logistics`)
      .set(authHeader(context.ownerToken))
      .send({
        logistics_order_id: logisticsOrderId
      })
      .expect(200);

    return res.body;
  }

  describe('POST /api/opp/:oppId/receive-from-seller', () => {
    it('принимает товар и планирует логистику', async () => {
      const body = await receiveFromSeller();

      expect(body.success).toBe(true);
      expect(body.data.logistics_info).toBeDefined();
      expect(body.data.order_id).toBe(context.orderId);
    });

    it('валидирует обязательные поля', async () => {
      await request(app)
        .post(`/api/opp/${context.startOppId}/receive-from-seller`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId
        })
        .expect(400);
    });

    it('не принимает товар, не входящий в заказ', async () => {
      const res = await request(app)
        .post(`/api/opp/${context.startOppId}/receive-from-seller`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          product_id: 999999,
          count: 1
        })
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Товар не найден/);
    });

    it('не принимает количество больше ожидания', async () => {
      const res = await request(app)
        .post(`/api/opp/${context.startOppId}/receive-from-seller`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          product_id: context.productId,
          count: context.orderedCount + 5
        })
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Нельзя принять/);
    });
  });

  describe('POST /api/opp/:oppId/give-to-logistics', () => {
    it('передает товар логисту', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);
      expect(logisticsOrderId).toBeDefined();

      const body = await giveToLogistics(logisticsOrderId);

      expect(body.success).toBe(true);
      expect(body.data.logistics_order_id).toBe(logisticsOrderId);
    });

    it('возвращает ошибку при отсутствии logistics_order_id', async () => {
      await request(app)
        .post(`/api/opp/${context.startOppId}/give-to-logistics`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          product_id: context.productId,
          count: 1
        })
        .expect(400);
    });

    it('не передает товар из неправильного ПВЗ', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);

      const res = await request(app)
        .post(`/api/opp/${context.targetOppId}/give-to-logistics`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          logistics_order_id: logisticsOrderId,
          product_id: context.productId,
          count: context.orderedCount
        })
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Недостаточно товара/);
    });

    it('возвращает ошибку для неизвестного логистического заказа', async () => {
      await receiveFromSeller();

      const res = await request(app)
        .post(`/api/opp/${context.startOppId}/give-to-logistics`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          logistics_order_id: 999999,
          product_id: context.productId,
          count: context.orderedCount
        })
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/не найден/);
    });
  });

  describe('POST /api/opp/:oppId/receive-from-logistics', () => {
    it('принимает товары из логистического заказа', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);
      expect(logisticsOrderId).toBeDefined();
      await giveToLogistics(logisticsOrderId);

      const body = await receiveFromLogistics(logisticsOrderId);

      expect(body.success).toBe(true);
      expect(body.data.logistics_order_id).toBe(logisticsOrderId);
    });

    it('валидирует обязательные поля', async () => {
      await request(app)
        .post(`/api/opp/${context.targetOppId}/receive-from-logistics`)
        .set(authHeader(context.ownerToken))
        .send({})
        .expect(400);
    });

    it('не позволяет чужому владельцу принять логистический заказ', async () => {
      await request(app)
        .post(`/api/opp/${context.targetOppId}/receive-from-logistics`)
        .set(authHeader(context.outsiderToken))
        .send({ logistics_order_id: 1 })
        .expect(403);
    });
  });

  describe('POST /api/opp/:oppId/deliver', () => {
    it('выдает заказ клиенту с отказом от части товаров', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);
      expect(logisticsOrderId).toBeDefined();
      await giveToLogistics(logisticsOrderId);
      await receiveFromLogistics(logisticsOrderId);

      const res = await request(app)
        .post(`/api/opp/${context.targetOppId}/deliver`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          rejected_products: [
            {
              product_id: context.productId,
              count: 1
            }
          ]
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rejected_count).toBe(1);
    });

    it('валидирует наличие order_id', async () => {
      await request(app)
        .post(`/api/opp/${context.targetOppId}/deliver`)
        .set(authHeader(context.ownerToken))
        .send({})
        .expect(400);
    });

    it('не разрешает выдачу из другого ПВЗ', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);
      expect(logisticsOrderId).toBeDefined();
      await giveToLogistics(logisticsOrderId);
      await receiveFromLogistics(logisticsOrderId);

      const res = await request(app)
        .post(`/api/opp/${context.startOppId}/deliver`)
        .set(authHeader(context.ownerToken))
        .send({ order_id: context.orderId })
        .expect(200);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/целевого ПВЗ/);
    });

    it('не разрешает отклонить больше, чем доступно', async () => {
      const receiveBody = await receiveFromSeller();
      const logisticsOrderId = extractLogisticsOrderId(receiveBody);
      expect(logisticsOrderId).toBeDefined();
      await giveToLogistics(logisticsOrderId);
      await receiveFromLogistics(logisticsOrderId);

      const res = await request(app)
        .post(`/api/opp/${context.targetOppId}/deliver`)
        .set(authHeader(context.ownerToken))
        .send({
          order_id: context.orderId,
          rejected_products: [
            {
              product_id: context.productId,
              count: context.orderedCount + 5
            }
          ]
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('rejected_count_exceeds_available');
      expect(res.body.meta).toMatchObject({
        product_id: context.productId
      });
    });

  });
});
