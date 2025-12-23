import OPPController from './Controller/OPPController.js';
import authMiddleware from '../../Core/Middleware/authMiddleware.js';
import oppOwnerMiddleware from './Middleware/oppOwnerMiddleware.js';

export default (router) => {

  // Информация о ПВЗ
  router.get('/api/opp/:oppId/statistics',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.getOPPStatistics
  );

  // Заказы
  router.get('/api/opp/:oppId/orders',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.getOPPOrders
  );

  router.get('/api/opp/:oppId/orders/:orderId',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.getOrderDetails
  );

  // Логистические заказы
  router.get('/api/opp/:oppId/logistics-orders',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.getOPPLogisticsOrders
  );

  // Операции с заказами
  router.post('/api/opp/:oppId/deliver',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.deliverOrderToClient
  );

  router.post('/api/opp/:oppId/receive-from-seller',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.receiveFromSeller
  );

  router.post('/api/opp/:oppId/give-to-logistics',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.giveToLogistics
  );

  router.post('/api/opp/:oppId/receive-from-logistics',
    authMiddleware,
    oppOwnerMiddleware,
    OPPController.receiveFromLogistics
  );
}
