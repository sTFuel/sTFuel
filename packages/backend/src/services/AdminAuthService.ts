import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import AppDataSource from '../database/data-source';
import { AdminUser } from '../database/entities/AdminUser';
import { AdminSession } from '../database/entities/AdminSession';
import { config } from '../config/environment';

export class AdminAuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async login(username: string, password: string): Promise<{ sessionToken: string; expiresAt: Date }> {
    const userRepo = AppDataSource.getRepository(AdminUser);
    const user = await userRepo.findOne({ where: { username } });

    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    // Generate session token
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (config.sessionExpiryHours || 24));

    // Create session
    const sessionRepo = AppDataSource.getRepository(AdminSession);
    const session = sessionRepo.create({
      adminUserId: user.id,
      sessionToken,
      expiresAt,
    });

    await sessionRepo.save(session);

    return { sessionToken, expiresAt };
  }

  async logout(sessionToken: string): Promise<void> {
    const sessionRepo = AppDataSource.getRepository(AdminSession);
    await sessionRepo.delete({ sessionToken });
  }

  async validateSession(sessionToken: string): Promise<AdminUser | null> {
    const sessionRepo = AppDataSource.getRepository(AdminSession);
    const session = await sessionRepo.findOne({
      where: { sessionToken },
      relations: ['adminUser'],
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await sessionRepo.delete({ id: session.id });
      return null;
    }

    return session.adminUser;
  }

  async createAdminUser(username: string, password: string): Promise<AdminUser> {
    const userRepo = AppDataSource.getRepository(AdminUser);
    
    // Check if user already exists
    const existing = await userRepo.findOne({ where: { username } });
    if (existing) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.hashPassword(password);
    const user = userRepo.create({
      username,
      passwordHash,
    });

    return userRepo.save(user);
  }
}

