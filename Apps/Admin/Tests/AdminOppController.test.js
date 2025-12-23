import request from 'supertest';
import { app, server } from '../../../index.js';
import {
    resetDatabase,
    createUser,
    createAdminWithToken,
    buildToken,
    authHeader
} from './adminTestUtils.js';

describe('Admin OPP API', () => {
    let adminToken;
    let owner;
    let nonAdminToken;

    beforeEach(async () => {
        await resetDatabase();
        const adminBundle = await createAdminWithToken();
        adminToken = adminBundle.token;
        owner = await createUser({ email: 'owner@test.com' });
        const nonAdmin = await createUser({ email: 'user@test.com', is_admin: false });
        nonAdminToken = buildToken(nonAdmin.user_id);
    });

    afterAll(async () => {
        await server.close();
    });

    it('создает ПВЗ с активным владельцем', async () => {
        const res = await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Пример 1',
                latitude: 55.75,
                longitude: 37.61,
                enabled: true,
                work_time: { mon: '09:00-20:00' },
                owner_id: owner.user_id
            })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.owner_id).toBe(owner.user_id);
    });

    it('не создает ПВЗ без обязательных полей', async () => {
        await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                latitude: 55.75,
                longitude: 37.61
            })
            .expect(400);
    });

    it('не создает ПВЗ с неактивным владельцем', async () => {
        const inactive = await createUser({
            email: 'inactive@test.com',
            is_active: false,
            is_activated: false
        });

        await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Пример 2',
                latitude: 55.75,
                longitude: 37.61,
                owner_id: inactive.user_id
            })
            .expect(404);
    });

    it('отказывает не-админу и неавторизованному', async () => {
        await request(app)
            .get('/api/admin/opps')
            .set(authHeader(nonAdminToken))
            .expect(403);

        await request(app)
            .get('/api/admin/opps')
            .expect(401);
    });

    it('не создает ПВЗ без токена', async () => {
        await request(app)
            .post('/api/admin/opps')
            .send({
                address: 'No auth',
                latitude: 1,
                longitude: 2
            })
            .expect(401);
    });

    it('обновляет ПВЗ', async () => {
        const created = await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Пример 3',
                latitude: 55.75,
                longitude: 37.61,
                owner_id: owner.user_id
            })
            .expect(200);

        const oppId = created.body.data.opp_id;

        const res = await request(app)
            .put(`/api/admin/opps/${oppId}`)
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Новая 3',
                latitude: 55.8,
                longitude: 37.7,
                enabled: false,
                work_time: { tue: '10:00-19:00' },
                owner_id: owner.user_id
            })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.address).toContain('Новая');
    });

    it('не обновляет ПВЗ без обязательных полей или с неактивным владельцем', async () => {
        const created = await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Пример 5',
                latitude: 55.75,
                longitude: 37.61,
                owner_id: owner.user_id
            })
            .expect(200);

        const oppId = created.body.data.opp_id;

        await request(app)
            .put(`/api/admin/opps/${oppId}`)
            .set(authHeader(adminToken))
            .send({ address: '', latitude: 0 })
            .expect(400);

        const inactive = await createUser({
            email: 'inactive4@test.com',
            is_active: false,
            is_activated: false
        });

        await request(app)
            .put(`/api/admin/opps/${oppId}`)
            .set(authHeader(adminToken))
            .send({
                address: 'Valid',
                latitude: 10,
                longitude: 10,
                owner_id: inactive.user_id
            })
            .expect(404);
    });

    it('не обновляет ПВЗ если не найден', async () => {
        await request(app)
            .put('/api/admin/opps/999')
            .set(authHeader(adminToken))
            .send({
                address: 'x',
                latitude: 1,
                longitude: 1
            })
            .expect(404);
    });

    it('удаляет ПВЗ', async () => {
        const created = await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Пример 4',
                latitude: 55.75,
                longitude: 37.61,
                owner_id: owner.user_id
            })
            .expect(200);

        const oppId = created.body.data.opp_id;

        await request(app)
            .delete(`/api/admin/opps/${oppId}`)
            .set(authHeader(adminToken))
            .expect(200);

        await request(app)
            .delete(`/api/admin/opps/${oppId}`)
            .set(authHeader(adminToken))
            .expect(404);
    });

    it('фильтрует ПВЗ по адресу', async () => {
        await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Альфа',
                latitude: 1,
                longitude: 1,
                owner_id: owner.user_id
            })
            .expect(200);

        await request(app)
            .post('/api/admin/opps')
            .set(authHeader(adminToken))
            .send({
                address: 'г. Тест, ул. Бета',
                latitude: 2,
                longitude: 2,
                owner_id: owner.user_id
            })
            .expect(200);

        const res = await request(app)
            .get('/api/admin/opps?search=Альфа')
            .set(authHeader(adminToken))
            .expect(200);

        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].address).toContain('Альфа');
    });
});
