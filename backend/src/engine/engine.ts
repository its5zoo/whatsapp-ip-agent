import { ConversationState, TransitionResult, QuestionDefinition } from './types';
import { QUESTIONNAIRE } from './questions';
import { ENGINE_CONFIG } from './constants';

export const getQuestionResponse = (q: QuestionDefinition): string => {
  return q.warning ? `${q.warning}\n\n${q.text}` : q.text;
};

export const processMessage = (state: ConversationState, message: string): TransitionResult => {
  const input = message.trim();
  const inputUpper = input.toUpperCase();

  // 1. Global Commands
  if (inputUpper === 'HELP') {
    return { state, response: ENGINE_CONFIG.HELP_INFO, completed: false, data: state.data };
  }
  if (inputUpper === 'SERVICES') {
    return { state, response: ENGINE_CONFIG.SERVICES_INFO, completed: false, data: state.data };
  }
  if (inputUpper === 'CONSULTATION') {
    return { state, response: ENGINE_CONFIG.CONSULTATION_INFO, completed: false, data: state.data };
  }
  if (inputUpper === 'BACK') {
    const newState: ConversationState = {
      ...state,
      currentQuestionId: 'main_menu',
      isCompleted: false
    };
    return { 
      state: newState, 
      response: getQuestionResponse(QUESTIONNAIRE['main_menu']), 
      completed: false, 
      data: state.data 
    };
  }

  // 2. Determine current state
  let qId = state.currentQuestionId;
  if (!qId || state.isCompleted) {
    qId = 'main_menu';
  }

  const question = QUESTIONNAIRE[qId];
  if (!question) {
    // Fallback if somehow invalid
    return {
      state: { ...state, currentQuestionId: 'main_menu' },
      response: getQuestionResponse(QUESTIONNAIRE['main_menu']),
      completed: false,
      data: state.data
    };
  }

  // 3. Validate and process answer
  if (question.type === 'choice') {
    const validOption = question.options?.find(o => o.id === input);
    if (!validOption) {
      return {
        state: { ...state, currentQuestionId: qId },
        response: `Invalid option. Please reply with a valid number.\n\n${getQuestionResponse(question)}`,
        completed: false,
        data: state.data
      };
    }
  } else if (question.type === 'text') {
    if (!input) {
      return {
        state: { ...state, currentQuestionId: qId },
        response: `Please provide a valid text response.\n\n${getQuestionResponse(question)}`,
        completed: false,
        data: state.data
      };
    }
  }

  // Store valid answer
  const newData = { ...state.data, [qId]: input };
  
  // 4. Advance state
  const nextStateId = typeof question.nextState === 'function' 
    ? question.nextState(input, newData) 
    : question.nextState;

  if (nextStateId === 'completed') {
    // Handle completion
    return {
      state: { currentQuestionId: null, data: newData, isCompleted: true },
      response: ENGINE_CONFIG.COMPLETION_MESSAGE,
      completed: true,
      data: newData
    };
  }

  // 5. Present next question
  const nextQuestion = QUESTIONNAIRE[nextStateId];
  return {
    state: { currentQuestionId: nextStateId, data: newData, isCompleted: false },
    response: getQuestionResponse(nextQuestion),
    completed: false,
    data: newData
  };
};
