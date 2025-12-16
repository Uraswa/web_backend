/**
 * DTO для статуса waiting_for_product_arrival_in_opp (начальный статус при создании заказа)
 *
 * Выделен для обеспечения:
 * - Фиксации начального резервирования товара
 * - Отличия начального статуса от других статусов ожидания
 * - Связи с заказом для отслеживания резервации
 *
 * Используется в сценарии:
 * Создан новый заказ → товар зарезервирован на складе → ожидает передачи продавцом в ПВЗ
 */
class WaitingForProductArrivalDto {
    /**
     * @param {number} orderId - ID заказа для которого создана резервация
     */
    constructor(orderId) {
        this.order_id = orderId;
        this.initial_reservation = true;
    }

    toJSON() {
        return {
            order_id: this.order_id,
            initial_reservation: this.initial_reservation
        };
    }
}

export default WaitingForProductArrivalDto;
