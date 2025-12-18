import OppAdminModel from "../Model/OppAdminModel.js";
import BasicUserModel from "../../../Core/Model/BasicUserModel.js";

const userModel = new BasicUserModel();

class OppController {
    // Список ПВЗ (поиск по адресу)
    async listOpp(req, res) {
        try {
            const { search } = req.query;
            const opps = await OppAdminModel.findAllWithOwner(search);

            return res.status(200).json({
                success: true,
                data: opps
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при получении ПВЗ"
            });
        }
    }

    // Создание ПВЗ
    async createOpp(req, res) {
        try {
            const { address, latitude, longitude, enabled = true, work_time, owner_id } = req.body;

            if (!address || latitude === undefined || longitude === undefined) {
                return res.status(400).json({
                    success: false,
                    error: "address, latitude, longitude обязательны"
                });
            }

            if (owner_id) {
                const owner = await userModel.getUserById(owner_id);
                if (!owner || !owner.is_active || !owner.is_activated) {
                    return res.status(404).json({
                        success: false,
                        error: "Пользователь не найден или не активирован"
                    });
                }
            }

            const opp = await OppAdminModel.createOpp({
                address,
                latitude,
                longitude,
                enabled,
                work_time,
                owner_id
            });

            return res.status(200).json({
                success: true,
                data: opp
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при создании ПВЗ"
            });
        }
    }

    // Обновление ПВЗ
    async updateOpp(req, res) {
        try {
            const { oppId } = req.params;
            const { address, latitude, longitude, enabled = true, work_time, owner_id } = req.body;

            if (!oppId) {
                return res.status(400).json({
                    success: false,
                    error: "oppId обязателен"
                });
            }

            if (!address || latitude === undefined || longitude === undefined) {
                return res.status(400).json({
                    success: false,
                    error: "address, latitude, longitude обязательны"
                });
            }

            const existing = await OppAdminModel.findById(oppId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error: "ПВЗ не найден"
                });
            }

            if (owner_id) {
                const owner = await userModel.getUserById(owner_id);
                if (!owner || !owner.is_active || !owner.is_activated) {
                    return res.status(404).json({
                        success: false,
                        error: "Пользователь не найден или не активирован"
                    });
                }
            }

            const updated = await OppAdminModel.updateOpp(oppId, {
                address,
                latitude,
                longitude,
                enabled,
                work_time,
                owner_id
            });

            return res.status(200).json({
                success: true,
                data: updated
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при обновлении ПВЗ"
            });
        }
    }

    // Удаление ПВЗ
    async deleteOpp(req, res) {
        try {
            const { oppId } = req.params;

            if (!oppId) {
                return res.status(400).json({
                    success: false,
                    error: "oppId обязателен"
                });
            }

            const deleted = await OppAdminModel.deleteOpp(oppId);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: "ПВЗ не найден"
                });
            }

            return res.status(200).json({
                success: true,
                data: { opp_id: deleted.opp_id }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                error: "Ошибка при удалении ПВЗ"
            });
        }
    }
}

export default new OppController();
