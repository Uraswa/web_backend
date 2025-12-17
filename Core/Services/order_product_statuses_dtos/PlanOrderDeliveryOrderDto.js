/**
 * DTO для заказа чтобы спланировать доставку

 */
class PlanOrderDeliveryOrderDto {
    /**
     * @param {number} order_id - ID заказа
     * @param {number} receiver_id - ID пользователя-получателя заказа
     * @param {number} target_opp_id - ID ПВЗ, куда нужно привезти заказ
     * @param {number} original_order_id - ID изначального заказа, указывать только в случае если заказ обратный
     */
    order_id
    receiver_id
    target_opp_id
    original_order_id

    constructor(order_id, receiver_id, target_opp_id, original_order_id = null) {
        this.order_id = order_id;
        this.receiver_id = receiver_id;
        this.target_opp_id = target_opp_id;
        this.original_order_id = original_order_id;
    }

    toJSON() {
        return {
            order_id: this.order_id,
            receiver_id: this.receiver_id,
            target_opp_id: this.target_opp_id,
            original_order_id: this.original_order_id
        };
    }
}

export default PlanOrderDeliveryOrderDto;