import { Ai } from '@cloudflare/ai';

export interface Property {
  id: string;
  title: string;
  location: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  available: boolean;
  description?: string;
  features?: string[];
  images?: string[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const ai = new Ai(env.AI);
    
    try {
      // Get properties from request body
      const properties: Property[] = await request.json();
      console.log(`Processing ${properties.length} properties`);

      const embeddings = [];
      const dbInserts = [];
      
      for (const property of properties) {
        // Create rich text for embedding
        const embeddingText = `
          ${property.title} ${property.available ? "(Available)" : "(Not Available)"} 
          in ${property.location}, ${property.area_sqm} sqm, ${property.bedrooms} bedrooms, 
          ${property.bathrooms} bathrooms, ${property.price} QAR.
          Description: ${property.description || 'No description'}
          Features: ${property.features?.join(', ') || 'No special features'}
        `.trim();
        
        console.log(`Processing property ${property.id}: ${property.title}`);
        
        // Generate embedding using BGE
        const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', {
          text: [embeddingText]
        });
        
        embeddings.push({
          id: property.id.toString(),
          values: data[0],
          metadata: {
            title: property.title,
            location: property.location,
            area: property.area_sqm,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            price: property.price,
            available: property.available,
            description: property.description?.substring(0, 500) || ''
          }
        });
        
        // Prepare for D1 insert
        dbInserts.push({
          id: property.id.toString(),
          title: property.title,
          location: property.location,
          area_sqm: property.area_sqm,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          price: property.price,
          available: property.available,
          description: property.description || '',
          metadata: JSON.stringify(property)
        });
      }
      
      console.log(`Generated ${embeddings.length} embeddings`);
      
      // Batch insert to Vectorize
      const vectorResult = await env.VECTORIZE.upsert(embeddings);
      console.log(`Vectorize result:`, vectorResult);
      
      // Batch insert to D1
      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO properties 
        (id, title, location, area_sqm, bedrooms, bathrooms, price, available, description, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const dbBatch = dbInserts.map(p => 
        stmt.bind(
          p.id, p.title, p.location, p.area_sqm, p.bedrooms, 
          p.bathrooms, p.price, p.available ? 1 : 0, p.description, p.metadata
        )
      );
      
      await env.DB.batch(dbBatch);
      console.log(`Inserted ${dbInserts.length} records to D1`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Successfully ingested ${properties.length} properties`,
        vectorize_count: vectorResult.count || embeddings.length,
        database_count: dbInserts.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Ingest error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
// import { Ai } from '@cloudflare/ai';

// export interface Property {
//   id: string;
//   area: string;
//   bedrooms: number;
//   bathrooms: number;
//   size: number;
//   price: number;
//   description: string;
//   features?: string[];
//   images?: string[];
// }

// export default {
//   async fetch(request: Request, env: Env): Promise<Response> {
//     const ai = new Ai(env.AI);
    
//     // Assuming properties.json is uploaded
//     const properties: Property[] = await request.json();
    
//     const embeddings = [];
//     const dbInserts = [];
    
//     for (const property of properties) {
//       // Create rich text for embedding
//       const embeddingText = `
//         ${property.area} property with ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms.
//         Size: ${property.size} sqm. Price: ${property.price} QAR.
//         Description: ${property.description}
//         Features: ${property.features?.join(', ') || ''}
//       `.trim();
      
//       // Generate embedding using BGE-M3
//       const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', {
//         text: embeddingText
//       });
      
//       embeddings.push({
//         id: property.id,
//         values: data[0],
//         metadata: {
//           area: property.area,
//           bedrooms: property.bedrooms,
//           bathrooms: property.bathrooms,
//           price: property.price,
//           size: property.size,
//           description: property.description.substring(0, 500)
//         }
//       });
      
//       // Prepare for D1 insert
//       dbInserts.push({
//         id: property.id,
//         area: property.area,
//         bedrooms: property.bedrooms,
//         bathrooms: property.bathrooms,
//         size: property.size,
//         price: property.price,
//         description: property.description,
//         metadata: JSON.stringify(property)
//       });
//     }
    
//     // Batch insert to Vectorize
//     await env.VECTORIZE.upsert(embeddings);
    
//     // Batch insert to D1
//     const stmt = env.real_estate_chatbot.prepare(`
//       INSERT OR REPLACE INTO properties 
//       (id, area, bedrooms, bathrooms, size, price, description, metadata)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//     `);
    
//     await env.real_estate_chatbot.batch(dbInserts.map(p => 
//       stmt.bind(p.id, p.area, p.bedrooms, p.bathrooms, p.size, p.price, p.description, p.metadata)
//     ));
    
//     return new Response(`Ingested ${properties.length} properties`);
//   }
// };