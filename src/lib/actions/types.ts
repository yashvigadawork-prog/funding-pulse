export interface Draft {
  subject: string;
  body: string;
}

export interface FounderLead {
  company: string;
  companyId: string | null;
  domain: string | null;
  tag: "Portfolio" | "On Radar" | null;
  why: string;
  founder: string | null;
  founderSource: string | null;
  linkedinUrl: string | null;
  linkedinSource: string | null;
  email: string | null;
  emailSource: string | null;
  found: { founder: boolean; linkedin: boolean; email: boolean };
  dealId: number | null;
  sources: { url: string; outlet: string | null }[];
  emailDraft: Draft;
  linkedinDraft: string;
}

export interface FollowUp {
  companyId: string;
  company: string;
  domain: string | null;
  reason: "named" | "adjacent" | "cluster";
  headline: string;
  stakeholder: { name: string; role: string; email: string; type: string; demo: boolean } | null;
  draft: Draft;
  sources: { url: string; outlet: string | null }[];
}

export interface LpBrief {
  draft: Draft;
  keyPoints: { text: string; url: string | null }[];
  reportPath: string;
}

export interface ActionsBlock {
  founderOutreach: FounderLead[];
  portfolioFollowUp: FollowUp[];
  lpBrief: LpBrief | null;
  generatedAt: string;
}
