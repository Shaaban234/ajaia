import TurndownService from "turndown";
import { errorResponse, loadDoc, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Stretch: export a document as Markdown. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const doc = await loadDoc((await params).id, user);
    const md = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" }).turndown(doc.content);
    const filename = doc.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "document";
    return new Response(`# ${doc.title}\n\n${md}\n`, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
