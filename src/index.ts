import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Ai } from '@cloudflare/ai';
import { ChatHistoryService } from './services/chatHistory';
import { RAGService } from './services/rag';
import { LeadService } from './services/leadServices';
import { nanoid } from 'nanoid';

const app = new Hono<{ Bindings: Env }>();
let intentVectors: IntentVector[] = [];

app.use(cors({
  origin: '*'
}));

// import dotenv from "dotenv";
// dotenv.config(); // loads variables from .env into process.env

app.get('/status', async (c) => c.text('true'));

// Updated Property interface to match your friend's format
interface Property {
  id: number;
  ref_id: string;
  name: string;
  type: 'Rent' | 'Sale';
  image: string;
  url : string;
  category: 'Apartment' | 'Villa' | 'Townhouse' | 'Office' | 'Shop' | 'Penthouse';
  status: 'Enabled' | 'Disabled';
  posted_on: string;
  views: number;
  featured: boolean;
  price: number;
  location: string;
  latitude: number;
  longitude: number;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
}

// Property service to interact with SvelteKit API
class PropertyService {
  constructor(private svelteKitBaseUrl: string) {}
  
  async getProperties(filters?: {
    type?: string;
    category?: string;
    location?: string;
    bedrooms?: string;
    featured?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }): Promise<Property[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.location) params.set('location', filters.location);
      if (filters?.bedrooms) params.set('bedrooms', filters.bedrooms);
      if (filters?.featured) params.set('featured', filters.featured);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));

      console.log( `${this.svelteKitBaseUrl}/properties?${params}`)
      const response = await fetch(
        `${this.svelteKitBaseUrl}/properties?${params}`
      );
      console.log("response",response)
      if (!response.ok) {
        const text = await response.text();
        console.error("Failed request:", response.status, text);
        return [];
      }

      const data = await response.json();

      // SvelteKit returns { data: [...], pagination: {...} }
      let properties: Property[] = data.data ?? [];

      // Apply extra price filtering client-side
      if (filters?.minPrice) {
        properties = properties.filter((p: Property) => p.price >= filters.minPrice!);
      }
      if (filters?.maxPrice) {
        properties = properties.filter((p: Property) => p.price <= filters.maxPrice!);
      }

      return properties;
    } catch (error) {
      console.error("Error fetching properties from SvelteKit:", error);
      return [];
    }
  }
  
}

// Chat endpoint
app.post('/chat', async (c) => {
  console.log('Received chat request');
  
  try {
    
    const { message, sessionId, userId, audioData, audio } = await c.req.json();
    const audioBase64 = audioData || audio;
    
    let userMessage = message || '';
    const ai = new Ai(c.env.AI);
    const chatHistory = new ChatHistoryService(c.env.real_estate_chatbot);
    const leadService = new LeadService(c.env.real_estate_chatbot);
    const ragService = new RAGService(ai, c.env.VECTORIZE, c.env.real_estate_chatbot);
    
    // Initialize PropertyService with your SvelteKit server URL
    const propertyService = new PropertyService(c.env.SVELTEKIT_API_URL ||  'https://my-sveltekit-app.kalyshasachiutama.workers.dev');
    
    // Handle audio input
    if (audioBase64 && !message) {
      console.log('Processing audio data');
      const base64Clean = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      
      function base64ToUint8Array(base64: string) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
      
      const audioBuffer = base64ToUint8Array(base64Clean);
      const audioArray: number[] = Array.from(audioBuffer);
      
      const transcription = await ai.run('@cf/openai/whisper', {
        audio: audioArray,
      });
      userMessage = transcription.text;
      console.log('Transcription:', userMessage);
    }
    
    // Get chat history
    const history = await chatHistory.getHistory(sessionId || 'default');
    
    // Detect language
    const isArabic = /[\u0600-\u06FF]/.test(userMessage);
    
    let response = "Sorry, I couldn't process your request.";
    
    if (!intentVectors || intentVectors.length === 0) {
      await buildIntentEmbeddings(ai);
    }
    
    const result = await detectIntent(userMessage, ai, intentVectors);
    let lead = userId ? await leadService.getLead(userId) : null;
    console.log("result", result.intent, "pls", result.score)
    if (result.intent === "contact" && result.score > 0.8 || result.intent === "viewing" && result.score > 0.8 || result.intent === "interested" && result.score > 0.8  ) {
      console.log("LEAD GENERATION", userMessage);
      
      if (!lead) {
        await leadService.createOrUpdateLead(userId, { lead_step: 1 });
        lead = await leadService.getLead(userId);
        response = "Can you give me your name?"
      }
    }
    // Handle lead flow
  
    else if (lead) {
      if (lead.lead_step >= 1 && lead.lead_step <= 3) {
        switch (lead.lead_step) {
          case 1:
            const nameRegex = /^[a-zA-Z\s'-]+$/;
            if (!nameRegex.test(userMessage)) {
              response = 'Name contains invalid characters.';
            } else {
              await leadService.updateLead(userId, { name: userMessage, lead_step: 2 });
              response = "Thanks! Can I have your email?"
            }
            break;
          case 2:
            if (!userMessage.includes('@')) {
              response = 'Please provide a valid email address.';
            } else {
              await leadService.updateLead(userId, { email: userMessage, lead_step: 3 });
              response = "Great! Finally, your phone number?"
            }
            break;
          case 3:
            if (!/^\+?\d{7,15}$/.test(userMessage)) {
              response = 'Please provide a valid phone number.';
            } else {
              const historyContext = [history.slice(-3).map(h => 
                `User: ${h.user_message}\nAssistant: ${h.assistant_message}`
              ).join('\n\n')];
              console.log("history",historyContext)
              let lead = await leadService.updateLead(userId, { phone: userMessage, lead_step: 4 });
              lead = await leadService.updateLead(userId, { interested_properties: historyContext, lead_step: 4 });
              if (!lead) {
                response = "Error updating lead.";
                break;
              }
              
              
              await leadService.sendLeadEmail(lead)
              response = "We'll have an agent contact you soon!"
            }
            break;
          case 4:
            response = "You're already in our system, we'll reach out shortly!";
            break;
        }
      }
    }
    else if  (result.intent === "property-search" && result.score > 0.7)  {
      // Regular chat - get properties from SvelteKit API
      console.log("Property chat flow");
      console.log("User message:", userMessage);
      const filters = extractFilters(userMessage);
      const properties = await propertyService.getProperties(filters);
      console.log("Properties from SvelteKit:", properties.length, "properties", properties);
      response = await generateChatResponse(userMessage, properties, result.intent,history, ai, isArabic);
    }else{
        // Regular RAG chat
      console.log("now we talking")
      const context = await ragService.searchDocs(userMessage);
      console.log("context",context)
      response = await generateChatResponse(userMessage,context,result.intent, history, ai, isArabic);
    }
    
    // Save to history
    if (!lead){
      await chatHistory.saveMessage(sessionId || 'default', userMessage, response, userId);
    }
    return c.json({ 
      response, 
      sessionId: sessionId || nanoid(),
      transcription: audioBase64 ? userMessage : undefined 
    });
  } catch (err) {
    console.error('Chat handler error:', err);
    return c.json({ error: 'Internal server error', details: err.toString() }, 500);
  }
});


// Get properties endpoint (proxy to SvelteKit)
app.get('/properties', async (c) => {
  try {
    const propertyService = new PropertyService(c.env.SVELTEKIT_API_URL || 'http://localhost:5173');
    
    // np query parameters
    const filters = {
      type: c.req.query('type'),
      category: c.req.query('category'),
      location: c.req.query('location'),
      bedrooms: c.req.query('bedrooms'),
      featured: c.req.query('featured'),
      minPrice: c.req.query('minPrice') ? parseInt(c.req.query('minPrice')!) : undefined,
      maxPrice: c.req.query('maxPrice') ? parseInt(c.req.query('maxPrice')!) : undefined,
    };
    
    const properties = await propertyService.getProperties(filters);
    return c.json({ success: true, data: properties });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});




interface DocumentStore {
  [id: string]: { filename: string; content: string };
}
// In-memory storage for demo (just text & metadata)
const documents: DocumentStore = {};

async function extractText(file: File): Promise<string> {
  const contentType = file.type || '';
  const buffer = await file.arrayBuffer();

  // Default to plain text
  try {
    return await file.text();
  } catch {
    return '[binary file cannot be embedded]';
  }
}

async function embedChunks(c: any, text: string) {
  const chunks = text.match(/.{1,1000}/g) || [];
  const vectors: any[] = [];

  for (const chunk of chunks) {
    const modelResp = await c.env.AI.run('@cf/baai/bge-m3', { text: chunk });
    vectors.push({ id: crypto.randomUUID(), values: modelResp.data[0], metadata: { content: chunk } });
  }

  return vectors;
}

// Upload endpoint
// --- Upload endpoint ---
app.post('/upload', async (c) => {
  try {
    console.log('Upload request received');
    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!file) return c.json({ error: 'No file uploaded' }, 400)

    const docId = crypto.randomUUID()
    let text = await file.text()
    console.log(`File ${file.name} uploaded, ${text} size: ${text.length} chars`)

    // If file is binary type, store placeholder
    if (!text.trim()) text = '[binary file cannot be embedded]'

       // --- Paragraph-based chunking ---
    const MAX_SIZE = 1000
    const rawParagraphs = text.split(/\n\s*\n/) // split on blank lines
    const chunks: string[] = []
    let current = ''

    for (const para of rawParagraphs) {
      if ((current + para).length > MAX_SIZE) {
        if (current.trim().length > 0) chunks.push(current.trim())
        current = para
      } else {
        current += (current ? ' ' : '') + para
      }
    }
    if (current.trim().length > 0) chunks.push(current.trim())

    const upsertData: any[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Embed with Cloudflare AI
      const vectors = await c.env.AI.run('@cf/baai/bge-m3', { text: chunk })

      upsertData.push({
        id: `${docId}_chunk_${i}`,
        values: vectors.data[0],
        metadata: {
          filename: file.name,
          content: chunk,
          chunk_index: i,
          total_chunks: chunks.length,
        },
      })
    }
  

    // Upsert all chunks to the vector DB
    const red = await c.env.VECTORIZE.upsert(upsertData);
    console.log('Vector upsert result:', red);

    return c.json({ 
      status: 'success', 
      document_id: docId, 
      filename: file.name,
      chunks: chunks.length 
    });

  } catch (err) {
    return c.json({ error: `Upload failed: ${err.message}` }, 500);
  }
});
//     let vectors= await c.env.AI.run('@cf/baai/bge-m3', { text })
 
//     let red = await c.env.VECTORIZE.upsert([
//       { id: docId, values: vectors.data[0], metadata: { filename: file.name, content: text } }
//     ])
//     console.log('Vector upsert result:', red)
// // 

//     // Also store in memory for viewings
//     documents[docId] = { filename: file.name, content: text }

//     return c.json({ status: 'success', document_id: docId, filename: file.name })
//   } catch (err) {
//     return c.json({ error: `Upload failed: ${err.message}` }, 500)
//   }
// })
// app.post('/upload', async (c) => {
//   try {
//     const formData = await c.req.formData();
//     const file = formData.get('file') as File;

//     if (!file) return c.json({ error: 'No file uploaded' }, 400);

//     const docId = crypto.randomUUID();
//     const text = await extractText(file);

//     console.log(`File ${file.name} extracted, length: ${text.length}`);

//     const vectors = await embedChunks(c, text);

//     // Upsert all chunks to VECTORIZE DB
//     await c.env.VECTORIZE.upsert(vectors);

//     // Store original document for reference
//     documents[docId] = { filename: file.name, content: text };

//     return c.json({ status: 'success', document_id: docId, filename: file.name });
//   } catch (err: any) {
//     return c.json({ error: `Upload failed: ${err.message}` }, 500);
//   }
// });

// Delete document endpoint
app.delete('/delete/:id', async (c) => {
  const id = c.req.param('id')
  if (!documents[id]) return c.json({ error: 'Not found' }, 404)

  await c.env.VECTORIZE.deleteByIds([id])
  delete documents[id]

  return c.json({ status: true, message: 'Deleted' })
})


interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

// Intent detection functions
import intentData from "./intents.json";

export interface IntentVector {
  intent: string;
  example: string;
  embedding: number[];
}

async function buildIntentEmbeddings(ai: Ai) {
  console.log("Building intent embeddings");
  const allExamples = intentData.flatMap(i => i.examples);

  const embeddingResp = await ai.run('@cf/baai/bge-small-en-v1.5', { text: allExamples });

  intentVectors = [];
  let idx = 0;
  for (const intentObj of intentData) {
    for (const example of intentObj.examples) {
      intentVectors.push({
        intent: intentObj.intent,
        example,
        embedding: embeddingResp.data[idx]
      });
      idx++;
    }
  }
  console.log("Built intent vectors:", intentVectors.length);
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  const dot = vecA.reduce((acc, v, i) => acc + v * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((acc, v) => acc + v * v, 0));
  const normB = Math.sqrt(vecB.reduce((acc, v) => acc + v * v, 0));
  return dot / (normA * normB);
}

async function detectIntent(message: string, ai: Ai, intentVectors: any[]) {
  const embedding = await ai.run("@cf/baai/bge-small-en-v1.5", { text: message });
  const userVector = embedding.data[0];

  let bestMatch = { intent: "unknown", score: -1 };
  
  for (const example of intentVectors) {
    const score = cosineSimilarity(userVector, example.embedding);
    if (score > bestMatch.score) {
      bestMatch = { intent: example.intent, score };
    }
  }
  console.log("Intent detection result:", bestMatch);
  return bestMatch;
}

async function generateChatResponse(
  message: string,
  sentcontext: Property[] | String,
  intent : string,
  history: any[],
  ai: Ai,
  isArabic: boolean
) {
  let context: string = '';
  if (intent == "property-seacrch" && Array.isArray(sentcontext) && sentcontext.length > 0) {
    context = sentcontext.map((p: Property) =>
      `${p.image} ${p.ref_id}: ${p.name} • ${p.location} • ${p.area} sqm • ${p.bedrooms} BR • ${p.bathrooms} Bath • ${p.price} QAR • ${p.type} • ${p.category} • ${p.featured ? 'Featured' : ''}`
    ).join('\n');
  } else if (Array.isArray(sentcontext)) {
    console.log("girl i am here obvii")
    context = sentcontext.map((p: any) =>
      `${p.content}`
    ).join('\n');
  } else if (typeof sentcontext === 'string') {
    context = sentcontext;
  }
  console.log('Context for LLM:', JSON.stringify(context));
  
  const historyContext = history.slice(-6).map(h => 
    `User: ${h.user_message}\nAssistant: ${h.assistant_message}`
  ).join('\n\n');
  
  const systemPrompt = `You are a helpful real estate assistant. Answer based on the context and conversation history.

${isArabic ? 'أجب باللغة العربية فقط.' : 'Answer in English.'}

Context:
${context}

Conversation History:
${historyContext}

Rules:
- Be conversational and friendly
- Stay on topic to real estate if user query irrelevent redirect back and don't answer query
- Use bullet points for property listings
- Honor numerical filters
IMPORTANT:
- If no context or property is relevant to user query, don't fabricate any data just say "no data found"
- Strictly only use property listings or context provided in your answer 
- Exclude any * or **
- Respond entirely in language specified `;
//- Do not use * or ** for formatting
// If no property listing is relevant to user query, don't fabricate any property just say "I couldn't find any properties that match your criteria. Could you please provide more details or adjust your requirements?"
// - Only use property listings or context provided in your answer 
  const result = await ai.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_tokens: 500,
    temperature: 0
  });
  
  return result.response;
}

function extractFilters(message: string) {
  const filters: any = {};
  
  // Extract property type
  if (/\b(rent|rental|renting)\b/i.test(message)) filters.type = 'Rent';
  if (/\b(buy|sale|purchase|buying)\b/i.test(message)) filters.type = 'Sale';
  
  // Extract category
  if (/\b(apartment|flat)\b/i.test(message)) filters.category = 'Apartment';
  if (/\bvilla\b/i.test(message)) filters.category = 'Villa';
  if (/\btownhouse\b/i.test(message)) filters.category = 'Townhouse';
  if (/\boffice\b/i.test(message)) filters.category = 'Office';
  if (/\bshop\b/i.test(message)) filters.category = 'Shop';
  if (/\bpenthouse\b/i.test(message)) filters.category = 'Penthouse';
  
  // Extract location
  const locationMatch = message.match(/\b(west bay|pearl|lusail|al wakrah|al rayyan|doha|corniche|downtown|mansoura|al sadd)\b/i);
  if (locationMatch) filters.location = locationMatch[1];
  
  const bedroomMatch = message.match(/(\d+)\s*(bedroom|br|bed|bhk)/i);
  if (bedroomMatch) filters.bedrooms = bedroomMatch[1];
  
  const priceMatch = message.match(/under\s*(\d+)|below\s*(\d+)|max\s*(\d+)/i);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]);
  }
  
  const minPriceMatch = message.match(/above\s*(\d+)|over\s*(\d+)|min\s*(\d+)/i);
  if (minPriceMatch) {
    filters.minPrice = parseInt(minPriceMatch[1] || minPriceMatch[2] || minPriceMatch[3]);
  }
  
  if (/featured/i.test(message)) filters.featured = 'true';
  
  console.log("Extracted filters:", filters);
  return filters;
}

export default app;