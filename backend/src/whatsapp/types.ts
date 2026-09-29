export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id?: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string; // wamid
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  // other properties for media, interactive, etc. are not explicitly typed here
}

export interface WebhookStatus {
  id: string; // wamid
  status: string;
  timestamp: string;
  recipient_id: string;
}

// Internal categorized result from parsing
export type ParsedWebhookEvent =
  | { type: 'text'; waId: string; messageId: string; text: string }
  | { type: 'unsupported'; waId: string; messageId: string; mediaType: string }
  | { type: 'status'; messageId: string; status: string }
  | { type: 'reaction'; messageId: string }
  | { type: 'ignored'; reason: string };
