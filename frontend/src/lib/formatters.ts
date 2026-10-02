export function formatWhatsAppIdentity(identity: string): string {
  const suffix = '@s.whatsapp.net';
  return identity.endsWith(suffix) ? identity.slice(0, -suffix.length) : identity;
}

export function formatWhatsAppDisplayIdentity(identity: string): string {
  if (identity.endsWith('@g.us')) return 'WhatsApp group';
  if (identity.startsWith('simulator') || identity.startsWith('test')) return identity;

  const number = formatWhatsAppIdentity(identity).replace(/^\+/, '');
  if (/^91\d{10}$/.test(number)) {
    return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  }

  return identity.endsWith('@s.whatsapp.net') ? number : identity;
}

export function formatPhoneDisplay(phone: string): string {
  if (/^91\d{10}$/.test(phone.replace(/^\+/, ''))) {
    const number = phone.replace(/^\+/, '');
    return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  }
  return phone;
}
