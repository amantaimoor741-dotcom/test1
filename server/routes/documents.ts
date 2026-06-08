import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseDocument } from '../services/documentParser.ts';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';

const router = Router();
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: PDF, DOCX, TXT, MD'));
  },
});

// POST /api/documents/upload
router.post('/upload', authMiddleware, (req: AuthRequest, res: any) => {
  upload.single('document')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: 'Upload Error', message: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Bad Request', message: 'No file provided' });
      return;
    }

    const document = {
      id: crypto.randomUUID(),
      userId: req.userId,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      status: 'uploaded',
      createdAt: new Date().toISOString(),
    };

    const docsPath = path.join(process.cwd(), 'data', 'documents.json');
    let documents: any[] = [];
    if (fs.existsSync(docsPath)) {
      documents = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    }
    documents.push(document);
    fs.writeFileSync(docsPath, JSON.stringify(documents, null, 2));

    res.status(201).json({ document });
  });
});

// GET /api/documents/:id/content
router.get('/:id/content', authMiddleware, async (req: AuthRequest, res: any) => {
  const docsPath = path.join(process.cwd(), 'data', 'documents.json');
  if (!fs.existsSync(docsPath)) {
    res.status(404).json({ error: 'Not Found', message: 'No documents' });
    return;
  }
  const documents = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
  const doc = documents.find((d: any) => d.id === req.params.id && d.userId === req.userId);
  if (!doc || !fs.existsSync(doc.path)) {
    res.status(404).json({ error: 'Not Found', message: 'Document not found' });
    return;
  }

  try {
    const text = await parseDocument(doc.path, doc.mimeType);
    res.json({ text, document: doc });
  } catch (err: any) {
    res.status(500).json({ error: 'Parse Error', message: err.message });
  }
});

export default router;



