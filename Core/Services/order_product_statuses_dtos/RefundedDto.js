/**
 * DTO для статуса refunded когда товар возвращен (отменен)
 *
 * Выделен для обеспечения:
 * - Фиксации причины возврата товара
 * - Отслеживания из какого статуса был сделан возврат
 * - Идентификации типа возврата (на склад или через обратный заказ)
 * - Связи с логистическими заказами при возврате из доставки
 *
 * Используется в сценариях:
 * - Отмена заказа → возврат товара на склад или продавцу
 * - Различные этапы отмены (товар ждет отгрузки, в ПВЗ, в логистике)
 */
class RefundedDto {
    /**
     * @param {string} reason - Причина возврата
     * @param {string} fromStatus - Из какого статуса был возврат
     * @param {Object} options - Дополнительные опции
     * @param {boolean} options.returnedToStock - Товар возвращен на склад продавца
     * @param {boolean} options.returnOrderCreated - Создан обратный заказ для возврата
     * @param {number} options.fromLogisticsOrderId - ID логистического заказа (если возврат из логистики)
     */
    constructor(reason, fromStatus, options = {}) {
        this.reason = reason;
        this.from_status = fromStatus;

        if (options.returnedToStock) {
            this.returned_to_stock = true;
        }
        if (options.returnOrderCreated) {
            this.return_order_created = true;
        }
        if (options.fromLogisticsOrderId) {
            this.from_logistics_order_id = options.fromLogisticsOrderId;
        }
    }

    toJSON() {
        const result = {
            reason: this.reason,
            from_status: this.from_status
        };

        if (this.returned_to_stock !== undefined) {
            result.returned_to_stock = this.returned_to_stock;
        }
        if (this.return_order_created !== undefined) {
            result.return_order_created = this.return_order_created;
        }
        if (this.from_logistics_order_id !== undefined) {
            result.from_logistics_order_id = this.from_logistics_order_id;
        }

        return result;
    }
}

export default RefundedDto;
