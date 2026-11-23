import { Mark, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

/**
 * Anchors a comment thread to a range of text. The mark only stores the thread id;
 * the comment itself lives in the comments table, so the document HTML stays small.
 */
export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => (attrs.commentId ? { "data-comment-id": attrs.commentId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "comment-mark" }), 0];
  },
});

/** Removes every occurrence of one thread's highlight (used on resolve/delete). */
export function removeCommentMark(editor: Editor, commentId: string) {
  const type = editor.schema.marks.comment;
  if (!type) return;
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    node.marks.forEach((m) => {
      if (m.type === type && m.attrs.commentId === commentId) tr.removeMark(pos, pos + node.nodeSize, m);
    });
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** Document order of threads, so the panel lists them top to bottom like Docs. */
export function commentOrder(editor: Editor): string[] {
  const seen: string[] = [];
  editor.state.doc.descendants((node) => {
    node.marks.forEach((m) => {
      if (m.type.name === "comment" && m.attrs.commentId && !seen.includes(m.attrs.commentId)) seen.push(m.attrs.commentId);
    });
  });
  return seen;
}
