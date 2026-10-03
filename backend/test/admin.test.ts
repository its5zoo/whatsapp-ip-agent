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

  test('1a. POST /admin/login limits repeated failures per IP and username', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'admin_test', password: 'wrongpassword' }
      });
      assert.strictEqual(response.statusCode, 401);
      assert.deepStrictEqual(JSON.parse(response.payload), { error: 'Invalid credentials' });
    }

    const limitedResponse = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'wrongpassword' }
    });
    assert.strictEqual(limitedResponse.statusCode, 429);
    assert.strictEqual(JSON.parse(limitedResponse.payload).statusCode, 429);
    assert.strictEqual(JSON.parse(limitedResponse.payload).message, 'Too many login attempts');

    const differentUsernameResponse = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'another-user', password: 'wrongpassword' }
    });
    assert.strictEqual(differentUsernameResponse.statusCode, 401);
  });

  test('1b. successful logins do not consume the failed-attempt budget', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'admin_test', password: 'password123' }
      });
      assert.strictEqual(response.statusCode, 200);
    }

    const failedResponse = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'wrongpassword' }
    });
    assert.strictEqual(failedResponse.statusCode, 401);
  });

  test('1c. successful login resets previous failed attempts', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'admin_test', password: 'wrongpassword' }
      });
      assert.strictEqual(response.statusCode, 401);
    }

    const successResponse = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    assert.strictEqual(successResponse.statusCode, 200);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'admin_test', password: 'wrongpassword' }
      });
      assert.strictEqual(response.statusCode, 401);
    }
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
    assert.strictEqual(body.leads[0].status, 'NEW');
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
    assert.strictEqual(body.lead.status, 'NEW');
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

  test('7. Lead status is protected, validated, persisted, and returned', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;
    const lead = await prisma.lead.findFirstOrThrow();

    const unauthenticated = await app.inject({
      method: 'PATCH',
      url: `/admin/leads/${lead.id}/status`,
      payload: { status: 'CONTACTED' }
    });
    assert.strictEqual(unauthenticated.statusCode, 401);

    const contacted = await app.inject({
      method: 'PATCH',
      url: `/admin/leads/${lead.id}/status`,
      headers: { cookie: validCookie },
      payload: { status: 'CONTACTED' }
    });
    assert.strictEqual(contacted.statusCode, 200);
    assert.strictEqual(JSON.parse(contacted.payload).lead.status, 'CONTACTED');

    const qualified = await app.inject({
      method: 'PATCH',
      url: `/admin/leads/${lead.id}/status`,
      headers: { cookie: validCookie },
      payload: { status: 'QUALIFIED' }
    });
    assert.strictEqual(qualified.statusCode, 200);
    assert.strictEqual(JSON.parse(qualified.payload).lead.status, 'QUALIFIED');

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/admin/leads/${lead.id}/status`,
      headers: { cookie: validCookie },
      payload: { status: 'invalid' }
    });
    assert.strictEqual(invalid.statusCode, 400);

    const malformed = await app.inject({
      method: 'PATCH',
      url: `/admin/leads/${lead.id}/status`,
      headers: { cookie: validCookie },
      payload: { status: 'CONTACTED', extra: true }
    });
    assert.strictEqual(malformed.statusCode, 400);

    const missing = await app.inject({
      method: 'PATCH',
      url: '/admin/leads/missing-lead/status',
      headers: { cookie: validCookie },
      payload: { status: 'CONTACTED' }
    });
    assert.strictEqual(missing.statusCode, 404);

    const persisted = await prisma.lead.findUnique({ where: { id: lead.id } });
    assert.strictEqual(persisted?.status, 'QUALIFIED');
    const statusActivities = await prisma.activity.findMany({ where: { leadId: lead.id } });
    assert.deepStrictEqual(statusActivities.map(activity => activity.description), ['Status changed to Contacted', 'Status changed to Qualified']);
  });

  test('8. Follow-ups support protected CRUD, filtering, and multiple records per Lead', async () => {
    const lead = await prisma.lead.findFirstOrThrow();
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      payload: { leadId: lead.id, scheduledAt: future, note: 'Call customer' }
    });
    assert.strictEqual(unauthenticated.statusCode, 401);

    const invalidLead = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie },
      payload: { leadId: 'missing-lead', scheduledAt: future, note: 'Call customer' }
    });
    assert.strictEqual(invalidLead.statusCode, 404);

    const invalidDate = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie },
      payload: { leadId: lead.id, scheduledAt: 'not-a-date', note: 'Call customer' }
    });
    assert.strictEqual(invalidDate.statusCode, 400);

    const missingNote = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie },
      payload: { leadId: lead.id, scheduledAt: future, note: ' ' }
    });
    assert.strictEqual(missingNote.statusCode, 400);

    const upcoming = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie },
      payload: { leadId: lead.id, scheduledAt: future, note: 'Call customer' }
    });
    assert.strictEqual(upcoming.statusCode, 201);
    const upcomingFollowUp = JSON.parse(upcoming.payload).followUp;
    assert.strictEqual(upcomingFollowUp.status, 'PENDING');

    const overdue = await app.inject({
      method: 'POST',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie },
      payload: { leadId: lead.id, scheduledAt: past, note: 'Send proposal' }
    });
    assert.strictEqual(overdue.statusCode, 201);
    const overdueFollowUp = JSON.parse(overdue.payload).followUp;

    const list = await app.inject({
      method: 'GET',
      url: '/admin/follow-ups',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(list.statusCode, 200);
    assert.strictEqual(JSON.parse(list.payload).followUps.length, 2);

    const upcomingList = await app.inject({
      method: 'GET',
      url: '/admin/follow-ups?filter=upcoming',
      headers: { cookie: validCookie }
    });
    assert.deepStrictEqual(JSON.parse(upcomingList.payload).followUps.map((item: any) => item.id), [upcomingFollowUp.id]);

    const overdueList = await app.inject({
      method: 'GET',
      url: '/admin/follow-ups?filter=overdue',
      headers: { cookie: validCookie }
    });
    assert.deepStrictEqual(JSON.parse(overdueList.payload).followUps.map((item: any) => item.id), [overdueFollowUp.id]);

    const filtered = await app.inject({
      method: 'GET',
      url: `/admin/follow-ups?leadId=${lead.id}`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(filtered.payload).followUps.length, 2);

    const rescheduled = await app.inject({
      method: 'PATCH',
      url: `/admin/follow-ups/${overdueFollowUp.id}`,
      headers: { cookie: validCookie },
      payload: { scheduledAt: future, note: 'Send revised proposal' }
    });
    assert.strictEqual(rescheduled.statusCode, 200);
    assert.strictEqual(JSON.parse(rescheduled.payload).followUp.note, 'Send revised proposal');
    const rescheduledActivity = await prisma.activity.findFirst({
      where: { leadId: lead.id, type: 'FOLLOW_UP_RESCHEDULED' },
      orderBy: { createdAt: 'desc' }
    });
    assert.ok(rescheduledActivity?.description.includes('note changed'));

    const completed = await app.inject({
      method: 'POST',
      url: `/admin/follow-ups/${upcomingFollowUp.id}/complete`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(completed.statusCode, 200);
    assert.strictEqual(JSON.parse(completed.payload).followUp.status, 'COMPLETED');
    assert.ok(JSON.parse(completed.payload).followUp.completedAt);

    const cancelled = await app.inject({
      method: 'POST',
      url: `/admin/follow-ups/${overdueFollowUp.id}/cancel`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(cancelled.statusCode, 200);
    assert.strictEqual(JSON.parse(cancelled.payload).followUp.status, 'CANCELLED');

    const completedList = await app.inject({
      method: 'GET',
      url: '/admin/follow-ups?filter=completed',
      headers: { cookie: validCookie }
    });
    assert.strictEqual(JSON.parse(completedList.payload).followUps.length, 1);

    const persisted = await prisma.followUp.findMany({ where: { leadId: lead.id } });
    assert.strictEqual(persisted.length, 2);
    assert.strictEqual((await prisma.lead.findUnique({ where: { id: lead.id } }))?.status, 'NEW');
    const followUpActivities = await prisma.activity.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'asc' } });
    assert.deepStrictEqual(followUpActivities.map(activity => activity.type), [
      'FOLLOW_UP_CREATED',
      'FOLLOW_UP_CREATED',
      'FOLLOW_UP_RESCHEDULED',
      'FOLLOW_UP_COMPLETED',
      'FOLLOW_UP_CANCELLED'
    ]);
  });

  test('9. Internal notes are protected, persistent, editable, deletable, and audited', async () => {
    const lead = await prisma.lead.findFirstOrThrow();
    const loginRes = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { username: 'admin_test', password: 'password123' }
    });
    const validCookie = `auth_token=${loginRes.cookies.find((c: any) => c.name === 'auth_token').value}`;

    const unauthenticated = await app.inject({
      method: 'GET',
      url: `/admin/leads/${lead.id}/notes`
    });
    assert.strictEqual(unauthenticated.statusCode, 401);

    const invalidLead = await app.inject({
      method: 'POST',
      url: '/admin/leads/missing-lead/notes',
      headers: { cookie: validCookie },
      payload: { content: 'Private note' }
    });
    assert.strictEqual(invalidLead.statusCode, 404);

    const empty = await app.inject({
      method: 'POST',
      url: `/admin/leads/${lead.id}/notes`,
      headers: { cookie: validCookie },
      payload: { content: '   ' }
    });
    assert.strictEqual(empty.statusCode, 400);

    const created = await app.inject({
      method: 'POST',
      url: `/admin/leads/${lead.id}/notes`,
      headers: { cookie: validCookie },
      payload: { content: 'Call after the proposal review' }
    });
    assert.strictEqual(created.statusCode, 201);
    const noteId = JSON.parse(created.payload).note.id;

    const listed = await app.inject({
      method: 'GET',
      url: `/admin/leads/${lead.id}/notes`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(listed.statusCode, 200);
    assert.strictEqual(JSON.parse(listed.payload).notes[0].content, 'Call after the proposal review');

    const edited = await app.inject({
      method: 'PATCH',
      url: `/admin/notes/${noteId}`,
      headers: { cookie: validCookie },
      payload: { content: 'Call after the revised proposal review' }
    });
    assert.strictEqual(edited.statusCode, 200);
    assert.strictEqual(JSON.parse(edited.payload).note.content, 'Call after the revised proposal review');

    const missingNote = await app.inject({
      method: 'PATCH',
      url: '/admin/notes/missing-note',
      headers: { cookie: validCookie },
      payload: { content: 'Updated' }
    });
    assert.strictEqual(missingNote.statusCode, 404);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/admin/notes/${noteId}`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(deleted.statusCode, 200);

    const notes = await prisma.internalNote.findMany({ where: { leadId: lead.id } });
    assert.strictEqual(notes.length, 0);
    const activities = await prisma.activity.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'asc' } });
    assert.deepStrictEqual(activities.slice(-3).map(activity => activity.type), ['NOTE_ADDED', 'NOTE_EDITED', 'NOTE_DELETED']);

    const activityResponse = await app.inject({
      method: 'GET',
      url: `/admin/leads/${lead.id}/activity`,
      headers: { cookie: validCookie }
    });
    assert.strictEqual(activityResponse.statusCode, 200);
    assert.ok(JSON.parse(activityResponse.payload).activities.length >= 3);
  });
});
