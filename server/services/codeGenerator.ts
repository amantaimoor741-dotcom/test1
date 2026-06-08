import * as archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { DocumentAnalysis } from '../types/index.ts';
import { generateWireframes, generateDesignSystem, ThemeOption } from './uiGenerator.ts';

export interface GenerationConfig {
  theme?: ThemeOption;
  detectHierarchies?: boolean;
  autoNavigation?: boolean;
  extractImages?: boolean;
  metaOptimization?: boolean;
}

export async function generateFullApp(
  analysis: DocumentAnalysis,
  projectId: string,
  outputDir: string,
  config?: GenerationConfig
): Promise<string> {
  const appDir = path.join(outputDir, projectId);
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

  const wireframes = generateWireframes(analysis);
  const designSystem = generateDesignSystem(analysis.domain, config?.theme);

  // Generate frontend
  const frontendDir = path.join(appDir, 'frontend');
  generateFrontend(frontendDir, analysis, wireframes, designSystem);

  // Generate backend
  const backendDir = path.join(appDir, 'backend');
  generateBackend(backendDir, analysis);

  // Generate database schema
  generateDatabaseSchema(appDir, analysis);

  // Generate deployment config
  generateDeploymentConfig(appDir);

  // Add package.json files
  generatePackageJsons(appDir, analysis);

  // Zip it all up
  const zipPath = path.join(outputDir, `${projectId}.zip`);
  await zipDirectory(appDir, zipPath);

  return zipPath;
}

function generateFrontend(dir: string, analysis: DocumentAnalysis, wireframes: any[], designSystem: any) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, 'src'))) fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  if (!fs.existsSync(path.join(dir, 'src', 'pages'))) fs.mkdirSync(path.join(dir, 'src', 'pages'), { recursive: true });
  if (!fs.existsSync(path.join(dir, 'src', 'components'))) fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });

  // Generate index.html
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${analysis.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

  // Generate Tailwind config
  fs.writeFileSync(path.join(dir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000, host: '0.0.0.0' },
});`);

  // Generate main.tsx
  fs.writeFileSync(path.join(dir, 'src', 'main.tsx'), `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.ts';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`);

  // Generate index.css with Tailwind
  fs.writeFileSync(path.join(dir, 'src', 'index.css'), `@import "tailwindcss";

@theme {
  --color-primary: ${designSystem.colors.primary};
  --color-secondary: ${designSystem.colors.secondary};
  --color-accent: ${designSystem.colors.accent};
  --color-background: ${designSystem.colors.background};
  --color-surface: ${designSystem.colors.surface};
  --color-text: ${designSystem.colors.text};
  --font-heading: '${designSystem.typography.heading}', sans-serif;
  --font-body: '${designSystem.typography.body}', sans-serif;
  --radius-box: ${designSystem.borderRadius};
}

body {
  font-family: var(--font-body);
  background-color: var(--color-background);
  color: var(--color-text);
  margin: 0;
}`);

  // Generate App.tsx
  const entityPages = analysis.entities.map(e => ({
    name: e.name,
    properties: e.properties,
    relations: e.relations,
  }));

  fs.writeFileSync(path.join(dir, 'src', 'App.tsx'), `import { useState } from 'react';

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div className="min-h-screen bg-background text-text">
      <nav className="bg-surface border-b border-white/10 p-4 flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold text-primary">${analysis.title}</h1>
        <div className="flex gap-4">
          <button onClick={() => setPage('dashboard')} className="text-sm hover:text-primary transition-colors">Dashboard</button>
          <button onClick={() => setPage('entities')} className="text-sm hover:text-primary transition-colors">Data</button>
        </div>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        ${entityPages.length > 0 ? `{page === 'dashboard' && <Dashboard />}` : ''}
        ${entityPages.length > 0 ? `{page === 'entities' && <EntityManager />}` : ''}
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title="Total Items" value="0" />
        <StatCard title="Active" value="0" />
        <StatCard title="Pending" value="0" />
      </div>
      <div className="bg-surface rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <p className="text-white/60">No data yet. Start by adding some content.</p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-surface rounded-xl p-6 border border-white/10">
      <p className="text-white/60 text-sm">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

${entityPages.length > 0 ? `
function EntityManager() {
  const entities = ${JSON.stringify(entityPages)};
  const [selected, setSelected] = useState(entities[0]?.name || '');
  const entity = entities.find(e => e.name === selected);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {entities.map((e: any) => (
          <button
            key={e.name}
            onClick={() => setSelected(e.name)}
            className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${
              selected === e.name ? 'bg-primary text-white' : 'bg-surface border border-white/10 hover:border-primary/50'
            }\`}
          >
            {e.name}
          </button>
        ))}
      </div>
      {entity && (
        <div className="bg-surface rounded-xl p-6 border border-white/10">
          <h3 className="text-xl font-heading font-bold mb-4">{entity.name}</h3>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-3 font-medium text-white/60">Property</th>
                <th className="pb-3 font-medium text-white/60">Type</th>
                <th className="pb-3 font-medium text-white/60">Required</th>
              </tr>
            </thead>
            <tbody>
              {entity.properties.map((p: any) => (
                <tr key={p.name} className="border-b border-white/5">
                  <td className="py-3">{p.name}</td>
                  <td className="py-3 text-white/60">{p.type}</td>
                  <td className="py-3">{p.required ? '✓' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
` : ''}`);

  // Generate page files
  const pagesDir = path.join(dir, 'src', 'pages');
  for (const wf of wireframes) {
    const safeName = wf.page.replace(/[^a-zA-Z0-9]/g, '');
    fs.writeFileSync(path.join(pagesDir, `${safeName}.tsx`), `export default function ${safeName}() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading font-bold mb-6">${wf.page}</h1>
      <div className="grid gap-4">
        ${wf.sections.map(s => `<div className="bg-surface rounded-xl p-6 border border-white/10">
          <span className="text-xs font-medium text-primary uppercase tracking-wider">${s.type}</span>
          <p className="mt-2 text-white/80">${s.description}</p>
        </div>`).join('\n        ')}
      </div>
    </div>
  );
}`);
  }
}

function generateBackend(dir: string, analysis: DocumentAnalysis) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, 'src'))) fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  if (!fs.existsSync(path.join(dir, 'src', 'routes'))) fs.mkdirSync(path.join(dir, 'src', 'routes'), { recursive: true });

  // Generate main server
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

${analysis.entities.map(e => `import ${e.name.toLowerCase()}Routes from './routes/${e.name.toLowerCase()}.ts';`).join('\n')}

${analysis.entities.map(e => `app.use('/api/${e.name.toLowerCase()}s', ${e.name.toLowerCase()}Routes);`).join('\n')}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`);

  // Generate routes for each entity
  for (const entity of analysis.entities) {
    const name = entity.name;
    const lname = name.toLowerCase();
    fs.writeFileSync(path.join(dir, 'src', 'routes', `${lname}.ts`), `import { Router } from 'express';
const router = Router();

// GET /api/${lname}s
router.get('/', (_req, res) => {
  res.json({ data: [], message: 'List of ${lname}s' });
});

// GET /api/${lname}s/:id
router.get('/:id', (req, res) => {
  res.json({ data: null, message: \`Get \${req.params.id}\` });
});

// POST /api/${lname}s
router.post('/', (req, res) => {
  res.status(201).json({ data: req.body, message: 'Created' });
});

// PUT /api/${lname}s/:id
router.put('/:id', (req, res) => {
  res.json({ data: req.body, message: \`Updated \${req.params.id}\` });
});

// DELETE /api/${lname}s/:id
router.delete('/:id', (req, res) => {
  res.json({ message: \`Deleted \${req.params.id}\` });
});

export default router;`);
  }

  // Generate package.json
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: `${analysis.title.toLowerCase().replace(/\s+/g, '-')}-api`,
    version: '1.0.0',
    type: 'module',
    scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
    dependencies: { express: '^4.21.0', cors: '^2.8.5', dotenv: '^16.4.0', '@prisma/client': '^5.0.0' },
    devDependencies: { typescript: '~5.8.0', tsx: '^4.19.0', '@types/express': '^4.17.21', '@types/cors': '^2.8.17', prisma: '^5.0.0' },
  }, null, 2));

  // Generate tsconfig
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', outDir: './dist', rootDir: './src', strict: true, esModuleInterop: true, skipLibCheck: true },
    include: ['src'],
  }, null, 2));
}

function generateDatabaseSchema(dir: string, analysis: DocumentAnalysis) {
  const prismaDir = path.join(dir, 'prisma');
  if (!fs.existsSync(prismaDir)) fs.mkdirSync(prismaDir, { recursive: true });

  let schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

  for (const entity of analysis.entities) {
    schema += `model ${entity.name} {\n`;
    schema += `  id        String   @id @default(cuid())\n`;
    schema += `  createdAt DateTime @default(now())\n`;
    schema += `  updatedAt DateTime @updatedAt\n`;

    for (const prop of entity.properties) {
      const isOptional = !prop.required;
      const prismaType = mapToPrismaType(prop.type);
      schema += `  ${prop.name} ${prismaType}${isOptional ? '?' : ''}\n`;
    }

    for (const rel of entity.relations) {
      const targetLower = rel.target.toLowerCase();
      schema += `  ${targetLower}Id String?\n`;
      schema += `  ${targetLower} ${rel.target}? @relation(fields: [${targetLower}Id], references: [id])\n`;
    }

    schema += `}\n\n`;
  }

  fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), schema);

  // .env for prisma
  fs.writeFileSync(path.join(dir, '.env'), 'DATABASE_URL="postgresql://user:password@localhost:5432/mydb"\n');
}

function generateDeploymentConfig(dir: string) {
  // Dockerfile
  fs.writeFileSync(path.join(dir, 'Dockerfile'), `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]`);

  // docker-compose
  fs.writeFileSync(path.join(dir, 'docker-compose.yml'), `version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/mydb
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`);

  // .gitignore
  fs.writeFileSync(path.join(dir, '.gitignore'), `node_modules/
dist/
.env
*.log`);
}

function generatePackageJsons(dir: string, analysis: DocumentAnalysis) {
  const safeName = analysis.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  // Root package.json
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: safeName,
      private: true,
      version: '1.0.0',
      scripts: {
        dev: 'cd frontend && npm run dev',
        build: 'cd frontend && npm run build',
        'install:all': 'cd frontend && npm install && cd ../backend && npm install',
      },
    }, null, 2));
  }

  // Frontend package.json
  fs.writeFileSync(path.join(dir, 'frontend', 'package.json'), JSON.stringify({
    name: `${safeName}-frontend`,
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: { dev: 'vite --port=3000 --host=0.0.0.0', build: 'vite build', preview: 'vite preview' },
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'lucide-react': '^0.546.0' },
    devDependencies: { '@vitejs/plugin-react': '^5.0.0', '@tailwindcss/vite': '^4.1.0', tailwindcss: '^4.1.0', vite: '^6.2.0', typescript: '~5.8.0' },
  }, null, 2));
}

function mapToPrismaType(propType: string): string {
  const t = propType.toLowerCase();
  if (t.includes('string') || t.includes('text') || t.includes('email') || t.includes('url') || t.includes('name') || t.includes('title') || t.includes('description')) return 'String';
  if (t.includes('number') || t.includes('int') || t.includes('count') || t.includes('price') || t.includes('amount')) return 'Int';
  if (t.includes('boolean') || t.includes('bool') || t.includes('is') || t.includes('has') || t.includes('active')) return 'Boolean';
  if (t.includes('date') || t.includes('time')) return 'DateTime';
  if (t.includes('float') || t.includes('decimal') || t.includes('double')) return 'Float';
  return 'String';
}

function zipDirectory(sourceDir: string, outPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}




