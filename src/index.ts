/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Ai } from '@cloudflare/ai';
import { RAGService } from './services/rag';
import { ChatHistoryService } from './services/chatHistory';
import { LeadService } from './services/leadServices';
import { nanoid } from 'nanoid';

const app = new Hono<{ Bindings: Env }>();
let intentVectors: IntentVector[] = [];
// app.use('*', cors());
// app.use(
//   '*',
//   cors({
//     origin: 'http://localhost:3000', // or "*" if you want all origins
//     allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowHeaders: ['Content-Type', 'Authorization'],
//   })
// );

app.use(cors({
          origin: '*' // Allows all origins
        }));

app.get('/status', async (c) => c.text('true'));


// Chat endpoint
app.post('/chat', async (c) => {
  console.log('Received chat request');
   try {
    const { message, sessionId, userId, audioData,audio} = await c.req.json();
    const audioBase64 = audioData || audio; 
    // For now, skip audio
  let userMessage = message || '';
  const ai = new Ai(c.env.AI);
  const ragService = new RAGService(ai, c.env.VECTORIZE, c.env.real_estate_chatbot);
  const chatHistory = new ChatHistoryService(c.env.real_estate_chatbot);
  const leadService = new LeadService(c.env.real_estate_chatbot);
  
  
  // Handle audio input
  if (audioData && !message) {
    console.log('Processing audio data');
    // Convert base64 to Uint8Array
    const base64Clean = audioData.includes(',')
        ? audioData.split(',')[1]
        : audioData;

      // convert base64 → Uint8Array (Worker safe)
      function base64ToUint8Array(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      const audioBuffer = base64ToUint8Array(base64Clean);

      // Convert Uint8Array to number[]
      const audioArray: number[] = Array.from(audioBuffer);

      const transcription = await ai.run('@cf/openai/whisper', {
        audio: audioArray,
      });
      userMessage = transcription.text;
      console.log('Transcription:', userMessage);
    }
  //   const audioBuffer = new Uint8Array(Buffer.from(audioData, 'base64'));
  //   const transcription = await ai.run('@cf/openai/whisper', {
  //     audio: audioBuffer
  //   });
  //   userMessage = transcription.text;
  // }
  
  // Get chat history
  const history = await chatHistory.getHistory(sessionId || 'default');
  console.log('Chat history:', history);
  // Detect language
  const isArabic = /[\u0600-\u06FF]/.test(userMessage);
  
  // Check if this is lead generation intent
  // const isLeadGeneration = await detectLeadGenerationIntent(userMessage, ai);
  
let response: string;

if (!intentVectors  || intentVectors.length === 0) {
  await buildIntentEmbeddings(ai);
}
console.log("Intent vectors ready:", intentVectors)
const result = await detectIntent(userMessage, ai, intentVectors);
console.log("userMessage", userMessage); ////
let lead = userId ? await leadService.getLead(userId) : null;
  
if (result.intent === "contact" && result.score > 0.8) {
  console.log("LEAD OMGGGG", userMessage);
  
  if (!lead) {
  await leadService.createOrUpdateLead(userId, { lead_step: 1 });
  lead = await leadService.getLead(userId);
  response = "Can you give me your name?"
  console.log(lead)
  console.log("lead step", lead.lead_step)
  }
 
}
 // Handle lead flow
 // 
else if (lead){
    if (lead.lead_step >= 1 && lead.lead_step <= 3) {
      // Save current user input
      switch (lead.lead_step) {
        case 1:
          const nameRegex = /^[a-zA-Z\s'-]+$/;
          if (!nameRegex.test(userMessage)) {
            response = 'Name contains invalid characters.';
          }else{
          await leadService.updateLead(userId, { name: userMessage, lead_step: 2 });
          response = "Thanks! Can I have your email?"
          }
          break;
        case 2:
          if (!userMessage.includes('@')) {
            response = 'Please provide a valid email address.';
          }else {
          await leadService.updateLead(userId, { email: userMessage, lead_step: 3 });
          response = "Great! Finally, your phone number?"
          }
          break;
        case 3:
          if (!/^\+?\d{7,15}$/.test(userMessage)) {
            response = 'Please provide a valid phone number.';
          }else{
            await leadService.updateLead(userId, { phone: userMessage, lead_step: 4 });
          // Optional: notify agent here
            response = "We'll have an agent contact you soon!"
          }
          break;
        case 4:
          response = "You're already in our system, we'll reach out shortly!";
          break;
      }
    }
  }
 else {
    // Regular RAG chat
    console.log("now we talking")
    const properties = await ragService.searchProperties(userMessage, extractFilters(userMessage));
    console.log("properties",properties)
    response = await generateChatResponse(userMessage, properties, history, ai, isArabic);
  }
  
  // Save to historys
  console.log("response", response)
  
  await chatHistory.saveMessage(sessionId || 'default', userMessage, response, userId);
  
  return c.json({ 
    response, 
    sessionId: sessionId || nanoid(),
    transcription: audioData ? userMessage : undefined 
  });
  } catch (err) {
    console.error('Chat handler error:', err);
    return c.json({ error: 'Internal server error', details: err.toString() }, 500);
  }

 
});


import intentData from "./intents.json";

export interface IntentVector {
  intent: string;
  example: string;
  embedding: number[];
}


async function buildIntentEmbeddings(ai: Ai) {
  console.log("Bob the intent builder")
  const allExamples = intentData.flatMap(i => i.examples);

const embeddingResp = await ai.run('@cf/baai/bge-small-en-v1.5', { text: allExamples });

// embeddingResp.data[i] corresponds to allExamples[i]
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
console.log("Built intent vectors:", intentVectors);    


  // const intentVectors: any[] = [];

  // for (const intent of intents) {
  //   for (const example of intent.examples) {
  //     const embedding = await ai.run("@cf/baai/bge-small-en-v1.5", {
  //       text: example
  //     });

  //     intentVectors.push({
  //       intent: intent.intent,
  //       text: example,
  //       embedding: embedding.data[0] // vector array
  //     });
  //   }
  // }

  // for (const intentObj of intents) {
  //   for (const example of intentObj.examples) {
  //     const embeddingResp = await ai.run('@cf/baai/bge-small-en-v1.5', { text: example });
  //     // embeddingResp.data is a 2D array (array of arrays), we take the first vector
  //     const vector = embeddingResp.data[0];
  //     intentVectors.push({
  //       intent: intentObj.intent,
  //       example,
  //       embedding: vector
  //     });
  //   }
  // }

  // console.log("Intent vectors built: babes i am done", intentVectors);
  // return intentVectors;
 
}
  // const resp = await ai.run("@cf/baai/bge-small-en-v1.5", {
  //   text: intents.map(e => e.examples)
  // });

  // return .map((ex, i) => ({
  //   intent: ex.intent,
  //   embedding: resp.data[i]
//   }));
// }

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
  // console.log("intent vectors",intentVectors)
  // console.log("User vector:", userVector)
  for (const example of intentVectors) {
    const score = cosineSimilarity(userVector, example.embedding);
    if (score > bestMatch.score) {
      bestMatch = { intent: example.intent, score };
    }
  }
  console.log("Intent detection result:", bestMatch);
  return bestMatch;
}


// async function detectLeadGenerationIntent(message: string, ai: Ai) {
//   const prompt = `
//     Analyze if the user message indicates interest in:
//     1. Contacting an agent
//     2. Scheduling a viewing
//     3. Getting more information about a property
//     4. Expressing serious buying/renting interest
//     5. Asking about the process
    
//     Message: "${message}"
    
//     Respond with JSON: {"isLeadGen": boolean, "intent": "contact|viewing|info|buying|process", "confidence": number}
//   `;
  
//   const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
//     messages: [{ role: 'user', content: prompt }],
//     max_tokens: 100
//   });
//   console.log('Lead gen detection result:', result);
//   try {
//     return JSON.parse(result.response);
//   } catch {
//     return { isLeadGen: false, intent: null, confidence: 0 };
//   }
// }




// In-memory storage for demo (just text & metadata)
let documents: { [id: string]: { filename: string; content: string } } = {};

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

    
    // Embed with Vectorize
//     const chunks = text.match(/.{1,1000}/g) || []; // split into ~1000-char pieces
// for (const chunk of chunks) {
//   const vector = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: chunk });
//   await c.env.VECTORIZE.upsert([
//     { id: crypto.randomUUID(), values: vector.data[0], metadata: { content: chunk } }
//   ]);
   const texts = text.map((property) =>
          `${property.title} (${property.available ? "Available" : "Not available"}) in ${property.location}, ${property.area_sqm} sqm, ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, ${property.price} QAR. ${property.description}`
        );

    let modelResp = await c.env.AI.run('@cf/baai/bge-m3', { text })
    // console.log("content vector", text)
    // // console.log("vector", vector[0])
    // console.log("vector data", vector.data[0])

   const vectors = text.map((property, i) => ({
    id: property.id.toString(),
    values: modelResp.data[i],
    metadata: {
      title: property.title,
      location: property.location,
      area: property.area_sqm,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      price: property.price,
      available: property.available,
      description: property.description?.substring(0, 500) || '',
    },
  }));
    let red = await c.env.VECTORIZE.upsert([
      { id: docId, values: vectors.data[0], metadata: { filename: file.name, content: text } }
    ])
    console.log('Vector upsert result:', red)
// 

    // Also store in memory for viewings
    documents[docId] = { filename: file.name, content: text }

    return c.json({ status: 'success', document_id: docId, filename: file.name })
  } catch (err) {
    return c.json({ error: `Upload failed: ${err.message}` }, 500)
  }
})

// --- List documents ---
app.get('/files', async (c) => {
  console.log('List files request received')
  const files = Object.entries(documents).map(([id, doc]) => ({
    id,
    filename: doc.filename
  }))
  return c.json(files)
})

// --- View document ---
app.get('/view/:id', (c) => {
  const id = c.req.param('id')
  const doc = documents[id]
  if (!doc) return c.json({ error: 'Not found' }, 404)
  return new Response(doc.content, {
    headers: { 'Content-Type': 'text/plain' }
  })
})

// --- Delete document ---
app.delete('/delete/:id', async (c) => {
  const id = c.req.param('id')
  if (!documents[id]) return c.json({ error: 'Not found' }, 404)

  await c.env.VECTORIZE.deleteByIds([id])
  delete documents[id]

  return c.json({ status: true, message: 'Deleted' })
})
import properties from './properties.json';

interface EmbeddingResponse {
  shape: number[];
  data: number[][];
}

// DON'T USE JUST TO LOAD THE DATA using invokerequest
app.post('/admin/import-properties', async (c) => {
  const ai = new Ai(c.env.AI);
  const vectorize = c.env.VECTORIZE;
  const db = c.env.real_estate_chatbot;

  const texts = properties.map((property) =>
          `${property.id} ${property.title} (${property.available ? "Available" : "Not available"}) in ${property.location}, ${property.area_sqm} sqm, ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, ${property.price} QAR. ${property.description}`
        );
  const modelResp: EmbeddingResponse = await ai.run(
          // "@cf/baai/bge-base-en-v1.5",
          "@cf/baai/bge-m3",
          { text: texts }
        );
   // Prepare vectors
  const vectors = properties.map((property, i) => ({
    id: property.id.toString(),
    values: modelResp.data[i],
    metadata: {
      id : property.id,
      title: property.title,
      location: property.location,
      area: property.area_sqm,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      price: property.price,
      available: property.available,
      description: property.description?.substring(0, 500) || '',
    },
  }));

  // Insert to Vectorize
  const vectorResult = await vectorize.upsert(vectors);

  // ALSO insert to D1 (this is what was missing!)
  const stmt = db.prepare(`
    INSERT INTO properties
    (id, title, price, area_sqm, bedrooms, bathrooms, location, agent_id, available, description)
    VALUES  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const dbBatch = properties.map(property => 
    stmt.bind(
      property.id.toString(),
      property.title,
      property.price,
      property.area_sqm,
      property.bedrooms,
      property.bathrooms,
      property.location,
      property.agent_id,
      property.available ? true : false,
      property.description|| '',
    )
  );

  await db.batch(dbBatch);

  return c.json({
    success: true,
    vectorize_inserted: vectorResult.count,
    db_inserted: properties.length
  });
})
  // Map embeddings back to properties (use property.id as vector ID)
        // const vectors: VectorizeVector[] = properties.map((property, i) => ({
        //   id: property.id.toString(),
        //   values: modelResp.data[i],
        //   metadata: {
        //     title: property.title,
        //     location: property.location,
        //     price: property.price,
        //     available: property.available,
        //   },
        // }));

        // // Upsert into Vectorize
        // const inserted = await vectorize.upsert(vectors);
        // return Response.json(inserted);

        

      // Convert the vector embeddings into a format Vectorize can accept.
      // Each vector needs an ID, a value (the vector) and optional metadata.
      // In a real application, your ID would be bound to the ID of the source
      // document.
  // let vectors: VectorizeVector[] = [];
  // let id = 1;
  // data.data.forEach((vector) => {
  //   vectors.push({ id: `${id}`, values: vector });
  //   id++;
  // });

  // let inserted = await vectorize.upsert(vectors);


  // let imported = 0;
  // for (const property of properties) {
  // const text = `${property.title} (${property.available ? 'Available' : 'Not available'}) in ${property.location}, ${property.area_sqm} sqm, ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, ${property.price} QAR. ${property.description}`;
  //   //const text = `${property.title} in ${property.location}, ${property.area_sqm} sqm, ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, ${property.price} QAR. ${property.description}`;
  //   const data  = await ai.run('@cf/baai/bge-base-en-v1.5', { text });
  //   console.log(`Inserting property ID ${property.id} ${data}`);
  //   let vectors: VectorizeVector[] = [];
  //   let id = 1;
  //   data.data.forEach((vector) => {
  //       vectors.push({ id: `${id}`, values: vector });
  //       id++;
  //   });
  //   await vectorize.upsert(vectors);
  // }


  //   await vectorize.insert({
  //     id: property.id.toString(),
  //     values: data[0],
  //     metadata: property
  //   });
  //   imported++;
  // }

;

async function generateChatResponse(
  message: string,
  properties: any[],
  history: any[],
  ai: Ai,
  isArabic: boolean
) {
  const context = properties.map(p => 
    ` 'images/${p.id}.jpg' '/property/${p.id}-${p.location}'  ${p.title} https ${p.location} ${p.description} ${p.area} sqm • ${p.bedrooms} BR • ${p.bathrooms} Bath • ${p.size} sqm • ${p.price} QAR\n-  `
  ).join('\n\n');
  console.log('Context for LLM:', context);
  // let p = properties;
  // let context = properties 
  // console.log(`PROP ${JSON.stringify(properties, null, 2)}`);

  const historyContext = history.slice(-6).map(h => 
    `User: ${h.user_message}\nAssistant: ${h.assistant_message}`
  ).join('\n\n');
  
  const systemPrompt = `You are a helpful real estate assistant. Answer strictly on the property listings and conversation history.

${isArabic ? 'أجب باللغة العربية فقط.' : 'Answer in English.'}

Property Listings:
${JSON.stringify(context, null, 2)}

Conversation History:
${historyContext}

Rules:
- Be conversational and friendly
- Stay on topic to real estate if user divert ignore query completely don't address anything at all in the response about the query just redirect them back to real estate
- Use bullet points for property listings in same format as above with the image and link to price
- Honor numerical filters
IMPORTANT:
-if no property listing is relevent to user query, don't fabricate any property just say "I couldn't find any properties that match your criteria. Could you please provide more details or adjust your requirements?"
- Refrain from fabricating any information such as properties use only property listings provided in  your answer 
- exclude any * or **`;
//@cf/meta/llama-3.1-8b-instruct
console.log(systemPrompt)
  const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
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
  // Simple regex-based filter extraction
  const filters: any = {};
  
  const bedroomMatch = message.match(/(\d+)\s*(bedroom|br|bed|bhk)/i);
  if (bedroomMatch) filters.bedrooms = parseInt(bedroomMatch[1]);
  
  const bathroomMatch = message.match(/(\d+)\s*(bathroom|bath)/i);
  if (bathroomMatch) filters.bathrooms = parseInt(bathroomMatch[1]);
  
  const priceMatch = message.match(/under\s*(\d+)|below\s*(\d+)|max\s*(\d+)/i);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]);
  }
  
  const minPriceMatch = message.match(/above\s*(\d+)|over\s*(\d+)|min\s*(\d+)/i);
  if (minPriceMatch) {
    filters.minPrice = parseInt(minPriceMatch[1] || minPriceMatch[2] || minPriceMatch[3]);
  }
  console.log("Extracted filters:", filters)
  return filters;
}

export default app;

