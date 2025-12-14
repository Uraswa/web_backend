/**
 * DTO для статуса sent_to_logistics при возврате товара (обратный логистический заказ)
 *
 * Выделен для обеспечения:
 * - Отслеживания изменения направления доставки (товар разворачивается обратно)
 * - Связи с предыдущим логистическим заказом (который был до отмены)
 * - Идентификации возвратных логистических операций
 * - Связи с оригинальным заказом, который был отменен
 *
 * Используется в сценарии:
 * Заказ отменен → товар уже в логистике → нужно развернуть доставку обратно
 */
class SentToLogisticsReturnDto {
    /**
     * @param {number} previousLogisticsOrderId - ID предыдущего логистического заказа (до отмены)
     * @param {number} originalOrderId - ID оригинального заказа, который был отменен
     */
    constructor(previousLogisticsOrderId, originalOrderId) {
        this.previous_logistics_order_id = previousLogisticsOrderId;
        this.return_order = true;
        this.original_order_id = originalOrderId;
    }

    toJSON() {
        return {
            previous_logistics_order_id: this.previous_logistics_order_id,
            return_order: this.return_order,
            original_order_id: this.original_order_id
        };
    }
}

export default SentToLogisticsReturnDto;
