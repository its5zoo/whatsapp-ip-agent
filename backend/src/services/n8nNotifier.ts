import { env } from '../config/env';

export interface N8nLeadPayload {
  event: string;
  timestamp: string;
  lead: {
    id: string;
    conversationId: string;
    name: string;
    organization: string;
    email: string;
    mobile: string;
    city: string;
    preferredComm: string;
    phoneCallTime: string | null;
    flowType: string;
    answers: Record<string, any>;
    createdAt: string;
  };
}

export class N8nNotifier {
  async notifyNewLead(leadData: any): Promise<void> {
    const webhookUrl = env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return; // No-op
    }

    const payload: N8nLeadPayload = {
      event: 'lead.created',
      timestamp: new Date().toISOString(),
      lead: {
        id: leadData.id,
        conversationId: leadData.conversationId,
        name: leadData.name,
        organization: leadData.organization,
        email: leadData.email,
        mobile: leadData.mobile,
        city: leadData.city,
        preferredComm: leadData.preferredComm,
        phoneCallTime: leadData.phoneCallTime,
        flowType: leadData.flowType,
        answers: leadData.answers,
        createdAt: leadData.createdAt?.toISOString() || new Date().toISOString()
      }
    };

    const timeoutMs = env.N8N_TIMEOUT_MS || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (env.N8N_WEBHOOK_SECRET) {
      headers['X-Webhook-Secret'] = env.N8N_WEBHOOK_SECRET;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[N8N Notifier] Webhook failed with status ${response.status}: ${response.statusText}`);
      } else {
        console.log(`[N8N Notifier] Successfully sent lead notification for ${leadData.id}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[N8N Notifier] Webhook request timed out after ${timeoutMs}ms.`);
      } else {
        console.warn(`[N8N Notifier] Webhook error: ${err.message}`);
      }
    }
  }
}

export const n8nNotifier = new N8nNotifier();
