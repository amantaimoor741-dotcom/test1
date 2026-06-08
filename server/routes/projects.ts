import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';

const router = Router();
const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');

function getProjects(): any[] {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveProjects(projects: any[]) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// GET /api/projects
router.get('/', authMiddleware, (req: AuthRequest, res: any) => {
  const projects = getProjects().filter((p: any) => p.userId === req.userId);
  res.json({ projects: projects.map(({ documentAnalysis, generatedApp, ...rest }: any) => rest) });
});

// GET /api/projects/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res: any) => {
  const project = getProjects().find((p: any) => p.id === req.params.id && p.userId === req.userId);
  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }
  res.json({ project });
});

// DELETE /api/projects/:id
router.delete('/:id', authMiddleware, (req: AuthRequest, res: any) => {
  const projects = getProjects();
  const idx = projects.findIndex((p: any) => p.id === req.params.id && p.userId === req.userId);
  if (idx === -1) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }
  projects.splice(idx, 1);
  saveProjects(projects);
  res.json({ message: 'Deleted' });
});

// GET /api/projects/:id/download
router.get('/:id/download', authMiddleware, (req: AuthRequest, res: any) => {
  const project = getProjects().find((p: any) => p.id === req.params.id && p.userId === req.userId);
  if (!project || !project.outputPath || !fs.existsSync(project.outputPath)) {
    res.status(404).json({ error: 'Not Found', message: 'Generated file not found' });
    return;
  }
  res.download(project.outputPath, `${project.name}.zip`);
});

export default router;



