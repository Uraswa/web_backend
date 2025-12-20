import request from 'supertest';
import { app, server } from '../../../index.js';
import {
    resetDatabase,
    createUser,
    createAdminWithToken,
    buildToken,
    authHeader
} from './adminTestUtils.js';

describe('Admin active users lookup', () => {
    let adminToken;
    let nonAdminToken;

    beforeEach(async () => {
        await resetDatabase();
        const adminBundle = await createAdminWithToken();
        adminToken = adminBundle.token;

        await createUser({ email: 'active1@test.com', first_name: 'Ivan', last_name: 'Ivanov' });
        await createUser({ email: 'inactive@test.com', is_active: false, is_activated: false });

        const nonAdmin = await createUser({ email: 'user@test.com', is_admin: false });
        nonAdminToken = buildToken(nonAdmin.user_id);
    });

    afterAll(async () => {
        await server.close();
    });

    it('возвращает только активных/активированных пользователей', async () => {
        const res = await request(app)
            .get('/api/admin/users/active')
            .set(authHeader(adminToken))
            .expect(200);

        expect(res.body.success).toBe(true);
        const emails = res.body.data.map((u) => u.email);
        expect(emails).toContain('active1@test.com');
        // не должно быть неактивных
        expect(emails).not.toContain('inactive@test.com');
    });

    it('фильтрует по email/имени', async () => {
        const res = await request(app)
            .get('/api/admin/users/active?search=Ivan')
            .set(authHeader(adminToken))
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].first_name).toBe('Ivan');
    });

    it('отказывает не-админу и неавторизованному', async () => {
        await request(app)
            .get('/api/admin/users/active')
            .set(authHeader(nonAdminToken))
            .expect(403);

        await request(app)
            .get('/api/admin/users/active')
            .expect(401);
    });
});
