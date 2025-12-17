/**
 * DTO для статуса delivered когда товар выдан покупателю
 *
 * Выделен для обеспечения:
 * - Фиксации факта завершения доставки
 * - Отслеживания ПВЗ выдачи товара
 * - Идентификации успешно выданных товаров для отчетности
 * - Отличия от других финальных статусов (refunded)
 *
 * Используется в сценарии:
 * Покупатель забирает товар из целевого ПВЗ → заказ завершается
 */
class DeliveredDto {
    /**
     * @param {number} oppId - ID ПВЗ, где покупатель получил товар
     */
    constructor(oppId) {
        this.opp_id = oppId;
        this.delivered_to_customer = true;
    }

    toJSON() {
        return {
            opp_id: this.opp_id,
            delivered_to_customer: this.delivered_to_customer
        };
    }
}

export default DeliveredDto;
