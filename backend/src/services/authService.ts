import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export class AuthService {
  async validateLogin(username: string, password: string): Promise<boolean> {
    if (username !== env.ADMIN_USERNAME) {
      return false;
    }
    return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  }

  generateToken(): string {
    return jwt.sign({ sub: 'admin' }, env.JWT_SECRET, { expiresIn: '8h' });
  }

  verifyToken(token: string): any {
    return jwt.verify(token, env.JWT_SECRET);
  }
}

export const authService = new AuthService();
