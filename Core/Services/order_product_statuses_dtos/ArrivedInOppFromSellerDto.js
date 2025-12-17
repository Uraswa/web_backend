/**
 * DTO для статуса arrived_in_opp когда товар получен от продавца
 *
 * Выделен для обеспечения:
 * - Стандартизации данных при первичном поступлении товара от продавца в ПВЗ
 * - Четкой идентификации стартового ПВЗ (откуда начинается доставка)
 * - Отличия товаров, полученных от продавца, от товаров, пришедших из логистики
 *
 * Используется в сценарии:
 * Продавец приносит товар в любой ПВЗ → этот ПВЗ становится стартовым для доставки
 */
class ArrivedInOppFromSellerDto {
    /**
     * @param {number} oppId - ID ПВЗ, куда продавец передал товар
     */
    constructor(oppId) {
        this.opp_id = oppId;
        this.is_start_opp = true;
        this.from_seller = true;
    }

    toJSON() {
        return {
            opp_id: this.opp_id,
            is_start_opp: this.is_start_opp,
            from_seller: this.from_seller
        };
    }
}

export default ArrivedInOppFromSellerDto;
