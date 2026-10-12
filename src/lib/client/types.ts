import type {
  CompanyJson,
  DigestSettings,
  FundProfile,
  InvestorJson,
  Mandate,
  SearchChain,
  SenderProfile,
  Sources,
  StakeholderJson,
  Taxonomy,
} from "@/lib/config/schema";

export interface ConfigResponse {
  fund_profile: FundProfile;
  mandate: Mandate;
  taxonomy: Taxonomy;
  sender_profile: SenderProfile;
  digest_settings: DigestSettings;
  sources: Sources;
  search_chain: SearchChain;
  companies: CompanyJson[];
  investors: (InvestorJson & { id: number })[];
  stakeholders: (StakeholderJson & { id: number })[];
  counts: { portfolio: number; on_radar: number; investors: number; stakeholders: number };
}
