# Order Product Statuses DTOs

Эта директория содержит Data Transfer Objects (DTO) для стандартизации структуры поля `data` в таблице `order_product_statuses`.

## Зачем нужны DTOs?

До введения DTOs поле `data` заполнялось произвольными JSON-объектами, что приводило к:
- Несогласованности структуры данных
- Ошибкам из-за опечаток в названиях полей
- Сложности понимания какие поля должны быть в каждом статусе
- Проблемам при рефакторинге

DTOs решают эти проблемы через:
- **Типобезопасность**: Четкая структура для каждого типа статуса
- **Самодокументирование**: Комментарии объясняют назначение каждого DTO
- **Централизованное управление**: Изменения в одном месте
- **Валидация**: Обязательные поля проверяются в конструкторе

## Структура DTOs

### 1. ArrivedInOppFromSellerDto
**Когда**: Продавец передает товар в ПВЗ
**Поля**:
- `opp_id` - ID ПВЗ, куда передан товар
- `is_start_opp: true` - Стартовый ПВЗ для доставки
- `from_seller: true` - Получено от продавца

**Пример использования**:
```javascript
import { ArrivedInOppFromSellerDto } from './order_product_statuses_dtos/index.js';

const dto = new ArrivedInOppFromSellerDto(oppId);
await client.query(
    'INSERT INTO order_product_statuses (order_id, product_id, order_product_status, count, date, data) VALUES ($1, $2, $3, $4, NOW(), $5)',
    [orderId, productId, 'arrived_in_opp', count, JSON.stringify(dto)]
);
```

### 2. ArrivedInOppFromLogisticsDto
**Когда**: Логист доставляет товар в целевой ПВЗ
**Поля**:
- `from_logistics_order_id` - ID логистического заказа
- `is_target_opp: true` - Целевой ПВЗ (для выдачи покупателю)
- `opp_id` - ID целевого ПВЗ

### 3. ArrivedInOppReturnOrderDto
**Когда**: Товар возвращается при отмене заказа
**Поля**:
- `opp_id?` - ID ПВЗ (опционально)
- `is_start_opp` - Стартовый ПВЗ для возврата
- `is_target_opp` - Целевой ПВЗ для возврата
- `return_order: true` - Флаг обратного заказа
- `original_order_id` - ID отмененного заказа

### 4. SentToLogisticsDto
**Когда**: Товар передан логисту для доставки
**Поля**:
- `logistics_order_id` - ID логистического заказа
- `from_opp_id?` - ID ПВЗ отправления (опционально)

### 5. SentToLogisticsReturnDto
**Когда**: Товар в логистике разворачивается обратно при отмене
**Поля**:
- `previous_logistics_order_id` - ID предыдущего логистического заказа
- `return_order: true` - Флаг возврата
- `original_order_id` - ID отмененного заказа

### 6. DeliveredDto
**Когда**: Товар выдан покупателю
**Поля**:
- `opp_id` - ID ПВЗ выдачи
- `delivered_to_customer: true` - Флаг выдачи

### 7. RefundedDto
**Когда**: Товар возвращен/отменен
**Поля**:
- `reason` - Причина возврата
- `from_status` - Из какого статуса возврат
- `returned_to_stock?` - Возврат на склад (опционально)
- `return_order_created?` - Создан обратный заказ (опционально)
- `from_logistics_order_id?` - ID логистического заказа (опционально)

### 8. WaitingForProductArrivalDto
**Когда**: Создан новый заказ (начальный статус)
**Поля**:
- `order_id` - ID заказа
- `initial_reservation: true` - Флаг начальной резервации

## Жизненный цикл товара

```
Создание заказа
    ↓
WaitingForProductArrivalDto (waiting_for_product_arrival_in_opp)
    ↓
ArrivedInOppFromSellerDto (arrived_in_opp + is_start_opp)
    ↓
SentToLogisticsDto (sent_to_logistics)
    ↓
ArrivedInOppFromLogisticsDto (arrived_in_opp + is_target_opp)
    ↓
DeliveredDto (delivered) ✓

При отмене:
    ↓
RefundedDto (refunded)
    ↓
ArrivedInOppReturnOrderDto (arrived_in_opp для обратного заказа)
    ↓
SentToLogisticsReturnDto (sent_to_logistics для возврата)
```

## Миграция существующего кода

При рефакторинге старого кода заменяйте:

**Было**:
```javascript
JSON.stringify({
    opp_id: oppId,
    is_start_opp: true,
    from_seller: true
})
```

**Стало**:
```javascript
JSON.stringify(new ArrivedInOppFromSellerDto(oppId))
```

## Расширение

При добавлении новых статусов или полей:
1. Создайте новый DTO класс в этой директории
2. Добавьте подробные комментарии о назначении
3. Экспортируйте из `index.js`
4. Обновите этот README
