import test from 'node:test';
import assert from 'node:assert';
import { decodeAnswers } from '../src/engine/answerDecoder';

test.describe('Answer Decoder', () => {
  test('1. Choice answers are decoded to labels', () => {
    const raw = {
      trademark_what: '1',
      trademark_usage: '2',
      trademark_service: '1'
    };
    const decoded = decodeAnswers(raw);

    assert.strictEqual(decoded.length, 3);

    const what = decoded.find(d => d.questionId === 'trademark_what');
    assert.strictEqual(what?.rawValue, '1');
    assert.strictEqual(what?.displayValue, 'Brand Name');
    assert.ok(what?.questionLabel.includes('What do you want to protect?'));

    const usage = decoded.find(d => d.questionId === 'trademark_usage');
    assert.strictEqual(usage?.displayValue, 'No, proposed to be used');

    const service = decoded.find(d => d.questionId === 'trademark_service');
    assert.strictEqual(service?.displayValue, 'Trademark Search');
  });

  test('2. Text answers pass through unchanged and labels are correct', () => {
    const raw = {
      shared_name: 'Phase Seven Test User',
      shared_org: 'Test Innovation Labs',
      shared_email: 'phase7.test@example.com',
      shared_mobile: '9999999999',
      shared_city: 'Bhubaneswar, India',
      shared_comm: '1',
      trademark_desc: 'My Brand'
    };
    const decoded = decodeAnswers(raw);

    const name = decoded.find(d => d.questionId === 'shared_name');
    assert.strictEqual(name?.displayValue, 'Phase Seven Test User');
    assert.strictEqual(name?.questionLabel, '1. Your Name:');

    const org = decoded.find(d => d.questionId === 'shared_org');
    assert.strictEqual(org?.displayValue, 'Test Innovation Labs');
    assert.strictEqual(org?.questionLabel, '2. Organization/Company Name:');

    const email = decoded.find(d => d.questionId === 'shared_email');
    assert.strictEqual(email?.displayValue, 'phase7.test@example.com');
    assert.strictEqual(email?.questionLabel, '3. Email ID:');

    const mobile = decoded.find(d => d.questionId === 'shared_mobile');
    assert.strictEqual(mobile?.displayValue, '9999999999');
    assert.strictEqual(mobile?.questionLabel, 'Mobile Number:');

    const city = decoded.find(d => d.questionId === 'shared_city');
    assert.strictEqual(city?.displayValue, 'Bhubaneswar, India');
    assert.strictEqual(city?.questionLabel, '4. City/Country:');

    const comm = decoded.find(d => d.questionId === 'shared_comm');
    assert.strictEqual(comm?.displayValue, 'WhatsApp');
    assert.strictEqual(comm?.questionLabel, 'Preferred mode of communication:');

    assert.strictEqual(decoded.find(d => d.questionId === 'trademark_desc')?.displayValue, 'My Brand');
  });

  test('3. Unknown question IDs are handled gracefully', () => {
    const raw = {
      unknown_id: '123'
    };
    const decoded = decodeAnswers(raw);

    assert.strictEqual(decoded[0].questionId, 'unknown_id');
    assert.strictEqual(decoded[0].questionLabel, 'unknown_id');
    assert.strictEqual(decoded[0].displayValue, '123');
  });

  test('4. Empty answers produce empty output', () => {
    const decoded = decodeAnswers({});
    assert.strictEqual(decoded.length, 0);
  });

  test('5. Internal fields like flowType are skipped', () => {
    const raw = {
      flowType: 'trademark',
      shared_name: 'John'
    };
    const decoded = decodeAnswers(raw);

    assert.strictEqual(decoded.length, 1);
    assert.strictEqual(decoded[0].questionId, 'shared_name');
  });
});
