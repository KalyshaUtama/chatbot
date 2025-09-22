
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


async sendLeadEmail(lead: Lead) {
  const RESEND_API_KEY = "re_VQeBnaPy_BPM5KFWSf5HJE2dqCRLVaPGG"; // Wrangler injects secrets automatically

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev", // temporary sender for testing
      to: "disbeliyves@gmail.com",   // recipient email
      subject: `New Lead: ${lead.name || "Unknown"}`,
      html: `
        <h2>New Lead Captured</h2>
        <p><strong>Name:</strong> ${lead.name}</p>
        <p><strong>Email:</strong> ${lead.email}</p>
        <p><strong>Phone:</strong> ${lead.phone}</p>
        <p><strong>Status:</strong> ${lead.lead_status}</p>
        <p><strong>Interested Properties:</strong></p>
        <ul>
          ${lead.interested_properties.map(p => `<li>${p}</li>`).join("")}
        </ul>
        <p><em>Created at:</em> ${lead.created_at}</p>
      `,
    }),
  });

  if (!res.ok) {
    console.error("Failed to send lead email:", await res.text());
  } else {
    console.log("Lead email sent successfully!");
  }
}

  //redsend requires a domain
  // async sendLeadEmail(lead: Lead) {
  //   const body = {
  //     from: "lastshrimphead@gmail.com",
  //     to: "kalyshasachiutama@gmail.com", // where the leads go
  //     subject: `New Lead: ${lead.name || "Unknown"}`,
  //     html: `
  //       <h2>New Lead Captured</h2>
  //       <p><strong>Name:</strong> ${lead.name}</p>
  //       <p><strong>Email:</strong> ${lead.email}</p>
  //       <p><strong>Phone:</strong> ${lead.phone}</p>
  //       <p><strong>Status:</strong> ${lead.lead_status}</p>
  //       <p><strong>Interested Properties:</strong></p>
  //       <ul>
  //         ${lead.interested_properties.map(p => `<li>${p}</li>`).join("")}
  //       </ul>
  //       <p><em>Created at:</em> ${lead.created_at}</p>
  //     `,
  //   };
  //   const RESEND_API_KEY = "re_VQeBnaPy_BPM5KFWSf5HJE2dqCRLVaPGG"
  //   const res = await fetch("https://api.resend.com/emails", {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${RESEND_API_KEY}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(body),
  //   });

  //   if (!res.ok) {
  //     console.error("Failed to send lead email", await res.text());
  //   }
  // }




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