import crypto from 'node:crypto';

/**
 * Verifies the X-Hub-Signature-256 header against the raw request body.
 *
 * @param rawBody - The exact raw Buffer received from the request body
 * @param signatureHeader - The value of the X-Hub-Signature-256 header
 * @param appSecret - The Meta App Secret
 * @returns boolean indicating if the signature is valid
 */
export function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  if (!rawBody) {
    return false;
  }

  const signatureHash = signatureHeader.slice(7); // Remove 'sha256=' prefix

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const signatureBuffer = Buffer.from(signatureHash, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (error) {
    // Buffer.from can throw if the hex string is malformed
    return false;
  }
}
