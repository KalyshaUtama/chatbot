import { Ai } from '@cloudflare/ai';

export class RAGService {
  constructor(
    private ai: Ai,
    private vectorize: VectorizeIndex,
    private db: D1Database
  ) {}
  
  async searchProperties(query: string, filters?: PropertyFilters): Promise<Property[]> {
    // Generate embedding for query
    const { data } = await this.ai.run('@cf/baai/bge-m3', {
      text: query
    });
    
    // Vector search
    const vectorResults = await this.vectorize.query(data[0], {
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
  
  private hasNumericFilters(filters: PropertyFilters): boolean {
    return !!(filters.minPrice || filters.maxPrice || filters.bedrooms || filters.bathrooms);
  }
  
  private async searchByFilters(filters: PropertyFilters) {
    let query = "SELECT * FROM properties WHERE 1=1";
    const params: any[] = [];
    
    if (filters.minPrice) {
      query += " AND price >= ?";
      params.push(filters.minPrice);
    }
    if (filters.maxPrice) {
      query += " AND price <= ?";
      params.push(filters.maxPrice);
    }
    if (filters.bedrooms) {
      query += " AND bedrooms = ?";
      params.push(filters.bedrooms);
    }
    if (filters.bathrooms) {
      query += " AND bathrooms = ?";
      params.push(filters.bathrooms);
    }
    if (filters.area) {
      query += " AND area LIKE ?";
      params.push(`%${filters.area}%`);
    }
    
    query += " LIMIT 20";
    
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results;
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