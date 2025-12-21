import BasicProductModel from "../../../Core/Model/BasicProductModel.js";
import {Database} from "../../../Core/Model/Database.js";

class ProductModel extends BasicProductModel {
    constructor() {
        super();
    }

    _getFindWithFiltersRequest(filters = {}){
        let query = `
            SELECT p.*, pc.name as category_name, s.name as shop_name
            FROM ${this.tableName} p
                     JOIN product_categories pc ON p.category_id = pc.category_id
                     JOIN shops s ON p.shop_id = s.shop_id
            WHERE 1 = 1
        `;

        const values = [];
        let paramCount = 1;

        // Фильтр по категории
        if (filters.category_id) {
            query += ` AND p.category_id = $${paramCount}`;
            values.push(filters.category_id);
            paramCount++;
        }

        // Фильтр по магазину
        if (filters.shop_id) {
            query += ` AND p.shop_id = $${paramCount}`;
            values.push(filters.shop_id);
            paramCount++;
        }

        // Фильтр по цене (мин)
        if (filters.min_price) {
            query += ` AND p.price >= $${paramCount}`;
            values.push(filters.min_price);
            paramCount++;
        }

        // Фильтр по цене (макс)
        if (filters.max_price) {
            query += ` AND p.price <= $${paramCount}`;
            values.push(filters.max_price);
            paramCount++;
        }

        // Поиск по названию
        if (filters.search) {
            query += ` AND p.name ILIKE $${paramCount}`;
            values.push(`%${filters.search}%`);
            paramCount++;
        }
        // Фильтрация по характеристикам
        if (filters.char_filters && filters.char_filters.length > 0) {
            // Проверяем, что характеристики - JSONB или приводим к JSONB
            for (let char_filter of filters.char_filters) {
                if (!char_filter.filter) continue;

                const multiValues = Array.isArray(char_filter.values)
                    ? char_filter.values
                    : (Array.isArray(char_filter.value) ? char_filter.value : null);

                if (multiValues && multiValues.length > 0) {
                    query += ` AND p.characteristics ? $${paramCount}`;
                    values.push(char_filter.filter);
                    paramCount++;

                    query += ` AND jsonb_extract_path_text(p.characteristics, $${paramCount}) = ANY($${paramCount + 1})`;
                    values.push(char_filter.filter, multiValues);
                    paramCount += 2;
                } else if (char_filter.value !== undefined) {
                    // Используем jsonb_exists и jsonb_extract_path_text для безопасной фильтрации
                    query += ` AND p.characteristics ? $${paramCount}`;
                    values.push(char_filter.filter);
                    paramCount++;

                    query += ` AND jsonb_extract_path_text(p.characteristics, $${paramCount}) = $${paramCount + 1}`;
                    values.push(char_filter.filter, char_filter.value);
                    paramCount += 2;
                }
                // TODO CHAR_FILTER MIN, MAX VALIDATION: лучше бы это валидировать, а то если досить неправильными фильтрами, то можно положить БД
                else if (char_filter.min !== undefined || char_filter.max !== undefined){
                    query += ` AND p.characteristics ? $${paramCount}`;
                    values.push(char_filter.filter);
                    paramCount++;

                    if (char_filter.min !== undefined && Number.isFinite(Number.parseFloat(char_filter.min))){
                        const minNum = Number.parseFloat(char_filter.min);
                        query += ` AND (
                            COALESCE(
                                NULLIF(jsonb_extract_path_text(p.characteristics, $${paramCount}), '')::numeric,
                                0
                            ) >= $${paramCount + 1}
                        )`;
                        values.push(char_filter.filter, minNum);
                        paramCount += 2;
                    }

                    if (char_filter.max !== undefined && Number.isFinite(Number.parseFloat(char_filter.max))){
                        const maxNum = Number.parseFloat(char_filter.max);
                        query += ` AND (
                            COALESCE(
                                NULLIF(jsonb_extract_path_text(p.characteristics, $${paramCount}), '')::numeric,
                                999999999
                            ) <= $${paramCount + 1}
                        )`;
                        values.push(char_filter.filter, maxNum);
                        paramCount += 2;
                    }
                }
            }
        }

        return [query, values]
    }

    async findWithFilters(filters = {}, limit = 50, offset = 0) {

        let [query, values] = this._getFindWithFiltersRequest(filters);
        let paramCount = values.length + 1;

        // Сортировка
        const orderBy = filters.order_by || 'created_at';
        const orderDirection = filters.order_direction === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY p.${orderBy} ${orderDirection}`;

        // Пагинация
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await Database.query(query, values);
        return result.rows;
    }

    async countWithFilters(filters = {}) {
        let [query, values] = this._getFindWithFiltersRequest(filters);
        query = `SELECT COUNT(*) FROM (${query})`
        const result = await Database.query(query, values);
        return result.rows[0].count;
    }

    async getPopularProducts(limit = 20) {
        const query = `
            SELECT p.*, COUNT(op.product_id) as order_count
            FROM ${this.tableName} p
                     LEFT JOIN order_products op ON p.product_id = op.product_id
            GROUP BY p.product_id
            ORDER BY order_count DESC, p.created_at DESC
            LIMIT $1
        `;
        const result = await Database.query(query, [limit]);
        return result.rows;
    }
}

export default new ProductModel();
