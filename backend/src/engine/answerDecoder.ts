import { QUESTIONNAIRE } from './questions';

export interface DecodedAnswer {
  questionId: string;
  questionLabel: string;
  rawValue: string;
  displayValue: string;
}

export function decodeAnswers(answers: Record<string, any>): DecodedAnswer[] {
  const result: DecodedAnswer[] = [];
  const persistedFieldLabels: Record<string, string> = {
    shared_mobile: 'Mobile Number:'
  };

  for (const [key, value] of Object.entries(answers)) {
    // Skip internal fields
    if (key === 'flowType') continue;

    const questionDef = QUESTIONNAIRE[key];
    const rawValueStr = String(value);

    let displayValue = rawValueStr;
    let questionLabel = persistedFieldLabels[key] || key;

    if (questionDef) {
      const lines = questionDef.text.split('\n');
      let labelLine = lines[0];
      if (questionDef.type !== 'choice') {
        labelLine = lines.find(l => l.match(/^(Q\d+|\d+)\.\s/)) || lines[0];
      }
      questionLabel = labelLine.replace(/^Q\d+\.\s*/, '').trim();

      if (questionDef.type === 'choice' && questionDef.options) {
        const option = questionDef.options.find(o => o.id === rawValueStr);
        if (option && option.text) {
          displayValue = option.text;
        } else {
          // Extract from the question text using simple string matching (no dynamic regex)
          const prefix = `${rawValueStr}. `;
          const matchLine = lines.find(line => line.trim().startsWith(prefix));
          if (matchLine) {
            displayValue = matchLine.trim().substring(prefix.length).trim();
          }
        }
      }
    }

    result.push({
      questionId: key,
      questionLabel,
      rawValue: rawValueStr,
      displayValue
    });
  }

  return result;
}
