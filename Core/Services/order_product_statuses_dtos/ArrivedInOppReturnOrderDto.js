/**
 * DTO для статуса arrived_in_opp при возврате товара (обратный заказ)
 *
 * Выделен для обеспечения:
 * - Идентификации обратных заказов (отмена/возврат)
 * - Отслеживания оригинального заказа, из которого происходит возврат
 * - Определения направления возврата (is_start_opp vs is_target_opp)
 * - Отличия возвратных товаров от обычных поступлений
 *
 * Используется в сценариях:
 * - Товар возвращается из целевого ПВЗ покупателя обратно к продавцу
 * - Товар уже находится у продавца и помечается как готовый к возврату
 */
class ArrivedInOppReturnOrderDto {
    /**
     * @param {number} oppId - ID ПВЗ, где находится товар
     * @param {boolean} isStartOpp - true если это стартовый ПВЗ для возврата
     * @param {boolean} isTargetOpp - true если это целевой ПВЗ для возврата (обычно ПВЗ продавца)
     * @param {number} originalOrderId - ID оригинального заказа, который отменяется
     */
    constructor(oppId, isStartOpp, isTargetOpp, originalOrderId) {
        if (oppId) {
            this.opp_id = oppId;
        }
        this.is_start_opp = isStartOpp;
        this.is_target_opp = isTargetOpp;
        this.return_order = true;
        this.original_order_id = originalOrderId;
    }

    toJSON() {
        const result = {
            return_order: this.return_order,
            original_order_id: this.original_order_id
        };

        if (this.opp_id !== undefined) {
            result.opp_id = this.opp_id;
        }
        if (this.is_start_opp) {
            result.is_start_opp = this.is_start_opp;
        }
        if (this.is_target_opp) {
            result.is_target_opp = this.is_target_opp;
        }

        return result;
    }
}

export default ArrivedInOppReturnOrderDto;
