import { DocumentAnalysis } from '../types/index.ts';

const MODEL = 'openai/gpt-4o-mini';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey() { return process.env.OPENROUTER_API_KEY || ''; }

const SYSTEM_PROMPT = `You are a document analysis AI. Extract structured information from documents to generate full-stack web applications. Given a document, extract: title, description, domain classification, data entities, workflows, forms, API endpoints, permissions, features, missing features. Return ONLY valid JSON.`;

async function generate(prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      'HTTP-Referer': 'http://localhost:4000',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('OpenRouter error response:', response.status, err);
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const raw = await response.text();
  console.log('OpenRouter raw response (first 300 chars):', raw.substring(0, 300));
  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content;
  console.log('Extracted content (first 200 chars):', (content || 'EMPTY').substring(0, 200));
  return content || '';
}

async function extractJSON<T>(text: string): Promise<T> {
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  let jsonStr: string;
  if (start !== -1 && end !== -1) jsonStr = cleaned.slice(start, end + 1);
  else if (arrStart !== -1 && arrEnd !== -1) jsonStr = cleaned.slice(arrStart, arrEnd + 1);
  else jsonStr = cleaned;
  return JSON.parse(jsonStr) as T;
}

async function generateJSON<T>(prompt: string): Promise<T> {
  return extractJSON<T>(await generate(prompt));
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  try {
    return await generateJSON<DocumentAnalysis>(`${SYSTEM_PROMPT}\n\nDocument:\n${text}`);
  } catch (error: any) {
    console.error('AI analysis failed:', error.message);
    throw new Error('Failed to analyze document: ' + error.message);
  }
}

export async function inferenceMissingFeatures(analysis: DocumentAnalysis): Promise<string[]> {
  try {
    return await generateJSON<string[]>(`Given this analysis, infer missing features:\n${JSON.stringify(analysis, null, 2)}`);
  } catch {
    return [];
  }
}

export async function generateApplicationCode(analysis: DocumentAnalysis): Promise<any> {
  const prompt = `Generate full app code for:\n${JSON.stringify(analysis, null, 2)}\nReturn JSON with frontend, backend, databaseSchema, authConfig.`;
  return await generateJSON(prompt);
}
