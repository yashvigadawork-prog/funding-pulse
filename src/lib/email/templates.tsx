import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
/** Mail apps cannot load web fonts reliably, so the headline falls back to Georgia, which sits close to the app's serif. */
const serif = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const INK = "#14161C";
const MUTED = "#6B7080";

export interface DigestEmailProps {
  orgName: string;
  orgDescriptor: string;
  weekLabel: string;
  kpiLine: string;
  /** One sentence that sums up the week, from the saved analysis. */
  weekLine?: string;
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
      <Body style={{ backgroundColor: "#F6F5F1", fontFamily: font, margin: 0, padding: "16px 0" }}>
        <Container style={{ maxWidth: 560, backgroundColor: "#ffffff", borderRadius: 16, padding: "28px 22px", margin: "0 auto" }}>
          <Text style={{ fontSize: 13, color: "#6B7080", margin: 0 }}>{p.orgName} · {p.orgDescriptor}</Text>
          <Heading as="h1" style={{ fontFamily: serif, fontWeight: 400, fontSize: 30, lineHeight: "34px", margin: "6px 0 4px", color: INK }}>
            {p.weekLine ?? "Funding Pulse"}
          </Heading>
          <Text style={{ fontSize: 14, color: MUTED, margin: "0 0 14px" }}>Funding Pulse · {p.weekLabel}</Text>
          <Text style={{ fontSize: 15, color: "#14161C", backgroundColor: "#EEF0FD", borderRadius: 8, padding: "10px 12px", margin: "0 0 18px" }}>{p.kpiLine}</Text>
          {p.note ? <Text style={{ fontSize: 13, color: "#8a5a00", margin: "0 0 14px" }}>{p.note}</Text> : null}
          <Heading as="h2" style={{ fontSize: 16, margin: "0 0 8px", color: "#14161C" }}>
            Top highlights
          </Heading>
          {p.highlights.length ? (
            p.highlights.map((h) => (
              <Section key={h.rank} style={{ borderTop: "1px solid #E6E3DC", padding: "10px 0" }}>
                <Text style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#14161C" }}>
                  {h.rank}. {h.company}
                </Text>
                <Text style={{ fontSize: 13, color: "#6B7080", margin: "2px 0" }}>{h.detail}</Text>
                <Text style={{ fontSize: 14, color: "#14161C", margin: "2px 0" }}>{h.why}</Text>
                {h.url ? (
                  <Text style={{ fontSize: 13, margin: "2px 0 0" }}>
                    <Link href={h.url} style={{ color: "#3B4BDB" }}>
                      Source: {h.outlet ?? "link"}
                    </Link>
                  </Text>
                ) : null}
              </Section>
            ))
          ) : (
            <Text style={{ fontSize: 14, color: "#6B7080" }}>No highlights were found this week.</Text>
          )}
          <Section style={{ textAlign: "center", margin: "20px 0 6px" }}>
            <Button href={p.dashboardUrl} style={{ backgroundColor: "#3B4BDB", color: "#ffffff", borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
              Open the dashboard
            </Button>
          </Section>
          <Hr style={{ borderColor: "#E6E3DC", margin: "18px 0 10px" }} />
          <Text style={{ fontSize: 12, color: "#6B7080", margin: 0 }}>
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
            <Text key={i} style={{ fontSize: 15, lineHeight: "22px", color: "#14161C", margin: line.trim() ? "0" : "10px 0" }}>
              {line.split(URL_SPLIT).map((part, j) =>
                /^https?:\/\//.test(part) ? (
                  <Link key={j} href={part} style={{ color: "#3B4BDB" }}>
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
