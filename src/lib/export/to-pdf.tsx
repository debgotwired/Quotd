import { marked, type Token, type Tokens } from "marked";
import ReactPDF, {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

interface ExportMeta {
  company: string;
  product: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingLeft: 60,
    paddingRight: 60,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  h1: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  h3: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 10,
    fontSize: 11,
    lineHeight: 1.6,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  italic: {
    fontFamily: "Helvetica-Oblique",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#f4f4f5",
    padding: "1 4",
  },
  codeBlock: {
    fontFamily: "Courier",
    fontSize: 9,
    backgroundColor: "#f4f4f5",
    padding: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#d4d4d8",
    paddingLeft: 12,
    marginBottom: 10,
    marginLeft: 0,
  },
  blockquoteText: {
    fontFamily: "Helvetica-Oblique",
    color: "#52525b",
    fontSize: 11,
  },
  listItem: {
    flexDirection: "row" as const,
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 16,
    fontSize: 11,
  },
  listContent: {
    flex: 1,
    fontSize: 11,
  },
  tableRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  tableHeaderRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#f4f4f5",
  },
  tableCell: {
    flex: 1,
    padding: "6 8",
    fontSize: 10,
  },
  tableCellHeader: {
    flex: 1,
    padding: "6 8",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginTop: 16,
    marginBottom: 16,
  },
  companyHeader: {
    fontSize: 9,
    color: "#a1a1aa",
    marginBottom: 24,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
});

export async function toPdf(
  markdown: string,
  meta: ExportMeta
): Promise<Buffer> {
  const tokens = marked.lexer(markdown);
  const elements = tokensToElements(tokens);

  const doc = (
    <Document title={`${meta.company} Case Study`} author="Quotd">
      <Page size="A4" style={styles.page}>
        <Text style={styles.companyHeader}>{meta.company} — Case Study</Text>
        {elements}
      </Page>
    </Document>
  );

  const stream = await ReactPDF.renderToStream(doc);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function tokensToElements(tokens: Token[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const key = `t-${i}`;

    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        const style =
          t.depth === 1 ? styles.h1 : t.depth === 2 ? styles.h2 : styles.h3;
        elements.push(
          <Text key={key} style={style}>
            {inlineToTextNodes(t.tokens)}
          </Text>
        );
        break;
      }

      case "paragraph": {
        const t = token as Tokens.Paragraph;
        elements.push(
          <Text key={key} style={styles.paragraph}>
            {inlineToTextNodes(t.tokens)}
          </Text>
        );
        break;
      }

      case "list": {
        const t = token as Tokens.List;
        elements.push(
          <View key={key}>
            {t.items.map((item, j) => {
              const inlineTokens = item.tokens.flatMap((sub) => {
                if (sub.type === "text" && "tokens" in sub && sub.tokens) {
                  return sub.tokens;
                }
                return [sub];
              });
              return (
                <View key={`li-${j}`} style={styles.listItem}>
                  <Text style={styles.bullet}>
                    {t.ordered ? `${j + 1}.` : "•"}
                  </Text>
                  <Text style={styles.listContent}>
                    {inlineToTextNodes(inlineTokens)}
                  </Text>
                </View>
              );
            })}
          </View>
        );
        break;
      }

      case "blockquote": {
        const t = token as Tokens.Blockquote;
        elements.push(
          <View key={key} style={styles.blockquote}>
            {t.tokens
              .filter((sub) => sub.type === "paragraph")
              .map((sub, j) => (
                <Text key={`bq-${j}`} style={styles.blockquoteText}>
                  {inlineToTextNodes((sub as Tokens.Paragraph).tokens)}
                </Text>
              ))}
          </View>
        );
        break;
      }

      case "table": {
        const t = token as Tokens.Table;
        elements.push(
          <View key={key}>
            <View style={styles.tableHeaderRow}>
              {t.header.map((cell, j) => (
                <Text key={`th-${j}`} style={styles.tableCellHeader}>
                  {inlineToTextNodes(cell.tokens)}
                </Text>
              ))}
            </View>
            {t.rows.map((row, ri) => (
              <View key={`tr-${ri}`} style={styles.tableRow}>
                {row.map((cell, ci) => (
                  <Text key={`td-${ci}`} style={styles.tableCell}>
                    {inlineToTextNodes(cell.tokens)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
        break;
      }

      case "code": {
        const t = token as Tokens.Code;
        elements.push(
          <Text key={key} style={styles.codeBlock}>
            {t.text}
          </Text>
        );
        break;
      }

      case "hr": {
        elements.push(<View key={key} style={styles.hr} />);
        break;
      }

      case "space":
        break;

      default:
        if ("text" in token && typeof token.text === "string") {
          elements.push(
            <Text key={key} style={styles.paragraph}>
              {token.text}
            </Text>
          );
        }
    }
  }

  return elements;
}

function inlineToTextNodes(
  tokens: Token[] | undefined
): React.ReactNode[] {
  if (!tokens) return [];

  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const key = `i-${i}`;

    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if ("tokens" in t && t.tokens) {
          nodes.push(...inlineToTextNodes(t.tokens));
        } else {
          nodes.push(t.text);
        }
        break;
      }
      case "strong": {
        const t = token as Tokens.Strong;
        nodes.push(
          <Text key={key} style={styles.bold}>
            {inlineToTextNodes(t.tokens)}
          </Text>
        );
        break;
      }
      case "em": {
        const t = token as Tokens.Em;
        nodes.push(
          <Text key={key} style={styles.italic}>
            {inlineToTextNodes(t.tokens)}
          </Text>
        );
        break;
      }
      case "codespan": {
        const t = token as Tokens.Codespan;
        nodes.push(
          <Text key={key} style={styles.code}>
            {t.text}
          </Text>
        );
        break;
      }
      case "link": {
        const t = token as Tokens.Link;
        nodes.push(
          <Text key={key} style={{ color: "#2563eb" }}>
            {t.text}
          </Text>
        );
        break;
      }
      case "br":
        nodes.push("\n");
        break;
      default:
        if ("text" in token && typeof token.text === "string") {
          nodes.push(token.text);
        }
    }
  }

  return nodes;
}
