export function formatWhatsAppIdentity(identity: string): string {
  const suffix = '@s.whatsapp.net';
  return identity.endsWith(suffix) ? identity.slice(0, -suffix.length) : identity;
}
