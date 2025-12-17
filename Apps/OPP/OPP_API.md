OPP API
=======

Документация REST‑эндпоинтов личного кабинета владельца пункта выдачи заказов (ПВЗ). Все ручки доступны только авторизованным владельцам конкретного ПВЗ.

Аутентификация и авторизация
----------------------------
- Каждый запрос требует заголовок `Authorization: Bearer <JWT>`.
- `oppOwnerMiddleware` проверяет, что `user_id` токена совпадает с владельцем ПВЗ (`opp.owner_id`). В противном случае возвращается `403 Access Denied`.
- При отсутствии токена/невалидном токене возвращается `401 Unauthorized`.

Формат ответов
--------------
- Успех: `{ "success": true, "data": { ... } }`
- Ошибка: `{ "success": false, "error": "<код>" [, "meta": {...}] }`

Эндпоинты
---------

### 1. GET `/api/opp/:oppId/statistics`
- Описание: агрегация по заказам конкретного ПВЗ.
- Параметры: `oppId` — ID ПВЗ.
- Ответ `200`:
  ```json
  {
    "success": true,
    "data": {
      "total_orders": 24,
      "active_orders": 3,
      "...": "доп. счётчики модели"
    }
  }
  ```
- Ошибки: `404` если ПВЗ не найден/не принадлежит пользователю.

### 2. GET `/api/opp/:oppId/orders?status=waiting|done|canceled`
- Описание: список заказов по ПВЗ с фильтром по статусу (по умолчанию все).
- Ответ `200`:
  ```json
  {
    "success": true,
    "data": {
      "orders": [ { "order_id": 1, "...": "поля ORM" } ],
      "count": 1
    }
  }
  ```
- Ошибки: `401/403` как описано выше.

### 3. GET `/api/opp/:oppId/orders/:orderId`
- Описание: подробные данные заказа (товары, цены, статусы).
- Ответ `200`:
  ```json
  { "success": true, "data": { "order_id": 1, "products": [ ... ] } }
  ```
- Ошибка `404` → `{ "success": false, "error": "order_not_found" }`.

### 4. GET `/api/opp/:oppId/logistics-orders?direction=all|incoming|outgoing`
- Описание: виртуальные логистические заказы для маршрутов стартовый ПВЗ → целевой ПВЗ.
- Параметр `direction` необязателен (по умолчанию `all`).
- Ответ `200`:
  ```json
  {
    "success": true,
    "data": {
      "logistics_orders": [ { "logistics_order_id": 1, "source_opp_id": 5, ... } ],
      "count": 1,
      "direction": "outgoing"
    }
  }
  ```

### 5. POST `/api/opp/:oppId/receive-from-seller`
- Назначение: регистрация поставки товара от продавца в стартовый ПВЗ.
- Тело:
  ```json
  { "order_id": 1, "product_id": 11, "count": 2 }
  ```
- Ответ `200` (успех):
  ```json
  {
    "success": true,
    "data": {
      "message": "Товар принят в ПВЗ",
      "order_id": 1,
      "logistics_info": { "...": "данные planOrderDelivery" }
    }
  }
  ```
- Ошибки:
  - `400 missing_required_fields` — если не хватает `order_id / product_id / count`.
  - `200` с `success:false` и сообщением из `ordersService` — если товар не в заказе или количество превышает ожидание.

### 6. POST `/api/opp/:oppId/give-to-logistics`
- Назначение: передача товара логисту.
- Тело:
  ```json
  { "order_id": 1, "logistics_order_id": 7, "product_id": 11, "count": 2 }
  ```
- Ответ `200` успех: сообщение + `logistics_order_id`.
- Ошибки:
  - `400 missing_required_fields` без обязательных полей.
  - `200` с `success:false` и текстом из `ordersService` — неправильный ПВЗ, логистический заказ не найден, недостаточно товара в ПВЗ.

### 7. POST `/api/opp/:oppId/receive-from-logistics`
- Назначение: подтверждение получения товаров целевым ПВЗ из логистического заказа.
- Тело: `{ "logistics_order_id": 7 }`.
- Ответ `200` успех: `logistics_order_id`, `target_opp_id`, `total_items`.
- Ошибки:
  - `400 logistics_order_id_required`.
  - `403` при попытке чужого владельца.
  - `200` с `success:false` если логистический заказ не найден.

### 8. POST `/api/opp/:oppId/deliver`
- Назначение: выдача заказа клиенту в целевом ПВЗ, с возможностью отклонить позиции.
- Тело:
  ```json
  {
    "order_id": 1,
    "rejected_products": [
      { "product_id": 11, "count": 1 }
    ]
  }
  ```
- Правила:
  - `order_id` обязателен (`400 order_id_required`).
  - `rejected_products` валидируются: обязательны `product_id` и `count > 0`; суммарное отклоняемое количество не может превышать оставшихся единиц товара в заказе. При нарушении возвращается `400 rejected_count_exceeds_available`.
  - Выдавать можно только из целевого ПВЗ (`success:false` с текстом `ordersService`).
- Успешный ответ `200` содержит `delivered_count`, `rejected_count`, `is_completed`, `return_orders`.

Типовые ошибки
--------------
- `401 Unauthorized` — нет токена или он невалиден.
- `403 Access Denied` — пользователь не владелец ПВЗ.
- `404` — запрашиваемый `oppId`/`orderId` отсутствует либо принадлежит другому владельцу.

Тесты
-----
Для автоматической проверки всех сценариев:
```bash
npm test -- Apps/OPP/Tests/OppController.test.js
```
Сьют поднимает Express‑сервер, заполняет БД тестовыми данными и покрывает все описанные выше эндпоинты, включая негативные кейсы.
