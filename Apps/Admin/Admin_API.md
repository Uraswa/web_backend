Admin API
=========

Admin endpoints live under `/api/admin/*` and are protected by `authMiddleware` + `adminMiddleware`. Every request must include `Authorization: Bearer <JWT>` where the user in DB has `is_admin = true`. Non-admin tokens → `403 Forbidden`; missing/invalid token → `401 Unauthorized`.

Response shape
--------------
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": "<message>" }`

Status codes
------------
- `200` OK
- `400` Bad Request (missing/invalid fields)
- `401` Unauthorized (no/invalid token)
- `403` Forbidden (not an admin)
- `404` Not Found (entity not found or owner not active/activated when required)
- `500` Internal Server Error (unexpected)

Stores (shops)
--------------
**GET** `/api/admin/shops`  
- Optional query: `search` (ILIKE by `name`).  
- Response `200`: list of shops with owner info: `shop_id, name, description, owner_id, email, first_name, last_name`.

**POST** `/api/admin/shops`  
- Body JSON: `{ "name": "Shop A", "owner_id": <user_id>, "description": "..." }`  
- Owner must exist and have `is_active = true` and `is_activated = true`.  
- `400` if missing `name` or `owner_id`. `404` if owner not found/not active.

**PUT** `/api/admin/shops/:shopId`  
- Body same as POST (`name` and `owner_id` required).  
- `404` if shop not found or owner not active/activated.

**DELETE** `/api/admin/shops/:shopId`  
- Deletes the shop. `404` if not found.

**POST** `/api/admin/shops/:shopId/seller`  
- Assigns (changes) shop owner. Body: `{ "owner_id": <user_id> }`.  
- Owner must be active/activated. `404` if shop not found or owner not active.

**DELETE** `/api/admin/shops/:shopId/seller`  
- Removes seller and deletes the shop itself. `404` if shop not found.

Pickup points (OPP)
-------------------
**GET** `/api/admin/opps`  
- Optional query: `search` (ILIKE by `address`).  
- Returns list of OPPs.

**POST** `/api/admin/opps`  
- Body:  
  ```json
  {
    "address": "...",          // required
    "latitude": 0,             // required
    "longitude": 0,            // required
    "enabled": true,           // optional, default true
    "work_time": { "mon": "09:00-20:00" }, // optional JSON
    "owner_id": <optional user_id>
  }
  ```  
- If `owner_id` provided, user must be active/activated.  
- `400` if address/lat/lon missing; `404` if owner not active/found.

**PUT** `/api/admin/opps/:oppId`  
- Body: same fields as POST (address/lat/lon required).  
- `404` if OPP not found or owner not active/found.

**DELETE** `/api/admin/opps/:oppId`  
- Removes the pickup point. `404` if not found.

Active users lookup
-------------------
**GET** `/api/admin/users/active?search=`  
- Returns only users with `is_active=true` AND `is_activated=true`.  
- `search` filters by email/first_name/last_name (ILIKE).  
- Used for dropdowns when assigning shop/OPP owners.

Examples (curl)
---------------
- Create shop:  
  `curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Shop A","owner_id":5}' http://localhost:8000/api/admin/shops`
- Assign seller:  
  `curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"owner_id":6}' http://localhost:8000/api/admin/shops/1/seller`
- Create OPP:  
  `curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"address":"City","latitude":55.7,"longitude":37.6,"owner_id":5}' http://localhost:8000/api/admin/opps`
