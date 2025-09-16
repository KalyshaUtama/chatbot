export interface Lead {
  id: number;
  user_id: string;
  name?: string;
  phone?: string;
  email?: string;
  interested_properties: string[];
  lead_status: 'new' | 'contacted' | 'qualified' | 'converted';
  lead_step: number; //0=not interrested 1 = name, 2 = email, 3 = phone, 4 = done
  created_at?: string;
  updated_at?: string;
}

export class LeadService {
  constructor(private db: D1Database) {}

  async createOrUpdateLead(userId: string, leadData: Partial<Lead>) {
    const existing = await this.getLead(userId);

    if (existing) {
      return await this.updateLead(userId, leadData);
    } else {
      return await this.createLead(userId, leadData);
    }
  }

  async createLead(userId: string, leadData: Partial<Lead>) {
    await this.db
      .prepare(
        `
        INSERT INTO leads (
          user_id, name, phone, email, 
          interested_properties, lead_status, lead_step, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'new', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        userId,
        leadData.name || null,
        leadData.phone || null,
        leadData.email || null,
        JSON.stringify(leadData.interested_properties || []),
        leadData.lead_step ?? 1
      )
      .run();

    return await this.getLead(userId);
  }

  async updateLead(userId: string, leadData: Partial<Lead>) {
    const updates: string[] = [];
    const params: any[] = [];

    if (leadData.name) {
      updates.push("name = ?");
      params.push(leadData.name);
    }
    if (leadData.phone) {
      updates.push("phone = ?");
      params.push(leadData.phone);
    }
    if (leadData.email) {
      updates.push("email = ?");
      params.push(leadData.email);
    }
    if (leadData.interested_properties) {
      updates.push("interested_properties = ?");
      params.push(JSON.stringify(leadData.interested_properties));
    }
    if (leadData.lead_status) {
      updates.push("lead_status = ?");
      params.push(leadData.lead_status);
    }
    if (typeof leadData.lead_step === "number") {
      updates.push("lead_step = ?");
      params.push(leadData.lead_step);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(userId);

    await this.db
      .prepare(`UPDATE leads SET ${updates.join(", ")} WHERE user_id = ?`)
      .bind(...params)
      .run();

    return await this.getLead(userId);
  }

  async getLead(userId: string) {
    const result = await this.db
      .prepare("SELECT * FROM leads WHERE user_id = ?")
      .bind(userId)
      .first();

    if (result) {
      return {
        ...result,
        interested_properties: JSON.parse(result.interested_properties || "[]"),
        lead_step: result.lead_step ?? 1,
      } as Lead;
    }
    return null;
  }
}


// export class LeadService {
//   constructor(private db: D1Database) {}
  
//   async createOrUpdateLead(userId: string, leadData: Partial<Lead>) {
//     const existing = await this.getLead(userId);
    
//     if (existing) {
//       return await this.updateLead(userId, leadData);
//     } else {
//       return await this.createLead(userId, leadData);
//     }
//   }
  
//   private async createLead(userId: string, leadData: Partial<Lead>) {
//     await this.db
//       .prepare(`
//         INSERT INTO leads (user_id, name, phone, email, interested_properties, lead_status)
//         VALUES (?, ?, ?, ?, ?, 'new')
//       `)
//       .bind(
//         userId,
//         leadData.name || null,
//         leadData.phone || null,
//         leadData.email || null,
//         JSON.stringify(leadData.interested_properties || [])
//       )
//       .run();
    
//     return await this.getLead(userId);
//   }
  
//   private async updateLead(userId: string, leadData: Partial<Lead>) {
//     const updates: string[] = [];
//     const params: any[] = [];
    
//     if (leadData.name) {
//       updates.push('name = ?');
//       params.push(leadData.name);
//     }
//     if (leadData.phone) {
//       updates.push('phone = ?');
//       params.push(leadData.phone);
//     }
//     if (leadData.email) {
//       updates.push('email = ?');
//       params.push(leadData.email);
//     }
//     if (leadData.interested_properties) {
//       updates.push('interested_properties = ?');
//       params.push(JSON.stringify(leadData.interested_properties));
//     }
    
//     updates.push('updated_at = CURRENT_TIMESTAMP');
//     params.push(userId);
    
//     await this.db
//       .prepare(`UPDATE leads SET ${updates.join(', ')} WHERE user_id = ?`)
//       .bind(...params)
//       .run();
    
//     return await this.getLead(userId);
//   }
  
//   async getLead(userId: string) {
//     const result = await this.db
//       .prepare('SELECT * FROM leads WHERE user_id = ?')
//       .bind(userId)
//       .first();
    
//     if (result) {
//       return {
//         ...result,
//         interested_properties: JSON.parse(result.interested_properties || '[]')
//       };
//     }
//     return null;
//   }
// }

// export interface Lead {
//   id: number;
//   user_id: string;
//   name?: string;
//   phone?: string;
//   email?: string;
//   interested_properties: string[];
//   lead_status: 'new' | 'contacted' | 'qualified' | 'converted';
// }