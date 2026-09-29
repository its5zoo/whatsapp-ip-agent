import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/authService';

export async function verifyAuthCookie(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.cookies.auth_token;
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized: No token provided' });
    }

    authService.verifyToken(token);
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}
