import { QuestionDefinition } from './types';
import { ENGINE_CONFIG } from './constants';

export const QUESTIONNAIRE: Record<string, QuestionDefinition> = {
  main_menu: {
    id: 'main_menu',
    text: "Q1. What type of IP protection are you looking for?\nPlease reply with the number:\n\n1. Patent\n2. Trademark\n3. Design Registration\n4. Copyright\n5. Not sure – I need guidance",
    type: 'choice',
    options: [
      { id: '1', text: 'Patent' },
      { id: '2', text: 'Trademark' },
      { id: '3', text: 'Design Registration' },
      { id: '4', text: 'Copyright' },
      { id: '5', text: 'Not sure' }
    ],
    nextState: (ans, data) => {
      const newFlowMapping: Record<string, 'patent' | 'trademark' | 'design' | 'copyright' | 'notsure'> = {
        '1': 'patent',
        '2': 'trademark',
        '3': 'design',
        '4': 'copyright',
        '5': 'notsure'
      };

      if (newFlowMapping[ans]) {
        const selectedFlow = newFlowMapping[ans];
        if (data.flowType !== selectedFlow) {
          for (const key in data) {
            if (!key.startsWith('shared_') && key !== 'flowType') {
              delete data[key];
            }
          }
        }
        data.flowType = selectedFlow;
      }

      switch(ans) {
        case '1': return 'patent_type';
        case '2': return 'trademark_what';
        case '3': return 'design_product';
        case '4': return 'copyright_type';
        case '5': return 'notsure_desc';
        default: return 'main_menu';
      }
    }
  },
  // PATENT FLOW
  patent_type: {
    id: 'patent_type',
    text: "Q2. What best describes your invention?\n\n1. Pharmaceutical\n2. Biotechnology\n3. Chemical\n4. Healthcare Technology\n5. Engineering\n6. Software\n7. Agriculture\n8. Food Technology\n9. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''}, {id:'8', text:''}, {id:'9', text:''} ],
    nextState: 'patent_stage'
  },
  patent_stage: {
    id: 'patent_stage',
    text: "Q3. What stage is your invention currently at?\n\n1. Idea/concept stage\n2. Research is ongoing\n3. Prototype developed\n4. Experimental results or data available\n5. Product or process already developed\n6. Patent has already been filed\n7. Patent application has received an examination objection\n8. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''}, {id:'8', text:''} ],
    nextState: 'patent_service'
  },
  patent_service: {
    id: 'patent_service',
    text: "Q4. What service do you need?\n\n1. Patentability or Novelty Search\n2. Patent Drafting & Filing\n3. Provisional Patent Application\n4. Complete Patent Application\n5. Patent Examination Report Reply\n6. Patent Hearing or Office Action Response\n7. PCT or Foreign Patent Filing\n8. Freedom-to-Operate Search\n9. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''}, {id:'8', text:''}, {id:'9', text:''} ],
    nextState: 'patent_desc'
  },
  patent_desc: {
    id: 'patent_desc',
    text: 'Q5. Please briefly describe your invention in 2–3 sentences.',
    warning: ENGINE_CONFIG.PATENT_WARNING,
    type: 'text',
    nextState: 'shared_name'
  },

  // TRADEMARK FLOW
  trademark_what: {
    id: 'trademark_what',
    text: "Q2. What do you want to protect?\n\n1. Brand Name\n2. Company/Business Name\n3. Product Name\n4. Logo\n5. Tagline/Slogan\n6. Brand Name + Logo\n7. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''} ],
    nextState: 'trademark_desc'
  },
  trademark_desc: {
    id: 'trademark_desc',
    text: 'Q3. What does your business/product/service relate to?\nPlease briefly describe your business, product or service.',
    type: 'text',
    nextState: 'trademark_usage'
  },
  trademark_usage: {
    id: 'trademark_usage',
    text: "Q4. Have you already started using the trademark?\n\n1. Yes, already in use\n2. No, proposed to be used\n3. Planning to launch soon\n4. Not sure",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''} ],
    nextState: 'trademark_service'
  },
  trademark_service: {
    id: 'trademark_service',
    text: "Q5. What service do you need?\n\n1. Trademark Search\n2. Trademark Class Identification\n3. Trademark Application Filing\n4. Trademark Objection/Examination Reply\n5. Trademark Hearing\n6. Trademark Registration Assistance\n7. Trademark Renewal\n8. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''}, {id:'8', text:''} ],
    nextState: 'trademark_class'
  },
  trademark_class: {
    id: 'trademark_class',
    text: 'If you already know the trademark class, please share the class number.',
    type: 'optional_text',
    nextState: 'shared_name'
  },

  // DESIGN FLOW
  design_product: {
    id: 'design_product',
    text: 'Q2. What type of product do you want to register?\nPlease briefly describe the product.',
    type: 'text',
    nextState: 'design_distinctive'
  },
  design_distinctive: {
    id: 'design_distinctive',
    text: "Q3. What aspect of the product is new or distinctive?\n\n1. Shape\n2. Configuration\n3. Pattern\n4. Ornamentation\n5. Combination of the above\n6. Not sure",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''} ],
    nextState: 'design_disclosure'
  },
  design_disclosure: {
    id: 'design_disclosure',
    text: "Q4. Has the design already been publicly disclosed or launched?\n\n1. No, it has not been disclosed\n2. Yes, it has been disclosed\n3. Yes, it has been commercially launched",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''} ],
    nextState: 'design_assistance'
  },
  design_assistance: {
    id: 'design_assistance',
    text: "Q5. What assistance do you require?\n\n1. Design Registrability Assessment\n2. Design Search\n3. Design Application Filing\n4. Examination Objection Response\n5. Other / Need guidance",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''} ],
    nextState: 'shared_name'
  },

  // COPYRIGHT FLOW
  copyright_type: {
    id: 'copyright_type',
    text: "Q2. What would you like to protect through copyright?\n\n1. Software\n2. Computer Program\n3. Website Content\n4. Literary Work like Book, Article or poster, poem etc.\n5. Educational Material\n6. Artwork\n7. Photography\n8. Music or Sound Recording\n9. Video or Film or Audiovisual Work\n10. Course or Training Material\n11. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''}, {id:'5', text:''}, {id:'6', text:''}, {id:'7', text:''}, {id:'8', text:''}, {id:'9', text:''}, {id:'10', text:''}, {id:'11', text:''} ],
    nextState: 'copyright_completion'
  },
  copyright_completion: {
    id: 'copyright_completion',
    text: "Q3. Is the work already completed?\n\n1. Yes, completed\n2. Partially completed\n3. Work is still in development",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''} ],
    nextState: 'copyright_assistance'
  },
  copyright_assistance: {
    id: 'copyright_assistance',
    text: "Q4. What assistance do you need?\n\n1. Copyright Registration\n2. Copyright Infringement Assistance\n3. Copyright Assignment / Licensing\n4. Other",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''} ],
    nextState: 'shared_name'
  },

  // NOT SURE FLOW
  notsure_desc: {
    id: 'notsure_desc',
    text: "No problem! Our IP professionals can help identify the appropriate form of IP protection.\n\nQ2. Please tell us briefly about what you want to protect.\n\nFor example:\n• A new invention\n• A brand or business name\n• A product's unique appearance\n• Software or creative content\n• A research outcome\n• A technology\n• Something else\n\nPlease describe it in 2–3 sentences.",
    type: 'text',
    nextState: 'shared_name'
  },

  // SHARED FINAL DETAILS
  shared_name: { id: 'shared_name', text: 'Thank you! We have a better understanding of your requirement.\n\nTo help us assess your enquiry, please share:\n\n1. Your Name:', type: 'text', nextState: 'shared_org' },
  shared_org: { id: 'shared_org', text: '2. Organization/Company Name:', type: 'text', nextState: 'shared_email' },
  shared_email: { id: 'shared_email', text: '3. Email ID:', type: 'text', nextState: 'shared_mobile' },
  shared_mobile: { id: 'shared_mobile', text: '4. Mobile Number:', type: 'text', nextState: 'shared_city' },
  shared_city: { id: 'shared_city', text: '5. City/Country:', type: 'text', nextState: 'shared_comm' },
  shared_comm: {
    id: 'shared_comm',
    text: "Preferred mode of communication:\n\n1. WhatsApp\n2. Phone Call (preferred date and time)\n3. Email\n4. Online Consultation (Share link https://calendar.app.google/jXkhimLKpYRjGpA38)",
    type: 'choice',
    options: [ {id:'1', text:''}, {id:'2', text:''}, {id:'3', text:''}, {id:'4', text:''} ],
    nextState: (ans) => {
      if (ans === '2') return 'shared_phone_time';
      return 'completed';
    }
  },
  shared_phone_time: {
    id: 'shared_phone_time',
    text: 'Preferred date and time for Phone Call:',
    type: 'text',
    nextState: 'completed'
  }
};
