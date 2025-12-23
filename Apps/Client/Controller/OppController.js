import OppModel from "../Model/OppModel.js";

class OppController {

    /**
     * Получить ПВЗ в заданном радиусе от точки
     * GET /api/opp/by-radius?latitude=...&longitude=...&radius=...
     */
    async GetOppsByRadius(req, res) {
        try {
            const { latitude, longitude, radius } = req.query;

            // Валидация параметров
            if (!latitude || !longitude || !radius) {
                return res.status(400).json({
                    success: false,
                    error: 'Параметры latitude, longitude и radius обязательны'
                });
            }

            const lat = parseFloat(latitude);
            const lon = parseFloat(longitude);
            const rad = parseFloat(radius);

            // Проверка корректности значений
            if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
                return res.status(400).json({
                    success: false,
                    error: 'Параметры должны быть числами'
                });
            }

            // Проверка диапазонов
            if (lat < -90 || lat > 90) {
                return res.status(400).json({
                    success: false,
                    error: 'Latitude должна быть в диапазоне от -90 до 90'
                });
            }

            if (lon < -180 || lon > 180) {
                return res.status(400).json({
                    success: false,
                    error: 'Longitude должна быть в диапазоне от -180 до 180'
                });
            }

            if (rad <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Radius должен быть положительным числом'
                });
            }

            // Ограничение максимального радиуса (например, 100 км)
            const maxRadius = 100;
            if (rad > maxRadius) {
                return res.status(400).json({
                    success: false,
                    error: `Максимальный радиус поиска: ${maxRadius} км`
                });
            }

            const opps = (await OppModel.findByRadius(lat, lon, rad)).filter(opp => opp.distance < rad)

            return res.status(200).json({
                success: true,
                data: {
                    opps,
                    count: opps.length,
                    search_params: {
                        latitude: lat,
                        longitude: lon,
                        radius_km: rad
                    }
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении ПВЗ'
            });
        }
    }

    /**
     * Получить все активные ПВЗ
     * GET /api/opp
     */
    async getAllOpps(req, res) {
        try {
            const opps = await OppModel.findAllActive();

            return res.status(200).json({
                success: true,
                data: {
                    opps,
                    count: opps.length
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении списка ПВЗ'
            });
        }
    }

    /**
     * Получить информацию о конкретном ПВЗ
     * GET /api/opp/:oppId
     */
    async getOppById(req, res) {
        try {
            const { oppId } = req.params;

            const oppIdNum = parseInt(oppId);
            if (isNaN(oppIdNum)) {
                return res.status(400).json({
                    success: false,
                    error: 'Некорректный ID ПВЗ'
                });
            }

            const opp = await OppModel.findById(oppIdNum);

            if (!opp) {
                return res.status(404).json({
                    success: false,
                    error: 'ПВЗ не найден'
                });
            }

            return res.status(200).json({
                success: true,
                data: { opp }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                error: 'Ошибка при получении информации о ПВЗ'
            });
        }
    }
}

export default new OppController();