import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.ts';
import os from 'os';

const router = Router();
const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

router.use(authMiddleware, adminOnly);

// GET /api/admin/stats
router.get('/stats', (_req: AuthRequest, res: any) => {
  const projects = getJSON(PROJECTS_FILE);
  const users = getJSON(USERS_FILE);

  const totalUsers = users.length;
  const totalProjects = projects.length;
  const completed = projects.filter((p: any) => p.status === 'completed').length;
  const failed = projects.filter((p: any) => p.status === 'failed').length;
  const processing = projects.filter((p: any) => !['completed', 'failed'].includes(p.status)).length;

  res.json({
    stats: {
      totalUsers,
      totalProjects,
      completedProjects: completed,
      failedProjects: failed,
      processingProjects: processing,
      systemUptime: Math.floor(os.uptime()),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  });
});

// GET /api/admin/logs
router.get('/logs', (_req: AuthRequest, res: any) => {
  const projects = getJSON(PROJECTS_FILE);
  const logs = projects
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      type: p.documentType,
      createdAt: p.createdAt,
      error: p.error,
    }));
  res.json({ logs });
});

function getJSON(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {}
  return [];
}

export default router;



