/**
 * DTO для статуса arrived_in_opp когда товар прибыл из логистической доставки
 *
 * Выделен для обеспечения:
 * - Отслеживания цепочки доставки (из какого логистического заказа прибыл товар)
 * - Идентификации целевого ПВЗ (конечная точка доставки для покупателя)
 * - Связи между логистическими заказами и статусами товаров
 *
 * Используется в сценарии:
 * Логист доставляет товары в целевой ПВЗ → товары готовы к выдаче покупателю
 */
class ArrivedInOppFromLogisticsDto {
    /**
     * @param {number} logisticsOrderId - ID логистического заказа, которым доставлен товар
     * @param {number} oppId - ID целевого ПВЗ (где покупатель заберет товар)
     */
    constructor(logisticsOrderId, oppId) {
        this.from_logistics_order_id = logisticsOrderId;
        this.is_target_opp = true;
        this.opp_id = oppId;
    }

    toJSON() {
        return {
            from_logistics_order_id: this.from_logistics_order_id,
            is_target_opp: this.is_target_opp,
            opp_id: this.opp_id
        };
    }
}

export default ArrivedInOppFromLogisticsDto;
