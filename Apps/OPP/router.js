// Apps/OPP/router.js

import authMiddleware from "../../Core/Middleware/authMiddleware.js";
import { requireOPPOwner, requireOrderOwner } from "../../Core/Middleware/oppOwnerMiddleware.js";
import OPPController from "./Controller/OPPController.js";

export default (router) => {
    // Получить информацию о своём ПВЗ
    router.get(
        '/api/opp/my-pvz',
        authMiddleware,
        requireOPPOwner,
        OPPController.getMyPVZ.bind(OPPController)
    );

    // Получить все заказы своего ПВЗ
    router.get(
        '/api/opp/orders',
        authMiddleware,
        requireOPPOwner,
        OPPController.getMyOrders.bind(OPPController)
    );

    // Выдать заказ клиенту
    router.put(
        '/api/opp/orders/:id/issue',
        authMiddleware,
        requireOrderOwner,  // Проверяет что заказ принадлежит ПВЗ владельца
        OPPController.issueOrder.bind(OPPController)
    );
};