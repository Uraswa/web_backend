import request from 'supertest';
import { app, server } from '../../../index.js';
import {
    resetDatabase,
    createUser,
    buildToken,
    createAdminWithToken,
    authHeader
} from './adminTestUtils.js';

describe('Admin Shop API', () => {
    let adminToken;
    let owner;
    let owner2;
    let nonAdminToken;

    beforeEach(async () => {
        await resetDatabase();
        const adminBundle = await createAdminWithToken();
        adminToken = adminBundle.token;
        owner = await createUser({ email: 'owner1@test.com' });
        owner2 = await createUser({ email: 'owner2@test.com' });
        const nonAdmin = await createUser({ email: 'user@test.com', is_admin: false });
        nonAdminToken = buildToken(nonAdmin.user_id);
    });

    afterAll(async () => {
        await server.close();
    });

    it('creates shop with active owner', async () => {
        const res = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop A',
                owner_id: owner.user_id,
                description: 'Test shop'
            })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.owner_id).toBe(owner.user_id);
    });

    it('rejects shop creation with inactive owner', async () => {
        const inactive = await createUser({
            email: 'inactive@test.com',
            is_active: false,
            is_activated: false
        });

        await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop B',
                owner_id: inactive.user_id,
                description: 'Desc'
            })
            .expect(404);
    });

    it('rejects shop creation without required fields or without token', async () => {
        await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({ name: '' })
            .expect(400);

        await request(app)
            .post('/api/admin/shops')
            .send({ name: 'NoAuth', owner_id: owner.user_id })
            .expect(401);
    });

    it('rejects non-admin and unauthenticated on list', async () => {
        await request(app)
            .get('/api/admin/shops')
            .set(authHeader(nonAdminToken))
            .expect(403);

        await request(app)
            .get('/api/admin/shops')
            .expect(401);
    });

    it('assigns new seller to shop', async () => {
        const created = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop C',
                owner_id: owner.user_id,
                description: 'Desc'
            })
            .expect(200);

        const shopId = created.body.data.shop_id;

        const res = await request(app)
            .post(`/api/admin/shops/${shopId}/seller`)
            .set(authHeader(adminToken))
            .send({ owner_id: owner2.user_id })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.owner_id).toBe(owner2.user_id);
    });

    it('rejects assign seller when shop missing, owner inactive, or owner_id missing', async () => {
        await request(app)
            .post('/api/admin/shops/999/seller')
            .set(authHeader(adminToken))
            .send({ owner_id: owner.user_id })
            .expect(404);

        const created = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop D',
                owner_id: owner.user_id
            })
            .expect(200);
        const shopId = created.body.data.shop_id;

        await request(app)
            .post(`/api/admin/shops/${shopId}/seller`)
            .set(authHeader(adminToken))
            .send({})
            .expect(400);

        const inactive = await createUser({
            email: 'inactive2@test.com',
            is_active: false,
            is_activated: false
        });

        await request(app)
            .post(`/api/admin/shops/${shopId}/seller`)
            .set(authHeader(adminToken))
            .send({ owner_id: inactive.user_id })
            .expect(404);
    });

    it('removes seller and deletes shop', async () => {
        const created = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop E',
                owner_id: owner.user_id,
                description: 'Desc'
            })
            .expect(200);

        const shopId = created.body.data.shop_id;

        await request(app)
            .delete(`/api/admin/shops/${shopId}/seller`)
            .set(authHeader(adminToken))
            .expect(200);

        const list = await request(app)
            .get('/api/admin/shops')
            .set(authHeader(adminToken))
            .expect(200);

        expect(list.body.data).toHaveLength(0);
    });

    it('deletes shop and returns 404 on second delete', async () => {
        const created = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop F',
                owner_id: owner.user_id
            })
            .expect(200);

        const shopId = created.body.data.shop_id;

        await request(app)
            .delete(`/api/admin/shops/${shopId}`)
            .set(authHeader(adminToken))
            .expect(200);

        await request(app)
            .delete(`/api/admin/shops/${shopId}`)
            .set(authHeader(adminToken))
            .expect(404);
    });

    it('fails to update shop with missing fields or inactive owner', async () => {
        const created = await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({
                name: 'Shop G',
                owner_id: owner.user_id
            })
            .expect(200);

        const shopId = created.body.data.shop_id;

        await request(app)
            .put(`/api/admin/shops/${shopId}`)
            .set(authHeader(adminToken))
            .send({ name: '' })
            .expect(400);

        const inactive = await createUser({
            email: 'inactive3@test.com',
            is_active: false,
            is_activated: false
        });

        await request(app)
            .put(`/api/admin/shops/${shopId}`)
            .set(authHeader(adminToken))
            .send({
                name: 'Shop G Updated',
                owner_id: inactive.user_id
            })
            .expect(404);
    });

    it('filters shops by name', async () => {
        await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({ name: 'Alpha Market', owner_id: owner.user_id })
            .expect(200);
        await request(app)
            .post('/api/admin/shops')
            .set(authHeader(adminToken))
            .send({ name: 'Beta Store', owner_id: owner2.user_id })
            .expect(200);

        const res = await request(app)
            .get('/api/admin/shops?search=Alpha')
            .set(authHeader(adminToken))
            .expect(200);

        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toContain('Alpha');
    });
});
