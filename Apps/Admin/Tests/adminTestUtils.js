import { Database } from "../../../Core/Model/Database.js";
import tokenService from "../../../Core/Services/tokenService.js";

const TABLES_TO_TRUNCATE = [
    'order_product_statuses',
    'order_statuses',
    'order_products',
    'orders',
    'feedback',
    'products',
    'product_categories',
    'shops',
    'opp',
    'users_tokens',
    'user_profiles',
    'user_login_info',
    'users'
];

export async function resetDatabase() {
    for (const table of TABLES_TO_TRUNCATE) {
        try {
            await Database.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
        } catch (error) {
            console.warn(`Failed to truncate table ${table}: ${error.message}`);
        }
    }
}

export async function createUser({
    email,
    first_name = 'John',
    last_name = 'Doe',
    is_admin = false,
    is_active = true,
    is_activated = true
}) {
    const userRes = await Database.query(
        `INSERT INTO users (registration_date, is_admin, is_active, is_activated)
         VALUES (NOW(), $1, $2, $3)
         RETURNING *`,
        [is_admin, is_active, is_activated],
        true
    );
    const user = userRes.rows[0];

    await Database.query(
        `INSERT INTO user_login_info (email, user_id, password)
         VALUES ($1, $2, $3)`,
        [email, user.user_id, 'test_password'],
        true
    );

    await Database.query(
        `INSERT INTO user_profiles (user_id, first_name, last_name)
         VALUES ($1, $2, $3)`,
        [user.user_id, first_name, last_name],
        true
    );

    return user;
}

export function buildToken(user_id) {
    const { accessToken } = tokenService.generateTokens({ user_id });
    return accessToken;
}

// Удобный хелпер: создать админа + токен
export async function createAdminWithToken(email = 'admin@test.com') {
    const admin = await createUser({ email, is_admin: true });
    return {
        admin,
        token: buildToken(admin.user_id)
    };
}

// Хелпер: заголовок авторизации
export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
