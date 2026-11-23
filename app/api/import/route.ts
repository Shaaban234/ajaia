import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { errorResponse, HttpError, requireUser, toView } from "@/lib/api";
import { fileToHtml, isSupported, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS, titleFromFilename } from "@/lib/content";

/** Upload a .txt / .md / .docx file and turn it into a new editable document. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Expected a multipart upload.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a non-empty file to upload.");
    if (!isSupported(file.name)) throw new HttpError(415, `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is too large (5 MB limit).");

    let content: string;
    try {
      content = await fileToHtml(file.name, Buffer.from(await file.arrayBuffer()));
    } catch {
      throw new HttpError(422, "Could not read that file. Is it a valid, non-corrupted document?");
    }
    const doc = await (await getStore()).create({ title: titleFromFilename(file.name), content, ownerId: user.id });
    return NextResponse.json({ document: toView(doc, user.id) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
