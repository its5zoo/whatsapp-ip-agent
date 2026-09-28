import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { processMessage } from '../src/engine/engine';
import { ConversationState } from '../src/engine/types';
import { ENGINE_CONFIG } from '../src/engine/constants';

const initialState = (): ConversationState => ({
  currentQuestionId: null,
  data: {},
  isCompleted: false
});

describe('Questionnaire Engine', () => {

  test('1. Main menu -> Patent', () => {
    let state = initialState();
    let res = processMessage(state, 'dummy'); // triggers main_menu since id is null
    assert.strictEqual(res.state.currentQuestionId, 'main_menu');
    
    res = processMessage(res.state, '1'); // Select Patent
    assert.strictEqual(res.state.currentQuestionId, 'patent_type');
    assert.strictEqual(res.data.flowType, 'patent');
  });

  test('2. Main menu -> Trademark', () => {
    let res = processMessage(initialState(), '2');
    assert.strictEqual(res.state.currentQuestionId, 'trademark_what');
    assert.strictEqual(res.data.flowType, 'trademark');
  });

  test('3. Main menu -> Design Registration', () => {
    let res = processMessage(initialState(), '3');
    assert.strictEqual(res.state.currentQuestionId, 'design_product');
    assert.strictEqual(res.data.flowType, 'design');
  });

  test('4. Main menu -> Copyright', () => {
    let res = processMessage(initialState(), '4');
    assert.strictEqual(res.state.currentQuestionId, 'copyright_type');
    assert.strictEqual(res.data.flowType, 'copyright');
  });

  test('5. Main menu -> Not Sure', () => {
    let res = processMessage(initialState(), '5');
    assert.strictEqual(res.state.currentQuestionId, 'notsure_desc');
    assert.strictEqual(res.data.flowType, 'notsure');
  });

  test('6. Valid numbered choice advances', () => {
    let res = processMessage(initialState(), '1'); // Patent
    assert.strictEqual(res.state.currentQuestionId, 'patent_type');
    res = processMessage(res.state, '2'); // Biotechnology
    assert.strictEqual(res.state.currentQuestionId, 'patent_stage');
  });

  test('7. Invalid numbered choice stays on the same question', () => {
    let res = processMessage(initialState(), '99'); // Invalid on main menu
    assert.strictEqual(res.state.currentQuestionId, 'main_menu');
    assert.ok(res.response.includes('Invalid option'));
  });

  test('8. Patent flow reaches final details', () => {
    let s = processMessage(initialState(), '1'); // Patent
    s = processMessage(s.state, '1'); // type
    s = processMessage(s.state, '1'); // stage
    s = processMessage(s.state, '1'); // service
    s = processMessage(s.state, 'My invention is cool'); // desc
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
  });

  test('9. Trademark flow reaches final details', () => {
    let s = processMessage(initialState(), '2'); // Trademark
    s = processMessage(s.state, '1'); // what
    s = processMessage(s.state, 'My brand'); // desc
    s = processMessage(s.state, '1'); // usage
    s = processMessage(s.state, '1'); // service
    s = processMessage(s.state, 'Class 9'); // class
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
  });

  test('10. Design flow reaches final details', () => {
    let s = processMessage(initialState(), '3'); // Design
    s = processMessage(s.state, 'A chair'); // product
    s = processMessage(s.state, '1'); // distinctive
    s = processMessage(s.state, '1'); // disclosure
    s = processMessage(s.state, '1'); // assistance
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
  });

  test('11. Copyright flow reaches final details', () => {
    let s = processMessage(initialState(), '4'); // Copyright
    s = processMessage(s.state, '1'); // type
    s = processMessage(s.state, '1'); // completion
    s = processMessage(s.state, '1'); // assistance
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
  });

  test('12. Not Sure flow reaches final details', () => {
    let s = processMessage(initialState(), '5'); // Not sure
    s = processMessage(s.state, 'I need help'); // desc
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
  });

  test('13. BACK returns to main menu without losing data if same flow', () => {
    let s = processMessage(initialState(), '1'); // Patent
    s = processMessage(s.state, '1'); // Pharmaceutical
    s = processMessage(s.state, 'BACK');
    assert.strictEqual(s.state.currentQuestionId, 'main_menu');
    
    // Now enter Patent again
    let s2 = processMessage(s.state, '1');
    assert.strictEqual(s2.data['patent_type'], '1'); // Ensure data remains if flow is the same
  });

  test('13b. Selecting a different root flow clears previous abandoned data', () => {
    let s = processMessage(initialState(), '1'); // Patent
    s = processMessage(s.state, '1'); // Pharmaceutical
    s = processMessage(s.state, 'BACK');
    assert.strictEqual(s.state.currentQuestionId, 'main_menu');

    // User changes mind and selects Trademark
    let s2 = processMessage(s.state, '2'); // Trademark
    assert.strictEqual(s2.state.currentQuestionId, 'trademark_what');
    assert.strictEqual(s2.data['flowType'], 'trademark');
    
    // Previous patent data must be cleared
    assert.strictEqual(s2.data['patent_type'], undefined);
  });

  test('14. HELP works globally', () => {
    let s = processMessage(initialState(), '1');
    let helpRes = processMessage(s.state, 'HELP');
    assert.strictEqual(helpRes.state.currentQuestionId, 'patent_type'); // Does not progress
    assert.ok(helpRes.response.includes('HELP – Speak to our team 9284333589'));
  });

  test('15. SERVICES works globally', () => {
    let s = processMessage(initialState(), '1');
    let servRes = processMessage(s.state, 'SERVICES');
    assert.strictEqual(servRes.state.currentQuestionId, 'patent_type');
    assert.ok(servRes.response.includes('Explore our IP services'));
  });

  test('16. CONSULTATION works globally', () => {
    let s = processMessage(initialState(), '1');
    let consRes = processMessage(s.state, 'CONSULTATION');
    assert.strictEqual(consRes.state.currentQuestionId, 'patent_type');
    assert.ok(consRes.response.includes('Request a consultation'));
  });

  test('17. Completion state is reached correctly', () => {
    let s: any = { state: { currentQuestionId: 'shared_comm', data: {}, isCompleted: false } };
    s = processMessage(s.state, '1'); // WhatsApp
    assert.strictEqual(s.completed, true);
    assert.strictEqual(s.state.isCompleted, true);
    assert.strictEqual(s.state.currentQuestionId, null);
    assert.ok(s.response.includes('Thank you for sharing your requirement with GenioBrain IP Solution.'));
  });

  test('18. Phone Call collects preferred date/time', () => {
    let s: any = { state: { currentQuestionId: 'shared_comm', data: {}, isCompleted: false } };
    s = processMessage(s.state, '2'); // Phone Call
    assert.strictEqual(s.state.currentQuestionId, 'shared_phone_time');
    assert.strictEqual(s.completed, false);
    s = processMessage(s.state, 'Tomorrow 10 AM');
    assert.strictEqual(s.completed, true);
  });

  test('19. Trademark class remains optional', () => {
    let s: any = { state: { currentQuestionId: 'trademark_class', data: {}, isCompleted: false } };
    s = processMessage(s.state, 'skip'); // Optional text should accept any input
    assert.strictEqual(s.state.currentQuestionId, 'shared_name');
    assert.strictEqual(s.data['trademark_class'], 'skip');
  });

  test('20. Free-text answers are stored in conversation data', () => {
    let s: any = { state: { currentQuestionId: 'shared_name', data: {}, isCompleted: false } };
    s = processMessage(s.state, 'John Doe');
    assert.strictEqual(s.data['shared_name'], 'John Doe');
  });

  test('Confidentiality warning is attached', () => {
    let s: any = { state: { currentQuestionId: 'patent_service', data: {}, isCompleted: false } };
    s = processMessage(s.state, '1'); // Next state is patent_desc which has warning
    assert.strictEqual(s.state.currentQuestionId, 'patent_desc');
    assert.ok(s.response.includes('Please do not share confidential information'));
  });
});
