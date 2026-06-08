import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';
import { parseDocument } from '../services/documentParser.ts';
import { analyzeDocument } from '../services/geminiEngine.ts';
import { classifyDomain, inferMissingRequirements } from '../services/reasoningEngine.ts';
import { generateFullApp, GenerationConfig } from '../services/codeGenerator.ts';

const router = Router();
const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

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

// POST /api/generate - Full pipeline: analyze document -> infer -> code gen
router.post('/', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const { documentId, projectName, theme, config: genConfig } = req.body;
    if (!documentId) {
      res.status(400).json({ error: 'Bad Request', message: 'documentId required' });
      return;
    }

    // Get document
    const docsPath = path.join(DATA_DIR, 'documents.json');
    if (!fs.existsSync(docsPath)) {
      res.status(404).json({ error: 'Not Found', message: 'No documents' });
      return;
    }
    const documents = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    const doc = documents.find((d: any) => d.id === documentId);
    if (!doc) {
      res.status(404).json({ error: 'Not Found', message: 'Document not found' });
      return;
    }
    if (!fs.existsSync(doc.path)) {
      res.status(400).json({ error: 'Bad Request', message: 'Document file not found on server' });
      return;
    }

    // Create project
    const projectId = crypto.randomUUID();
    const project = {
      id: projectId,
      name: projectName || doc.originalName.replace(/\.[^/.]+$/, ''),
      userId: req.userId,
      status: 'analyzing',
      documentType: path.extname(doc.originalName).toLowerCase(),
      theme: theme || 'modern',
      config: genConfig || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projects = getProjects();
    projects.push(project);
    saveProjects(projects);

    // Start async processing
    processDocument(doc.path, doc.mimeType, projectId).catch(err => {
      console.error('Processing failed for', projectId, err.message);
      const proj = getProjects().find((p: any) => p.id === projectId);
      if (proj) {
        proj.status = 'failed';
        proj.error = err.message;
        saveProjects(getProjects());
      }
    });

    res.status(202).json({ projectId, status: 'processing' });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

// GET /api/generate/:id/status
router.get('/:id/status', authMiddleware, (req: AuthRequest, res: any) => {
  const projects = getProjects();
  const project = projects.find((p: any) => p.id === req.params.id && p.userId === req.userId);
  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }
  res.json({
    id: project.id,
    status: project.status,
    name: project.name,
    error: project.error,
  });
});

// GET /api/generate/:id/result
router.get('/:id/result', authMiddleware, (req: AuthRequest, res: any) => {
  const projects = getProjects();
  const project = projects.find((p: any) => p.id === req.params.id && p.userId === req.userId);
  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }
  if (project.status !== 'completed') {
    res.status(400).json({ error: 'Not Ready', message: `Project is ${project.status}` });
    return;
  }
  res.json(project);
});

async function processDocument(filePath: string, mimeType: string, projectId: string) {
  try {
    // Step 1: Parse document
    updateProjectStatus(projectId, 'analyzing');
    const text = await parseDocument(filePath, mimeType);

    // Step 2: Analyze with Gemini
    const analysis = await analyzeDocument(text);
    updateProject(projectId, { documentAnalysis: analysis });

    // Step 3: Reason / infer
    updateProjectStatus(projectId, 'reasoning');
    const domain = classifyDomain(text);
    const missingFeatures = inferMissingRequirements(analysis);
    analysis.domain = domain;
    analysis.missingFeatures = missingFeatures;
    updateProject(projectId, { documentAnalysis: analysis });

    // Step 4: Generate code
    updateProjectStatus(projectId, 'generating');
    const OUTPUT_DIR = path.join(DATA_DIR, 'generated');
    const project = getProjects().find((p: any) => p.id === projectId);
    const genConfig: GenerationConfig = {
      theme: project?.theme || 'modern',
      ...(project?.config || {}),
    };
    const zipPath = await generateFullApp(analysis, projectId, OUTPUT_DIR, genConfig);

    // Step 5: Complete
    const generatedApp = {
      id: projectId,
      name: analysis.title,
      frontend: [],
      backend: [],
      databaseSchema: '',
      authConfig: '',
      createdAt: new Date().toISOString(),
    };

    updateProject(projectId, { status: 'completed', generatedApp, outputPath: zipPath });
  } catch (err: any) {
    updateProject(projectId, { status: 'failed', error: err.message });
  }
}

function updateProjectStatus(projectId: string, status: string) {
  updateProject(projectId, { status, updatedAt: new Date().toISOString() });
}

function updateProject(projectId: string, updates: Record<string, any>) {
  const projects = getProjects();
  const idx = projects.findIndex((p: any) => p.id === projectId);
  if (idx !== -1) {
    Object.assign(projects[idx], updates);
    saveProjects(projects);
  }
}

export default router;



