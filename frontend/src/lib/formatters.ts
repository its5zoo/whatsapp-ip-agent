export function formatWhatsAppIdentity(identity: string): string {
  const suffix = '@s.whatsapp.net';
  return identity.endsWith(suffix) ? identity.slice(0, -suffix.length) : identity;
}

export function formatWhatsAppDisplayIdentity(identity: string): string {
  if (!identity) return 'Unknown user';
  if (identity.endsWith('@g.us')) return 'WhatsApp group';
  if (identity.startsWith('simulator') || identity.startsWith('test')) return identity;

  const number = formatWhatsAppIdentity(identity).replace(/[^\d]/g, '');
  if (/^91\d{10}$/.test(number)) {
    return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  }
  if (/^\d{10}$/.test(number)) {
    return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
  }

  return identity.endsWith('@s.whatsapp.net') ? number : identity;
}

export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const number = phone.replace(/[^\d]/g, '');
  if (/^91\d{10}$/.test(number)) {
    return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  }
  if (/^\d{10}$/.test(number)) {
    return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
  }
  return phone;
}

export function formatStepDisplay(stepId?: string | null): { service?: string; step: string } {
  if (!stepId || stepId === 'start' || stepId === 'menu') {
    return { service: 'General', step: 'Main menu' };
  }

  let service = '';
  let rest = stepId;

  if (stepId.startsWith('patent_')) {
    service = 'Patent';
    rest = stepId.replace(/^patent_/, '');
  } else if (stepId.startsWith('trademark_')) {
    service = 'Trademark';
    rest = stepId.replace(/^trademark_/, '');
  } else if (stepId.startsWith('copyright_')) {
    service = 'Copyright';
    rest = stepId.replace(/^copyright_/, '');
  } else if (stepId.startsWith('design_')) {
    service = 'Design';
    rest = stepId.replace(/^design_/, '');
  } else if (stepId.startsWith('shared_')) {
    service = 'Lead capture';
    rest = stepId.replace(/^shared_/, '');
  }

  const step = rest
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { service: service || undefined, step };
}
