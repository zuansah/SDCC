import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nsm-copilot-api' });
});

// API route for AI Assistant
app.post('/api/ai-assistant/chat', async (req, res) => {
  try {
    const { question, context } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const systemInstruction =
      "You are the NSM SD-WAN operations assistant for Telkom Indonesia. Answer only from the provided operational context. Name specific sites, serials and tickets. If the context does not contain the answer, say so. Be concise. The intelligence feed already tells you which outages are recurring/scheduled vs real — use it.";

    const promptText = `OPERATIONAL CONTEXT:\n${context || 'No specific records matched the query terms in current memory feeds.'}\n\nQUESTION: ${question}`;

    // Enable SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const modelToUse = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const responseStream = await ai.models.generateContentStream({
      model: modelToUse,
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Failed to generate response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Stream error occurred' })}\n\n`);
      res.end();
    }
  }
});

// Cici Agent multi-step loop step endpoint with automatic multi-model quota failover
app.post('/api/cici/chat-step', async (req, res) => {
  try {
    const { contents, systemInstruction, tools, model } = req.body;
    const requestedModel = model || 'gemini-3.8-flash';
    const candidateModels = [requestedModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    const uniqueModels = Array.from(new Set(candidateModels));

    const config: any = {
      systemInstruction: systemInstruction || 'You are Cici, the AI agent of NSM.',
      temperature: 0.1,
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      config.tools = [{ functionDeclarations: tools }];
    }

    let lastError: any = null;
    let response: any = null;

    for (const m of uniqueModels) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents,
          config,
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${m} encountered issue, attempting next fallback model:`, err?.message || err);
      }
    }

    if (!response) {
      throw lastError || new Error('All model endpoints exhausted');
    }

    res.json({
      candidate: response.candidates?.[0],
      text: response.text,
      usageMetadata: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Error in /api/cici/chat-step:', error);
    res.status(500).json({ error: error?.message || 'Failed to complete Cici agent step' });
  }
});

// Cici Document Writer endpoint with resilient model fallbacks
app.post('/api/cici/write-document', async (req, res) => {
  try {
    const { title, kind, instructions, sources, gatheredData } = req.body;

    const docPrompt = `You are Cici's document authoring engine for Telkom Indonesia NSM.
Write a comprehensive, professional Markdown ${kind || 'report'} titled "${title}".
Use clean formatting with headers (#, ##, ###), markdown data tables where appropriate, key takeaways, and operational recommendations.
Every number, device, or status must come from the gathered data below.
End the document with a "Sumber data" section listing the data feeds and timestamps.

INSTRUCTIONS:
${instructions || 'Generate a complete operational summary based on the provided data.'}

GATHERED OPERATIONAL DATA:
${JSON.stringify(gatheredData || {}, null, 2)}

SOURCES:
${(sources || ['NSM Controller Telemetry', 'Asset Inventory Feed', 'Intelligence Engine']).join(', ')}
`;

    let generatedText = '';
    const docModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const m of docModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: docPrompt,
          config: {
            systemInstruction: 'You are Cici, writing high-grade operational Markdown documentation for Telkom Indonesia operations.',
            temperature: 0.2,
          },
        });
        if (response?.text) {
          generatedText = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Doc model ${m} failed, trying next fallback:`, err?.message || err);
      }
    }

    if (!generatedText) {
      throw new Error('Document generation failed across all available models');
    }

    res.json({ markdown: generatedText });
  } catch (error: any) {
    console.error('Error in /api/cici/write-document:', error);
    res.status(500).json({ error: error?.message || 'Failed to write document' });
  }
});

// Helper to build field-specific vision instructions
function getPromptForField(fieldName: string, formSerial?: string): string {
  switch (fieldName) {
    case 'snSdwanImg':
    case 'snOntImg':
      return `This photo is attached for field "${fieldName}" and must show a physical device serial-number label or barcode/QR sticker on the SD-WAN/ONT hardware.
1. Is a serial-number label or barcode/QR clearly legible in the image?
2. If legible, read and extract the EXACT serial number (and device model if visible).
${formSerial ? `The form specifies serial number: "${formSerial}". Check if the photo matches or contradicts this.` : ''}
Respond with a strict JSON object:
{
  "ok": boolean (true if label is legible and matches expected device serial),
  "subjectMatch": boolean (true if device label is visible),
  "extracted": {
    "serialNumber": string or null,
    "deviceModel": string or null
  },
  "issues": string[] (e.g. ["serial unreadable", "blurry photo", "wrong subject - no device label visible"])
}`;

    case 'rackBeforeImg':
      return `This photo is attached for "Rack Before" (server/network rack prior to installation).
1. Is an equipment rack, cabinet, or IT enclosure clearly visible?
2. Is the photo clear or blurry?
Respond with a strict JSON object:
{
  "ok": boolean (true if rack/enclosure is clearly visible),
  "subjectMatch": boolean,
  "extracted": { "rackVisible": boolean },
  "issues": string[] (e.g. ["wrong subject - no rack visible", "blurry"])
}`;

    case 'rackAfterImg':
      return `This photo is attached for "Rack After" (server/network rack after installation completed).
1. Is an equipment rack, cabinet, or IT enclosure with installed hardware clearly visible?
2. Is the photo clear or blurry?
Respond with a strict JSON object:
{
  "ok": boolean (true if rack with installed equipment is clearly visible),
  "subjectMatch": boolean,
  "extracted": { "rackVisible": boolean },
  "issues": string[] (e.g. ["wrong subject - no rack visible", "blurry"])
}`;

    case 'cablingSdwanImg':
      return `This photo is attached for "Cabling SD-WAN" (network patch cables, power wiring, and cable management).
1. Is network cabling/patching clearly visible?
2. Is the photo clear or blurry?
Respond with a strict JSON object:
{
  "ok": boolean (true if network cabling is clearly visible),
  "subjectMatch": boolean,
  "extracted": { "cablingVisible": boolean },
  "issues": string[] (e.g. ["wrong subject - no cabling visible", "blurry"])
}`;

    case 'pingAstinetImg':
    case 'pingTracerouteImg':
      return `This photo is attached for "${fieldName}" and must be a screenshot or photo of a terminal/console ping or traceroute network test.
1. Is this a console/terminal ping or traceroute test output?
2. Did the test succeed (0% packet loss) or fail?
3. What is the approximate latency/RTT (ms) if displayed?
Respond with a strict JSON object:
{
  "ok": boolean (true if ping/traceroute console screenshot is visible and legible),
  "subjectMatch": boolean,
  "extracted": {
    "pingResult": "success" | "fail" | "unknown",
    "latencyMs": number or null,
    "hostOrIp": string or null
  },
  "issues": string[] (e.g. ["not a test screenshot", "unreadable text", "blurry"])
}`;

    case 'speedtestGlobalImg':
    case 'speedtestDomestikImg':
      return `This photo is attached for "${fieldName}" and must be a speedtest result screenshot.
1. Is a speedtest gauge or download/upload results clearly visible?
2. Extract download speed (Mbps), upload speed (Mbps), and ping (ms) if legible.
Respond with a strict JSON object:
{
  "ok": boolean (true if speedtest result is visible),
  "subjectMatch": boolean,
  "extracted": {
    "downloadMbps": number or null,
    "uploadMbps": number or null,
    "pingMs": number or null
  },
  "issues": string[] (e.g. ["not a speedtest screenshot", "blurry"])
}`;

    case 'frontViewImg':
      return `This photo is attached for "Front View" (front view of building or customer premises).
Is the building front/premises visible and clear?
Respond with a strict JSON object:
{
  "ok": boolean,
  "subjectMatch": boolean,
  "extracted": {},
  "issues": string[]
}`;

    case 'withPicImg':
      return `This photo is attached for "Photo with PIC" (technician with Person In Charge on-site).
Is a person/technician visible on-site?
Respond with a strict JSON object:
{
  "ok": boolean,
  "subjectMatch": boolean,
  "extracted": {},
  "issues": string[]
}`;

    case 'equipmentPlacementImg':
    case 'sdwanBoxImg':
      return `This photo is attached for "${fieldName}" and should show equipment placement or SD-WAN box/device.
Is the network equipment/device clearly visible?
Respond with a strict JSON object:
{
  "ok": boolean,
  "subjectMatch": boolean,
  "extracted": {},
  "issues": string[]
}`;

    case 'modemMainImg':
    case 'modemBackupImg':
      return `This photo is attached for "${fieldName}" and should show the modem or ONT device.
Is a modem/router/ONT clearly visible?
Respond with a strict JSON object:
{
  "ok": boolean,
  "subjectMatch": boolean,
  "extracted": {},
  "issues": string[]
}`;

    default:
      return `This photo is attached for field "${fieldName}".
Verify if the image is clear, upright, and not blurry.
Respond with a strict JSON object:
{
  "ok": boolean,
  "subjectMatch": boolean,
  "extracted": {},
  "issues": string[]
}`;
  }
}

// API route for AI Evidence Verification (Gemini Vision)
app.post('/api/ai-evidence/verify', async (req, res) => {
  try {
    const { fieldName, imageBase64, formSerialNumber } = req.body;
    if (!fieldName || !imageBase64) {
      return res.status(400).json({ error: 'fieldName and imageBase64 are required' });
    }

    // Strip data:image/...;base64, prefix if present
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      cleanBase64 = parts[1];
    }

    const fieldPrompt = getPromptForField(fieldName, formSerialNumber);
    const modelToUse = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `${fieldPrompt}\n\nCRITICAL: Respond with a single raw JSON object only. Do NOT include markdown code blocks or backticks.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text || '{}';
    let verdict: any = {};
    try {
      verdict = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        verdict = JSON.parse(match[0]);
      } else {
        verdict = {
          ok: true,
          subjectMatch: true,
          extracted: {},
          issues: [],
        };
      }
    }

    const hasIssues = Array.isArray(verdict.issues) && verdict.issues.length > 0;
    const isOk = verdict.ok !== false && !hasIssues;

    const finalVerdict = {
      ok: isOk,
      subjectMatch: verdict.subjectMatch !== false,
      status: isOk ? 'verified' : 'warning',
      extracted: verdict.extracted || {},
      issues: verdict.issues || [],
      checkedAt: new Date().toISOString(),
      modelUsed: modelToUse,
    };

    res.json(finalVerdict);
  } catch (error: any) {
    console.error('Error verifying evidence with Gemini:', error);
    // Degrade gracefully so technician is never blocked
    res.json({
      ok: true,
      subjectMatch: true,
      status: 'unchecked',
      extracted: {},
      issues: ['AI verification temporarily unavailable (offline mode)'],
      checkedAt: new Date().toISOString(),
      error: error?.message || 'Server error',
    });
  }
});

async function main() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NSM Server running at http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
