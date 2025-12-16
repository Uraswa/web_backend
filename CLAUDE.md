# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Node.js + Express marketplace backend with PostgreSQL database. Uses ES modules (type: "module" in package.json). The application is structured as a multi-tenant marketplace suopprting different user roles and business entities.

## Development Commands

**Start development server:**
```bash
npm run dev
```
Runs with nodemon on port 8000 (see index.js:31)

**Run tests:**
```bash
npm test
```
Uses Jest with experimental VM modules suopprt via cross-env

**Database setup:**
```bash
npm run db:setup
```
Creates database and runs migrations automatically

**Run migrations:**
```bash
npm run migrate up
npm run migrate down
npm run migrate create <migration-name>
```
Uses node-pg-migrate for database schema management

## Architecture

### Application Structure

The codebase follows a modular architecture with distinct application domains under `/Apps`:

- **Auth**: User authentication, registration, password management
- **Client**: Customer-facing API (products, cart, orders, feedback)
- **Shop**: Shop owner functionality (currently empty stub)
- **Admin**: Administrative functions (currently empty stub)
- **OPP**: Pick-up point (opp) management (currently empty stub)
- **Logistics**: Logistics/shipping functionality (currently empty stub)

Each app module follows the same structure:
- `Controller/` - Request handlers with business logic
- `Model/` - Database operations specific to the app
- `Middleware/` - App-specific middleware
- `router.js` - Route definitions exported as a function

### Core Infrastructure (`/Core`)

Shared functionality used across all apps:

**Database (`Core/Db/`, `Core/Model/`)**
- `PoolWrapper.js` - Custom PostgreSQL connection pool suopprting master-slave replication
  - Pass `is_writing: true` to `query()` for write operations (uses master)
  - Read operations distribute across slave pools via round-robin
  - Suopprts lazy configuration with ports array or explicit master/slaves config
- `Database.js` - Singleton PoolWrapper instance used throughout the app
- `Basic*Model.js` - Base models providing common database operations for core entities (User, Product, Shop, Order, Feedback, ProductCategory, opp)

**Services (`Core/Services/`)**
- `tokenService.js` - JWT generation and validation (access + refresh tokens)
- `cacheService.js` - Caching layer
- `cartService.js` - Shopping cart logic
- `ordersService.js` - Order processing
- `outerLogisticsService.js` - External logistics integration
- `mailService.js` - Email sending with nodemailer

**Middleware (`Core/Middleware/`)**
- `authMiddleware.js` - Validates JWT access token from Authorization header, attaches `req.user`
- `notAuthMiddleware.js` - Ensures user is NOT authenticated

### Router Registration

Main entry point (index.js) registers app routers:
```javascript
authRoutes(router)
clientRoutes(router)
```

Each router function receives the Express router instance and registers its routes.

### Database Schema

Migrations are in `/migrations` with timestamps. Key tables:

**Authentication:**
- `users` - Core user records (user_id, registration_date, is_active, is_activated)
- `user_login_info` - Email/password credentials
- `user_profiles` - User profile data (first_name, last_name)
- `users_activation_links` - Email activation tokens
- `users_password_change_tokens` - Password reset tokens

**Commerce:**
- `shops` - Store information
- `product_categories` - Product categorization with characteristics/filters
- `products` - Product catalog with variants suopprt
- `feedback` - Product reviews
- `orders` - Customer orders
- `order_products` - Order line items
- `order_statuses` - Order status history
- `pvz` (opp) - Pick-up points

Recent migrations added:
- Product characteristics and variants (1765339649390)
- Product/order status tracking (1765458690663)
- Foreign key cascades (1765290636438)
- opp owner_id and user is_admin fields (1765291599816)

### Authentication Flow

1. User registers via `/api/createUser` - creates user, sends activation email
2. User activates via `/api/activateAccount?token=...`
3. User logs in via `/api/login` - returns access + refresh tokens
4. Client includes `Authorization: Bearer <accessToken>` header
5. `authMiddleware` validates token and attaches decoded payload to `req.user`
6. Refresh via `/api/refreshToken` when access token expires
7. Logout via `/api/logout` (requires auth)

Tokens stored in cookies via cookie-parser middleware.

### Client API Patterns

All Client API responses follow this structure:
```javascript
{
  success: true,
  data: { ... }
}
// or on error:
{
  success: false,
  error: "error_message"
}
```

Pagination pattern:
```javascript
{
  success: true,
  data: {
    products: [...],
    pagination: {
      page: 1,
      limit: 20,
      total: 150,
      total_pages: 8
    }
  }
}
```

### Testing

Tests use Jest + Supertest. Test files are colocated in `Apps/{AppName}/Tests/`.

Test structure:
1. `beforeAll` - Sets up test database via `setupTestDatabase()` (truncates tables, seeds data)
2. Test cases - Use supertest to make HTTP requests against the Express app
3. `afterAll` - Closes server

Global test variables (e.g., `global.testProductId`) are set in seed data for use across tests.

Run single test file:
```bash
npm test -- ProductController.test.js
```

### Environment Configuration

Required environment variables (see .env.example):

**Database:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `DATABASE_URL` - Full connection string

**JWT:**
- `JWT_ACCESS_SECRET` - Access token signing key
- `JWT_REFRESH_SECRET` - Refresh token signing key
- `JWT_SECRET` - Legacy/fallback secret (may not be used)

**Email (optional):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

**Other:**
- `REDIS_URL` - Redis connection (if using cache)
- `API_URL` - Base API URL for email links

## Important Patterns

### Model Pattern

Models extend Basic models or define their own:
```javascript
import BasicProductModel from '../../../Core/Model/BasicProductModel.js';

class ProductModel extends BasicProductModel {
  async findWithFilters(filters, limit, offset) {
    // Custom queries
  }
}

export default new ProductModel(); // Singleton export
```

### Controller Pattern

Controllers are classes with async methods, exported as singletons:
```javascript
class ProductController {
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductModel.findByIdWithVariants(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'not_found'
        });
      }

      return res.status(200).json({
        success: true,
        data: { product }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении товара'
      });
    }
  }
}

export default new ProductController();
```

### Router Pattern

Routers are functions that receive an Express router:
```javascript
import authMiddleware from "../../Core/Middleware/authMiddleware.js";
import ProductController from './Controller/ProductController.js';

export default (router) => {
  router.get('/api/products/:id', ProductController.getProductById);
  router.post('/api/products/:productId/feedback',
    authMiddleware,
    FeedbackController.addFeedback
  );
}
```

### Database Query Pattern

Always use parameterized queries to prevent SQL injection:
```javascript
// CORRECT:
const result = await Database.query(
  'SELECT * FROM users WHERE user_id = $1',
  [user_id]
);

// For writes, pass is_writing flag:
const result = await Database.query(
  'INSERT INTO users (email) VALUES ($1) RETURNING user_id',
  [email],
  true  // is_writing = true for master pool
);
```

## Current Development Status

Based on git status, active development is on `mvp/client` branch:
- Client routes (products, cart, orders, feedback, categories) are recently implemented
- Product characteristics and variants system added
- Order status tracking enhanced
- Tests are being written in `/Tests` directory

Incomplete/stub modules: Shop, Admin, OPP, Logistics (empty routers)

## Бизнес-логика системы заказов
### Архитектура данных
Таблица order_product_statuses хранит историю статусов каждого товара в заказе:

Поле count — количество единиц товара с данным статусом
Поле data (jsonb) — метаданные статуса

### Статусы товаров и их метаданные
Статус: 
1) arrived_in_opp Товар находится в каком-то ПВЗ Возможные значения в data:
from_logistics_order_id — товар поступил в ПВЗ из логистической доставки
from_seller — товар передан продавцом напрямую в ПВЗ
opp_id — идентификатор ПВЗ, где находится товар
is_start_opp: true — товар в исходном ПВЗ (куда передал продавец)
is_target_opp: true — товар в целевом ПВЗ (откуда забирает покупатель)
2) sent_to_logistics
Товар передан в логистическую систему
Обязательное поле в data:
logistics_order_id — идентификатор логистического заказа
3) Статус: waiting_for_product_arrival_in_opp
Товар еще не поступил от продавца в ПВЗ

4) Статус: delivered
Товар выдан покупателю
5) Статус: refunded
Товар возвращен продавцу

### Метод _calculateCurrentDistribution
Этот метод анализирует историю статусов и вычисляет текущее распределение товарА (метод работает только для одного товара из заказа!):
json{
   "waiting_for_product_arrival_in_opp": 0,
   "at_target_opp": 12,        // вычисляемый: arrived_in_opp с is_target_opp: true
   "at_start_opp": 12,          // вычисляемый: arrived_in_opp с is_start_opp: true
   "sent_to_logistics": {
      "logistic_order_id1": count,
      "logistic_order_id2": count
   },
   "by_opp": {opp_id1: count1, ....}, // сколько единиц товара находится в каждом opp 
   "sent_to_logistics_unvalid": {  // товары, не принадлежащие своему логистическому заказу
      "logistic_order_id1": count
   },
   "delivered": 0,
   "refunded": 0
}
Важно: at_start_opp и at_target_opp — это вычисляемые категории, а не реальные статусы в БД. В БД хранится arrived_in_opp с соответствующими флагами в data.
Логистическая система
Логистический заказ создается для уникальной пары (ПВЗ_отправления, ПВЗ_назначения):

В одном логистическом заказе могут быть товары из разных клиентских заказов
Товары одного клиентского заказа могут быть в нескольких логистических заказах
Поэтому в order_product_statuses есть поле count — один статус может относиться к нескольким единицам товара

Принцип работы ПВЗ
Критическое правило: ПВЗ выдает товары только по номеру заказа

Касается и покупателей, и продавцов
Из-за этого правила возвраты также реализуются через создание заказов

### Бизнес-логика создания заказа

1) Клиент делает заказ. Заказа записывается в бд. Все товары в заказе по умолчанию имеют статус waiting_for_product_arrival_in_opp.
2) После этого продавец должен принести товар в любой ПВЗ и сказать номер заказа, id товара и его количество.
3) После того как продавец передал товар в ПВЗ, у outerLogisticsService вызывается метод orderReceiveProduct.
4) После того как все товары из заказа прибыли в ПВЗ, нужно вызвать метод outerLogisticsService.formLogistics([order]); Данный метод создат логистические заказы на основе статусов товаров в заказе.

### Бизнес-логика отмены заказа
Цель: вернуть все товары продавцам в ПВЗ, куда они изначально передали товар.
Алгоритм обработки по результатам _calculateCurrentDistribution:
1. waiting_for_product_arrival_in_opp (count единиц)

Товар еще не передан продавцом в ПВЗ
Действие: снять резервацию — увеличить count товара в БД продавца

2. at_start_opp (count единиц)

Реальный статус в БД: arrived_in_opp с is_start_opp: true
Товар в ПВЗ, куда его передал продавец
Действие:

Создать обратный заказ (0₽) для продавца, если еще нет
Добавить товар в этот заказ
Добавить в order_product_statuses:

status = arrived_in_opp
data: {is_target_opp: true, opp_id: ...}

3. at_target_opp (count единиц)

Реальный статус в БД: arrived_in_opp с is_target_opp: true
Товар в целевом ПВЗ для покупателя
Действие:

Создать обратный заказ (0₽) для продавца, если еще нет
Добавить товар в этот заказ
Добавить в order_product_statuses:

status = arrived_in_opp
data: {is_start_opp: true, opp_id: ...}

4. sent_to_logistics (по каждому logistics_order_id)

Товар в пути между ПВЗ
Действие:

Создать обратный заказ (0₽) для продавца, если еще нет
Добавить товар в этот заказ
Добавить в order_product_statuses:

status = sent_to_logistics
data: {previous_logistics_order_id: <исходный logistics_order_id>}

После формаирования заказов, добавления товаров и корректных статусов,нужно вызвать метод planOrderDelivery, 
который вызовет ordersService.calculateCurrentDistribution(), на основе этого метода создаст необходимые логистические заказы,
если они вообще требуются.

### Правила группировки обратных заказов

Один продавец = один обратный заказ на все его товары из отменяемого заказа
Нельзя создавать отдельный заказ на каждый товар
Получатель обратного заказа — продавец
Стоимость обратного заказа — 0₽

Ключевая логика
Система использует те же механизмы заказов для возвратов, что и для обычных покупок. Это элегантное решение, которое:

Не требует изменений в правилах работы ПВЗ
Автоматически обеспечивает трекинг возвратов
Использует существующую логистическую инфраструктуру



