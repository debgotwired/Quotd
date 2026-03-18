import { marked, type Token, type Tokens } from "marked";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  type IParagraphOptions,
  type IRunOptions,
} from "docx";

interface ExportMeta {
  company: string;
  product: string;
}

export async function toDocx(
  markdown: string,
  meta: ExportMeta
): Promise<Buffer> {
  const tokens = marked.lexer(markdown);
  const children = tokensToDocx(tokens);

  const doc = new Document({
    title: `${meta.company} Case Study`,
    creator: "Quotd",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 }, // 11pt
          paragraph: { spacing: { line: 360 } }, // 1.5 line spacing
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function tokensToDocx(tokens: Token[]): Paragraph[] {
  const elements: (Paragraph | Table)[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        const level =
          t.depth === 1
            ? HeadingLevel.HEADING_1
            : t.depth === 2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3;
        elements.push(
          new Paragraph({
            heading: level,
            children: inlineToRuns(t.tokens),
            spacing: {
              before: t.depth === 1 ? 0 : 240,
              after: 120,
            },
          })
        );
        break;
      }

      case "paragraph": {
        const t = token as Tokens.Paragraph;
        elements.push(
          new Paragraph({
            children: inlineToRuns(t.tokens),
            spacing: { after: 200 },
          })
        );
        break;
      }

      case "list": {
        const t = token as Tokens.List;
        for (let i = 0; i < t.items.length; i++) {
          const item = t.items[i];
          const inlineTokens = item.tokens.flatMap((sub) => {
            if (sub.type === "text" && "tokens" in sub && sub.tokens) {
              return sub.tokens;
            }
            return [sub];
          });
          const opts: IParagraphOptions = {
            children: inlineToRuns(inlineTokens),
            spacing: { after: 80 },
            ...(t.ordered
              ? { numbering: { reference: "default-numbering", level: 0 } }
              : { bullet: { level: 0 } }),
          };
          elements.push(new Paragraph(opts));
        }
        break;
      }

      case "blockquote": {
        const t = token as Tokens.Blockquote;
        for (const sub of t.tokens) {
          if (sub.type === "paragraph") {
            const p = sub as Tokens.Paragraph;
            elements.push(
              new Paragraph({
                children: inlineToRuns(p.tokens, {
                  italics: true,
                  color: "666666",
                }),
                spacing: { after: 120 },
                indent: { left: 360 },
                border: {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: "CCCCCC",
                    space: 8,
                  },
                },
              })
            );
          }
        }
        break;
      }

      case "table": {
        const t = token as Tokens.Table;
        const rows: TableRow[] = [];
        const colCount = t.header.length;
        // Page is 8.5" with 1" margins each side = 6.5" = 9360 twips
        const totalWidth = 9360;
        const colWidth = Math.floor(totalWidth / colCount);

        // Header row
        rows.push(
          new TableRow({
            tableHeader: true,
            children: t.header.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: inlineToRuns(cell.tokens),
                    }),
                  ],
                  width: { size: colWidth, type: WidthType.DXA },
                  shading: {
                    type: ShadingType.SOLID,
                    color: "F4F4F5",
                    fill: "F4F4F5",
                  },
                })
            ),
          })
        );

        // Body rows
        for (const row of t.rows) {
          rows.push(
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: inlineToRuns(cell.tokens),
                      }),
                    ],
                    width: { size: colWidth, type: WidthType.DXA },
                  })
              ),
            })
          );
        }

        elements.push(
          new Table({
            rows,
            width: { size: totalWidth, type: WidthType.DXA },
            columnWidths: Array(colCount).fill(colWidth),
          })
        );
        break;
      }

      case "hr": {
        elements.push(
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "CCCCCC",
                space: 8,
              },
            },
            spacing: { before: 240, after: 240 },
          })
        );
        break;
      }

      case "code": {
        const t = token as Tokens.Code;
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: t.text,
                font: "Courier New",
                size: 20,
              }),
            ],
            spacing: { before: 120, after: 120 },
            shading: {
              type: ShadingType.SOLID,
              color: "F4F4F5",
              fill: "F4F4F5",
            },
          })
        );
        break;
      }

      case "space":
        break;

      default:
        // Fallback: render as plain text
        if ("text" in token && typeof token.text === "string") {
          elements.push(
            new Paragraph({
              children: [new TextRun({ text: token.text })],
              spacing: { after: 200 },
            })
          );
        }
    }
  }

  return elements as Paragraph[];
}

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  color?: string;
}

function inlineToRuns(
  tokens: Token[] | undefined,
  inherited: InlineStyle = {}
): TextRun[] {
  if (!tokens) return [new TextRun({ text: "" })];

  const runs: TextRun[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if ("tokens" in t && t.tokens) {
          runs.push(...inlineToRuns(t.tokens, inherited));
        } else {
          runs.push(new TextRun({ text: t.text, ...inherited }));
        }
        break;
      }
      case "strong": {
        const t = token as Tokens.Strong;
        runs.push(
          ...inlineToRuns(t.tokens, { ...inherited, bold: true })
        );
        break;
      }
      case "em": {
        const t = token as Tokens.Em;
        runs.push(
          ...inlineToRuns(t.tokens, { ...inherited, italics: true })
        );
        break;
      }
      case "codespan": {
        const t = token as Tokens.Codespan;
        runs.push(
          new TextRun({
            text: t.text,
            font: "Courier New",
            size: 20,
            ...inherited,
            shading: {
              type: ShadingType.SOLID,
              color: "F4F4F5",
              fill: "F4F4F5",
            },
          })
        );
        break;
      }
      case "link": {
        const t = token as Tokens.Link;
        runs.push(
          new TextRun({
            text: t.text,
            color: "2563EB",
            underline: {},
            ...inherited,
          })
        );
        break;
      }
      case "br":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      default:
        if ("text" in token && typeof token.text === "string") {
          runs.push(new TextRun({ text: token.text, ...inherited }));
        }
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: "" })];
}
