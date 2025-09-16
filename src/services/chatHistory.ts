export class ChatHistoryService {
  constructor(private db: D1Database) {}
  
  async saveMessage(
    sessionId: string, 
    userMessage: string, 
    assistantMessage: string,
    userId?: string
  ) {
    await this.db
      .prepare(`
        INSERT INTO chat_history (session_id, user_message, assistant_message, user_id)
        VALUES (?, ?, ?, ?)
      `)
      .bind(sessionId, userMessage, assistantMessage, userId)
      .run();
  }
  
  async getHistory(sessionId: string, limit: number = 10) {
    const result = await this.db
      .prepare(`
        SELECT user_message, assistant_message, timestamp 
        FROM chat_history 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      .bind(sessionId, limit)
      .all();
    
    return result.results.reverse(); // Chronological order
  }
  
  async getRecentMessagesForLead(sessionId: string, count: number = 5) {
    const result = await this.db
      .prepare(`
        SELECT user_message, assistant_message, timestamp 
        FROM chat_history 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      .bind(sessionId, count)
      .all();
    
    return result.results;
  }
}