/**
 * Центральный экспорт всех DTO для статусов товаров
 *
 * Данные DTOs стандартизируют структуру поля `data` в таблице order_product_statuses,
 * обеспечивая:
 * - Типобезопасность и предсказуемость структуры данных
 * - Самодокументируемость кода (понятно какие поля должны быть в каждом статусе)
 * - Легкость рефакторинга (изменения в одном месте)
 * - Валидацию данных на этапе создания статуса
 */

import ArrivedInOppFromSellerDto from './ArrivedInOppFromSellerDto.js';
import ArrivedInOppFromLogisticsDto from './ArrivedInOppFromLogisticsDto.js';
import ArrivedInOppReturnOrderDto from './ArrivedInOppReturnOrderDto.js';
import SentToLogisticsDto from './SentToLogisticsDto.js';
import SentToLogisticsReturnDto from './SentToLogisticsReturnDto.js';
import DeliveredDto from './DeliveredDto.js';
import RefundedDto from './RefundedDto.js';
import WaitingForProductArrivalDto from './WaitingForProductArrivalDto.js';
import PlanOrderDeliveryOrderDto from './PlanOrderDeliveryOrderDto.js';

export {
    ArrivedInOppFromSellerDto,
    ArrivedInOppFromLogisticsDto,
    ArrivedInOppReturnOrderDto,
    SentToLogisticsDto,
    SentToLogisticsReturnDto,
    DeliveredDto,
    RefundedDto,
    WaitingForProductArrivalDto,
    PlanOrderDeliveryOrderDto
};
