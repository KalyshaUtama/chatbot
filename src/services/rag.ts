import { Ai } from '@cloudflare/ai';

export class RAGService {
  constructor(
    private ai: Ai,
    private vectorize: VectorizeIndex,
    private db: D1Database
  ) {}
  
  async searchDocs(query: string, filters?: PropertyFilters): Promise<Property[]> {
    // Generate embedding for query
    // console.log('Generating embedding for query:', query);
    // Use a multilingual model for Arabic embeddings @cf/baai/bge-m3
    const embedding = await this.ai.run('@cf/baai/bge-m3', 
      {text: [query]}
    )
    console.log('Generated embedding:', embedding);
    // Handle possible timeout or errors
    if (!embedding || !embedding.data || !embedding.data[0]) {
      throw new Error('Failed to generate embedding. Please check model availability and try again.');
    }
    console.log('Generated embedding:');
    // Vector search
    const vectorResults = await this.vectorize.query(embedding.data[0], {
      topK: 5,
      returnMetadata: true,
      filter: this.buildVectorFilter(filters)
    });

    console.log('Vector search results:', vectorResults);
    
    // If we have specific filters, also do SQL search
    // if (filters && this.hasNumericFilters(filters)) {
    //   const sqlResults = await this.searchByFilters(filters);
    //   // Merge and deduplicate results
    //   return this.mergeResults(vectorResults, sqlResults);
    // }
    
    return vectorResults.matches.map(match => ({
      ...match.metadata,
      score: match.score
    }));
  }
  
  private buildVectorFilter(filters?: PropertyFilters) {
    if (!filters) return undefined;
    
    const vectorFilter: any = {};
    if (filters.area) vectorFilter.area = filters.area;
    return vectorFilter;
  }
  
  
  private mergeResults(vectorResults: any, sqlResults: any[]): Property[] {
    // Implementation to merge and deduplicate
    const merged = new Map();
    
    // Add vector results
    vectorResults.matches.forEach((match: any) => {
      merged.set(match.id || match.metadata.id, {
        ...match.metadata,
        score: match.score,
        source: 'vector'
      });
    });
    
    // Add SQL results (higher priority for exact matches)
    sqlResults.forEach((property: any) => {
      if (merged.has(property.id)) {
        merged.get(property.id).source = 'both';
      } else {
        merged.set(property.id, {
          ...property,
          metadata: JSON.parse(property.metadata),
          score: 0.9, // High score for exact filter matches
          source: 'sql'
        });
      }
    });
    
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}

export interface PropertyFilters {
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
}