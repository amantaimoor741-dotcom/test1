import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  file?: Express.Multer.File;
}

function verifyLocalToken(token: string): { userId: string; role: string } | null {
  try {
    const parts = token.split('_');
    if (parts[0] === 'demo' && parts[1] === 'token') {
      const userId = parts[2] || 'demo_user_001';
      return { userId, role: 'user' };
    }
  } catch {}
  return null;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  try {
    const token = header.split(' ')[1];

    // Try local demo token first
    const local = verifyLocalToken(token);
    if (local) {
      req.userId = local.userId;
      req.userRole = local.role;
      next();
      return;
    }

    // Fallback to Clerk token
    const { verifyToken } = await import('@clerk/backend').catch(() => ({ verifyToken: null }));
    if (verifyToken) {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (secretKey) {
        const payload = await verifyToken(token, {
          secretKey,
          authorizedParties: ['http://localhost:3000', process.env.APP_URL || ''],
        });
        req.userId = payload.sub;
        req.userRole = 'user';
        next();
        return;
      }
    }

    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    return;
  }
  next();
}
