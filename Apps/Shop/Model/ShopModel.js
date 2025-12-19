import BasicShopModel from "../../../Core/Model/BasicShopModel.js";
import { Database } from "../../../Core/Model/Database.js";

class ShopModel extends BasicShopModel {
    constructor() {
        super();
    }

    // Редактирование магазина 
    async update(shopId, { name, description }) {
        const query = `
            UPDATE ${this.tableName}
            SET name = $1,
                description = $2
            WHERE shop_id = $3
            RETURNING *
        `;
        const result = await Database.query(query, [name, description, shopId]);
        return result.rows[0];
    }
}

export default new ShopModel();
