import { Database } from '../../../Core/Model/Database.js';

export default async (req, res, next) => {
  try {
    // Извлечь oppId из параметров (params или body)
    const oppId = req.params.oppId || req.body.opp_id;

    if (!oppId) {
      return res.status(400).json({
        success: false,
        error: 'opp_id_required'
      });
    }

    // Проверить существование ПВЗ и владельца
    const result = await Database.query(
      'SELECT opp_id, owner_id FROM opp WHERE opp_id = $1',
      [oppId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'opp_not_found'
      });
    }

    const opp = result.rows[0];

    // Проверить, что текущий пользователь - владелец
    if (opp.owner_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        error: 'access_denied'
      });
    }

    // Прикрепить информацию о ПВЗ к request
    req.opp = opp;
    next();

  } catch (error) {
    console.error('Error in oppOwnerMiddleware:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error'
    });
  }
};
