import bcrypt from 'bcryptjs';
import test from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app';
import prisma from '../src/db/prisma';
import { env } from '../src/config/env';

test.describe('Admin API', () => {
  let app: any;
  let cookie: string;

  test.beforeEach(async () => {
    // Set up test credentials
    env.ADMIN_USERNAME = 'admin_test';
    // password123
    env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('password123', 10);
    env.JWT_SECRET = 'test_secret_for_jwt';

    app = buildApp();
    await app.ready();

    await prisma.lead.deleteMany();
    await prisma.conversation.deleteMany();

    const conv1 = await prisma.conversation.create({
      data: { channel: 'test', externalUserId: 'user1', isCompleted: true, data: {} }
    });

    await prisma.lead.create({
      data: {
        conversationId: conv1.id,
        name: 'John Doe',
        organization: 'Test Org',
        email: 'john@test.com',
        mobile: '1234',
        city: 'NY',
        preferredComm: '1',
        flowType: 'patent',
        answers: { patent_type: '1' }
      }
    });
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('1. POST /admin/login handles valid and invalid credentials', async () => {
    const resFail = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'wrongpassword' }
    });
    assert.strictEqual(resFail.statusCode, 401);

    const resSuccess = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    assert.strictEqual(resSuccess.statusCode, 200);

    const cookies = resSuccess.cookies;
    assert.ok(cookies.find((c: any) => c.name === 'auth_token'));
    cookie = `auth_token=${cookies.find((c: any) => c.name === 'auth_token').value}`;
  });

  test('2. Protected endpoint without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/leads'
    });
    assert.strictEqual(res.statusCode, 401);
  });

  test('3. GET /admin/leads returns list of leads and pagination', async () => {
    // Get valid cookie first
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    const res = await app.inject({
      method: 'GET',
      url: '/admin/leads',
      headers: { cookie: validCookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.leads.length, 1);
    assert.strictEqual(body.leads[0].name, 'John Doe');
    assert.ok(!body.leads[0].answers); // Full answers not included in list
    assert.strictEqual(body.pagination.total, 1);
  });

  test('3b. GET /admin/conversations returns incomplete conversations only', async () => {
    await prisma.conversation.create({
      data: {
        channel: 'whatsapp',
        externalUserId: '15551234567@s.whatsapp.net',
        currentQuestionId: 'patent_type',
        data: { flowType: 'patent' },
        isCompleted: false
      }
    });

    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/admin/conversations'
    });
    assert.strictEqual(unauthenticated.statusCode, 401);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    const res = await app.inject({
      method: 'GET',
      url: '/admin/conversations',
      headers: { cookie: validCookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.conversations.length, 1);
    assert.deepStrictEqual(body.conversations[0], {
      id: body.conversations[0].id,
      channel: 'whatsapp',
      externalUserId: '15551234567@s.whatsapp.net',
      currentQuestionId: 'patent_type',
      isCompleted: false,
      createdAt: body.conversations[0].createdAt,
      updatedAt: body.conversations[0].updatedAt
    });
    assert.strictEqual('data' in body.conversations[0], false);

    const unauthenticatedDetail = await app.inject({
      method: 'GET',
      url: `/admin/conversations/${body.conversations[0].id}`
    });
    assert.strictEqual(unauthenticatedDetail.statusCode, 401);

    const detail = await app.inject({
      method: 'GET',
      url: `/admin/conversations/${body.conversations[0].id}`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(detail.statusCode, 200);
    const detailBody = JSON.parse(detail.payload);
    assert.deepStrictEqual(detailBody.conversation, {
      id: body.conversations[0].id,
      channel: 'whatsapp',
      externalUserId: '15551234567@s.whatsapp.net',
      currentQuestionId: 'patent_type',
      isCompleted: false,
      createdAt: body.conversations[0].createdAt,
      updatedAt: body.conversations[0].updatedAt,
      data: { flowType: 'patent' }
    });

    const completed = await prisma.conversation.findFirst({
      where: { channel: 'test', externalUserId: 'user1' }
    });
    const completedDetail = await app.inject({
      method: 'GET',
      url: `/admin/conversations/${completed?.id}`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(completedDetail.statusCode, 404);

    const missingDetail = await app.inject({
      method: 'GET',
      url: '/admin/conversations/missing-conversation',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(missingDetail.statusCode, 404);
  });

  test('4. FlowType filtering and search works', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    // Valid flowType
    const res1 = await app.inject({
      method: 'GET',
      url: '/admin/leads?flowType=patent',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res1.payload).leads.length, 1);

    // Invalid flowType
    const res2 = await app.inject({
      method: 'GET',
      url: '/admin/leads?flowType=trademark',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res2.payload).leads.length, 0);

    // Search
    const res3 = await app.inject({
      method: 'GET',
      url: '/admin/leads?search=John',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res3.payload).leads.length, 1);
  });

  test('4b. Pagination validation caps and defaults values correctly', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    // Negative page and limit
    const res1 = await app.inject({
      method: 'GET',
      url: '/admin/leads?page=-1&limit=-5',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res1.payload).pagination.page, 1);
    assert.strictEqual(JSON.parse(res1.payload).pagination.limit, 20);

    // Limit over 100
    const res2 = await app.inject({
      method: 'GET',
      url: '/admin/leads?page=2&limit=500',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res2.payload).pagination.page, 2);
    assert.strictEqual(JSON.parse(res2.payload).pagination.limit, 100);

    // Zero values
    const res3 = await app.inject({
      method: 'GET',
      url: '/admin/leads?page=0&limit=0',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(res3.payload).pagination.page, 1);
    assert.strictEqual(JSON.parse(res3.payload).pagination.limit, 20);
  });

  test('5. GET /admin/leads/:id returns full lead with decoded answers', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    const listRes = await app.inject({
      method: 'GET',
      url: '/admin/leads',
      headers: { cookie: validCookie }
    });
    const leadId = JSON.parse(listRes.payload).leads[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/admin/leads/${leadId}`,
      headers: { cookie: validCookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.lead.name, 'John Doe');
    assert.strictEqual(body.lead.answers, undefined);
    assert.ok(body.lead.decodedAnswers);

    const decoded = body.lead.decodedAnswers.find((d: any) => d.questionId === 'patent_type');
    assert.strictEqual(decoded.displayValue, 'Pharmaceutical');
  });

  test('6. POST /admin/logout clears cookie', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/admin/logout',
      headers: { cookie: validCookie }
    });

    assert.strictEqual(logoutRes.statusCode, 200);

    // Fastify clearCookie sends Max-Age=0
    const authCookie = logoutRes.cookies.find((c: any) => c.name === 'auth_token');
    assert.ok(authCookie.maxAge === 0 || authCookie.value === '');
  });

  test('6b. POST /admin/logout without auth still returns 200 (idempotent)', async () => {
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/admin/logout'
    });
    assert.strictEqual(logoutRes.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(logoutRes.payload), { success: true });
  });

  test('6c. GET /admin/stats without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/stats'
    });
    assert.strictEqual(res.statusCode, 401);
  });
});
