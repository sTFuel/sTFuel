import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from '../services/AdminAuthService';

const adminAuthService = new AdminAuthService();

export interface AuthenticatedRequest extends Request {
  adminUser?: any;
}

export async function adminAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get session token from cookie
    const sessionToken = req.cookies?.adminSession || req.headers['x-admin-session'] as string;

    if (!sessionToken) {
      res.status(401).json({ error: 'Unauthorized: No session token provided' });
      return;
    }

    const adminUser = await adminAuthService.validateSession(sessionToken);

    if (!adminUser) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
      return;
    }

    // Attach admin user to request
    req.adminUser = adminUser;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

