OPP API
=======

This document describes the owner portal endpoints that live under `/api/opp/*`.

Authentication & Authorization
------------------------------
- Every request must contain `Authorization: Bearer <JWT>`.
- `oppOwnerMiddleware` ensures the token user is the owner of the requested OPP (`opp.owner_id`). Otherwise `403 Access Denied`.
- Missing/invalid token results in `401 Unauthorized`.

Response Shape
--------------
- Success: `{ "success": true, "data": { ... } }`
- Failure: `{ "success": false, "error": "<error_code>", ["meta": {...}] }`

Endpoints
---------

### GET `/api/opp/:oppId/statistics`
- Purpose: aggregated counters for the selected OPP.
- Query params: none.
- 200 response:
  ```json
  { "success": true, "data": { "total_orders": 24, "active_orders": 3, "..." : "model dependent" } }
  ```
- Errors: `404` if the OPP does not exist or belongs to another owner.

### GET `/api/opp/:oppId/orders?status=waiting|done|canceled`
- Purpose: list of orders with optional status filter (default – all).
- 200 response:
  ```json
  { "success": true, "data": { "orders": [ { "order_id": 1, ... } ], "count": 1 } }
  ```
- Errors: `401/403` for auth failures.

### GET `/api/opp/:oppId/orders/:orderId`
- Purpose: detailed order with products, seller info and status history.
- Success: `{ "success": true, "data": { "order_id": 1, "products": [ ... ] } }`
- Error: `404` → `{ "success": false, "error": "order_not_found" }`.

### GET `/api/opp/:oppId/logistics-orders?direction=all|incoming|outgoing`
- Purpose: inspect virtual logistics orders generated for the OPP.
- Query `direction` defaults to `all`.
- 200 response: `{ "success": true, "data": { "logistics_orders": [...], "count": 1, "direction": "outgoing" } }`

### POST `/api/opp/:oppId/receive-from-seller`
- Purpose: register that the start OPP received goods from the seller.
- Body:
  ```json
  { "order_id": 1, "product_id": 11, "count": 2 }
  ```
- Success: returns logistics planning info from `OuterLogisticsService`.
- Errors:
  - `400 missing_required_fields`.
  - Business errors with `success:false` (product not in order, exceeding waiting amount, etc.).

### POST `/api/opp/:oppId/give-to-logistics`
- Purpose: hand over goods to a logistics order.
- Body:
  ```json
  { "order_id": 1, "logistics_order_id": 7, "product_id": 11, "count": 2 }
  ```
- Success: confirms the transfer.
- Errors: `400 missing_required_fields`, or business errors (wrong OPP, unknown logistics order, insufficient stock).

### POST `/api/opp/:oppId/receive-from-logistics`
- Purpose: confirm that the target OPP received products from a logistics order.
- Body: `{ "logistics_order_id": 7 }`
- Errors: `400 logistics_order_id_required`, `403` when another owner tries to act, or `success:false` when logistics order is unknown.

### POST `/api/opp/:oppId/deliver`
- Purpose: deliver the order to the buyer at the target OPP, optionally rejecting items.
- Body:
  ```json
  {
    "order_id": 1,
    "rejected_products": [
      { "product_id": 11, "count": 1 }
    ]
  }
  ```
- Rules:
  - `order_id` is mandatory (`400 order_id_required`).
  - Each rejected item must have `product_id` and `count > 0`.
  - The API validates that the total rejected count per product does not exceed the remaining quantity in the order. Violations yield `400 rejected_count_exceeds_available` with `meta.product_id`, `requested`, `available`.
  - Orders can be delivered only from their target OPP (error text propagated from `ordersService`).
- Success response contains `delivered_count`, `rejected_count`, `is_completed`, `return_orders`.

Common Errors
-------------
- `401 Unauthorized` – missing or invalid token.
- `403 Access Denied` – user is not the owner of the OPP.
- `404` – OPP/order not found or not owned by the user.

Tests
-----
Run the full suite to cover every endpoint and negative path:
```bash
npm test -- Apps/OPP/Tests/OppController.test.js
```
The tests start the Express app, reseed the database, run through receive/give/logistics/deliver flows, and ensure the API contract described above.
