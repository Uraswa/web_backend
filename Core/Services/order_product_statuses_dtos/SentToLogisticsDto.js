/**
 * DTO для статуса sent_to_logistics когда товар передан в логистическую доставку
 *
 * Выделен для обеспечения:
 * - Связи товара с конкретным логистическим заказом
 * - Отслеживания ПВЗ отправления (откуда забрали товар)
 * - Мониторинга товаров в пути между ПВЗ
 *
 * Используется в сценарии:
 * Товар передан логисту для доставки из одного ПВЗ в другой
 */
class SentToLogisticsDto {
    /**
     * @param {number} logisticsOrderId - ID логистического заказа
     * @param {number|null} fromOppId - ID ПВЗ, откуда забран товар (опционально)
     * @param previousLogisticsOrderId - ID предыдущего логистического заказа
     */
    constructor(logisticsOrderId, fromOppId = null, previousLogisticsOrderId = null) {
        this.logistics_order_id = logisticsOrderId;

        if (fromOppId !== null && fromOppId !== 0) {
            this.from_opp_id = fromOppId;
        }

        if (previousLogisticsOrderId !== null && previousLogisticsOrderId !== 0) {
            this.previous_logistics_order_id = Number.parseInt(previousLogisticsOrderId);
        }
    }

    toJSON() {
        const result = {
            logistics_order_id: this.logistics_order_id
        };

        if (this.from_opp_id !== undefined) {
            result.from_opp_id = this.from_opp_id;
        }

        if (this.previous_logistics_order_id !== undefined) {
            result.previous_logistics_order_id = this.previous_logistics_order_id;
        }

        return result;
    }
}

export default SentToLogisticsDto;
