import { handle } from "@/lib/api";
import { getBlocks, listCompanies, listInvestors, listStakeholders } from "@/lib/config/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const [blocks, companies, investors, stakeholders] = await Promise.all([
    getBlocks(),
    listCompanies(),
    listInvestors(),
    listStakeholders(),
  ]);
  return Response.json({
    ...blocks,
    companies,
    investors,
    stakeholders,
    counts: {
      portfolio: companies.filter((c) => c.tag === "Portfolio").length,
      on_radar: companies.filter((c) => c.tag === "On Radar").length,
      investors: investors.length,
      stakeholders: stakeholders.length,
    },
  });
});
