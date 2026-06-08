import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  file?: Express.Multer.File;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  try {
    const token = header.split(' ')[1];
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Server Error', message: 'Clerk secret key not configured' });
      return;
    }
    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties: ['http://localhost:3000'],
    });
    req.userId = payload.sub;
    req.userRole = 'user';
    next();
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
