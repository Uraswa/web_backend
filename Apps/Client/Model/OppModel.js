import {Database} from "../../../Core/Model/Database.js";

class OppModel {

    /**
     * Найти ПВЗ в радиусе от заданной точки
     * @param {number} latitude - Широта центральной точки
     * @param {number} longitude - Долгота центральной точки
     * @param {number} radiusKm - Радиус поиска в километрах
     * @returns {Promise<Array>} Список ПВЗ с расстоянием
     */
    async findByRadius(latitude, longitude, radiusKm) {
        // Формула Haversine для вычисления расстояния между двумя точками на Земле
        // Результат в километрах
        const query = `
            SELECT
                opp_id,
                address,
                latitude,
                longitude,
                enabled,
                work_time,
                (
                    6371 * acos(
                        cos(radians($1)) *
                        cos(radians(latitude)) *
                        cos(radians(longitude) - radians($2)) +
                        sin(radians($1)) *
                        sin(radians(latitude))
                    )
                ) AS distance
            FROM opp
            WHERE enabled = true
            ORDER BY distance ASC
        `;

        const result = await Database.query(query, [latitude, longitude]);
        return result.rows;
    }

    /**
     * Получить все активные ПВЗ
     * @returns {Promise<Array>}
     */
    async findAllActive() {
        const query = `
            SELECT opp_id, address, latitude, longitude, enabled, work_time
            FROM opp
            WHERE enabled = true
            ORDER BY opp_id
        `;

        const result = await Database.query(query);
        return result.rows;
    }

    /**
     * Найти ПВЗ по ID
     * @param {number} oppId
     * @returns {Promise<Object|null>}
     */
    async findById(oppId) {
        const query = `
            SELECT opp_id, address, latitude, longitude, enabled, work_time
            FROM opp
            WHERE opp_id = $1
        `;

        const result = await Database.query(query, [oppId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
}

export default new OppModel();