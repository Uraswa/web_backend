import { Database } from '../../../Core/Model/Database.js';
import tokenService from '../../../Core/Services/tokenService.js';
import ordersService from '../../../Core/Services/ordersService.js';
import OuterLogisticsService from '../../../Core/Services/outerLogisticsService.js';

const TABLES_TO_TRUNCATE = [
  'order_product_statuses',
  'order_statuses',
  'order_products',
  'orders',
  'feedback',
  'products',
  'product_categories',
  'shops',
  'opp',
  'users_tokens',
  'user_profiles',
  'user_login_info',
  'users'
];

async function resetDatabase() {
  for (const table of TABLES_TO_TRUNCATE) {
    try {
      await Database.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
    } catch (error) {
      console.warn(`Failed to truncate table ${table}: ${error.message}`);
    }
  }

  OuterLogisticsService._logisticsOrders = {};
  OuterLogisticsService._nextLogisticsOrderId = 1;
}

async function insertUser(client, firstName, lastName) {
  const user = await client.query(
    `INSERT INTO users (registration_date, is_active, is_activated)
     VALUES (NOW(), true, true)
     RETURNING user_id`
  );

  await client.query(
    `INSERT INTO user_profiles (user_id, first_name, last_name)
     VALUES ($1, $2, $3)`,
    [user.rows[0].user_id, firstName, lastName]
  );

  return user.rows[0].user_id;
}

export async function seedOppTestData() {
  await resetDatabase();

  const client = await Database.GetMasterClient();

  let ownerId;
  let outsiderId;
  let buyerId;
  let sellerId;
  let categoryId;
  let productId;
  let startOppId;
  let targetOppId;

  try {
    await client.query('BEGIN');

    ownerId = await insertUser(client, 'Owner', 'User');
    outsiderId = await insertUser(client, 'Other', 'Owner');
    buyerId = await insertUser(client, 'Buyer', 'Test');
    sellerId = await insertUser(client, 'Seller', 'Test');

    const category = await client.query(
      `INSERT INTO product_categories (name)
       VALUES ('Техника')
       RETURNING category_id`
    );
    categoryId = category.rows[0].category_id;

    const shop = await client.query(
      `INSERT INTO shops (owner_id, name, description)
       VALUES ($1, 'Test Shop', 'Opp tests shop')
       RETURNING shop_id`,
      [sellerId]
    );
    const shopId = shop.rows[0].shop_id;

    const product = await client.query(
      `INSERT INTO products (category_id, shop_id, name, description, photos, price, count)
       VALUES ($1, $2, 'Test Phone', 'Smartphone for OPP tests', '["phone.jpg"]', 49999, 100)
       RETURNING product_id`,
      [categoryId, shopId]
    );
    productId = product.rows[0].product_id;

    const startOpp = await client.query(
      `INSERT INTO opp (address, latitude, longitude, enabled, work_time, owner_id)
       VALUES ('Start OPP', 55.75, 37.61, true, '{"mon": "09:00-21:00"}', $1)
       RETURNING opp_id`,
      [ownerId]
    );
    startOppId = startOpp.rows[0].opp_id;

    const targetOpp = await client.query(
      `INSERT INTO opp (address, latitude, longitude, enabled, work_time, owner_id)
       VALUES ('Target OPP', 55.76, 37.62, true, '{"mon": "09:00-21:00"}', $1)
       RETURNING opp_id`,
      [ownerId]
    );
    targetOppId = targetOpp.rows[0].opp_id;

    await client.query(
      `INSERT INTO opp (address, latitude, longitude, enabled, work_time, owner_id)
       VALUES ('Foreign OPP', 55.77, 37.63, true, '{"mon": "09:00-21:00"}', $1)`,
      [outsiderId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }

  client.release();

  const createdOrder = await ordersService.createOrder(buyerId, targetOppId, [
    { product_id: productId, count: 2 }
  ]);

  const ownerTokens = tokenService.generateTokens(
    { user_id: ownerId },
    '8h',
    '24h'
  );
  const outsiderTokens = tokenService.generateTokens(
    { user_id: outsiderId },
    '8h',
    '24h'
  );

  return {
    ownerToken: `Bearer ${ownerTokens.accessToken}`,
    outsiderToken: `Bearer ${outsiderTokens.accessToken}`,
    ownerId,
    outsiderId,
    buyerId,
    sellerId,
    orderId: createdOrder.order_id,
    productId,
    startOppId,
    targetOppId,
    orderedCount: 2,
    productPrice: 49999
  };
}
