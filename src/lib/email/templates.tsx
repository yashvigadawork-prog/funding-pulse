import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface DigestEmailProps {
  orgName: string;
  orgDescriptor: string;
  weekLabel: string;
  kpiLine: string;
  highlights: { rank: number; company: string; detail: string; why: string; url: string | null; outlet: string | null }[];
  dashboardUrl: string;
  note?: string;
}

/** Single column, phone friendly: top highlights, one KPI line, one button. */
export function DigestEmail(p: DigestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${p.orgName} funding pulse, ${p.weekLabel}: ${p.kpiLine}`}</Preview>
      <Body style={{ backgroundColor: "#f4f5fa", fontFamily: font, margin: 0, padding: "16px 0" }}>
        <Container style={{ maxWidth: 560, backgroundColor: "#ffffff", borderRadius: 12, padding: "24px 20px", margin: "0 auto" }}>
          <Text style={{ fontSize: 13, color: "#5b6073", margin: 0 }}>{p.orgName} · {p.orgDescriptor}</Text>
          <Heading as="h1" style={{ fontSize: 22, margin: "6px 0 4px", color: "#161a2b" }}>
            Funding Pulse
          </Heading>
          <Text style={{ fontSize: 14, color: "#5b6073", margin: "0 0 14px" }}>{p.weekLabel}</Text>
          <Text style={{ fontSize: 15, color: "#161a2b", backgroundColor: "#eef0fb", borderRadius: 8, padding: "10px 12px", margin: "0 0 18px" }}>{p.kpiLine}</Text>
          {p.note ? <Text style={{ fontSize: 13, color: "#8a5a00", margin: "0 0 14px" }}>{p.note}</Text> : null}
          <Heading as="h2" style={{ fontSize: 16, margin: "0 0 8px", color: "#161a2b" }}>
            Top highlights
          </Heading>
          {p.highlights.length ? (
            p.highlights.map((h) => (
              <Section key={h.rank} style={{ borderTop: "1px solid #e6e8f2", padding: "10px 0" }}>
                <Text style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#161a2b" }}>
                  {h.rank}. {h.company}
                </Text>
                <Text style={{ fontSize: 13, color: "#5b6073", margin: "2px 0" }}>{h.detail}</Text>
                <Text style={{ fontSize: 14, color: "#161a2b", margin: "2px 0" }}>{h.why}</Text>
                {h.url ? (
                  <Text style={{ fontSize: 13, margin: "2px 0 0" }}>
                    <Link href={h.url} style={{ color: "#3b4bbd" }}>
                      Source: {h.outlet ?? "link"}
                    </Link>
                  </Text>
                ) : null}
              </Section>
            ))
          ) : (
            <Text style={{ fontSize: 14, color: "#5b6073" }}>No highlights were found this week.</Text>
          )}
          <Section style={{ textAlign: "center", margin: "20px 0 6px" }}>
            <Button href={p.dashboardUrl} style={{ backgroundColor: "#3b4bbd", color: "#ffffff", borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
              Open the dashboard
            </Button>
          </Section>
          <Hr style={{ borderColor: "#e6e8f2", margin: "18px 0 10px" }} />
          <Text style={{ fontSize: 12, color: "#7a7f93", margin: 0 }}>
            Numbers are computed from stored deals; every highlight links to its source. Amounts that were not disclosed are never added up.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const URL_SPLIT = /(https?:\/\/[^\s)]+)/g;

/** A plain message (drafts from the Compose drawer) with web addresses turned into links. */
export function MessageEmail({ body, preview }: { body: string; preview?: string }) {
  const lines = body.split("\n");
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview ?? lines[0] ?? ""}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: font, margin: 0, padding: "12px" }}>
        <Container style={{ maxWidth: 560 }}>
          {lines.map((line, i) => (
            <Text key={i} style={{ fontSize: 15, lineHeight: "22px", color: "#161a2b", margin: line.trim() ? "0" : "10px 0" }}>
              {line.split(URL_SPLIT).map((part, j) =>
                /^https?:\/\//.test(part) ? (
                  <Link key={j} href={part} style={{ color: "#3b4bbd" }}>
                    {part}
                  </Link>
                ) : (
                  <React.Fragment key={j}>{part}</React.Fragment>
                ),
              )}
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
}
