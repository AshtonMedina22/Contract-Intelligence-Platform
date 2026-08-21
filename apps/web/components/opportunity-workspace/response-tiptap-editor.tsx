"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type EditorSaveStatus = {
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
};

type Props = {
  html: string;
  onChange: (html: string) => void;
  editable?: boolean;
  /** Debounced draft save. Never approves — the parent uses the AUTOSAVE intent. */
  onAutosave?: (html: string) => void;
  /** Ctrl/Cmd+S and the toolbar Save action. */
  onSave?: (html: string) => void;
  onImprove?: (selectedText: string) => void;
  improveDisabledReason?: string | null;
  status?: EditorSaveStatus;
  autosaveDelayMs?: number;
};

type SlashItem = {
  key: string;
  label: string;
  run: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { key: "h1", label: "Heading 1", run: (e) => e.chain().focus().setNode("heading", { level: 1 }).run() },
  { key: "h2", label: "Heading 2", run: (e) => e.chain().focus().setNode("heading", { level: 2 }).run() },
  { key: "h3", label: "Heading 3", run: (e) => e.chain().focus().setNode("heading", { level: 3 }).run() },
  { key: "bullet", label: "Bulleted list", run: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "ordered", label: "Numbered list", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { key: "quote", label: "Quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { key: "paragraph", label: "Paragraph", run: (e) => e.chain().focus().setParagraph().run() },
];

function statusLabel(status: EditorSaveStatus | undefined): string {
  if (!status) return "";
  if (status.saving) return "Saving draft…";
  if (status.dirty) return "Unsaved changes";
  if (status.lastSavedAt) {
    return `Draft saved ${new Date(status.lastSavedAt).toLocaleTimeString()}`;
  }
  return "No unsaved changes";
}

export function ResponseTiptapEditor({
  html,
  onChange,
  editable = true,
  onAutosave,
  onSave,
  onImprove,
  improveDisabledReason,
  status,
  autosaveDelayMs = 1500,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHtml = useRef(html);
  const [slash, setSlash] = useState<{ query: string; from: number; top: number; left: number } | null>(
    null,
  );

  const closeSlash = useCallback(() => setSlash(null), []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: html || "<p></p>",
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const next = ed.getHTML();
      latestHtml.current = next;
      onChange(next);

      const { from, empty } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "\n");
      const match = empty ? /(?:^|\n)\/([a-z0-9]*)$/i.exec(textBefore) : null;
      if (match) {
        const coords = ed.view.coordsAtPos(from);
        const box = containerRef.current?.getBoundingClientRect();
        setSlash({
          query: match[1] ?? "",
          from: from - (match[1]?.length ?? 0) - 1,
          top: coords.bottom - (box?.top ?? 0) + 4,
          left: coords.left - (box?.left ?? 0),
        });
      } else {
        setSlash(null);
      }

      if (!onAutosave) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => onAutosave(latestHtml.current), autosaveDelayMs);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[280px] rounded-md border bg-background p-3 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    latestHtml.current = html;
    if (!editor) return;
    const current = editor.getHTML();
    if (html && html !== current) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [html, editor]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      onSave?.(latestHtml.current);
      return;
    }
    if (event.key === "Escape" && slash) {
      event.preventDefault();
      closeSlash();
    }
  };

  if (!editor) return <p className="text-sm text-muted-foreground">Loading editor…</p>;

  const filteredSlashItems = slash
    ? SLASH_ITEMS.filter((item) =>
        item.label.toLowerCase().replace(/\s+/g, "").includes(slash.query.toLowerCase()),
      )
    : [];

  const applySlashItem = (item: SlashItem) => {
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: slash!.from, to }).run();
    item.run(editor);
    closeSlash();
  };

  return (
    <div className="relative space-y-2" ref={containerRef} onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <span className="ml-1 text-[11px] text-muted-foreground">
          Type <code className="rounded bg-muted px-1">/</code> for blocks · Ctrl/Cmd+S to save
        </span>
        <span
          data-testid="response-editor-status"
          data-dirty={status?.dirty ? "true" : "false"}
          data-saving={status?.saving ? "true" : "false"}
          className={`ml-auto text-[11px] ${
            status?.dirty ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <BubbleMenu
        editor={editor}
        className="flex items-center gap-1 rounded-md border bg-popover p-1 shadow-md"
      >
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </ToolbarButton>
        {onImprove ? (
          <ToolbarButton
            disabled={Boolean(improveDisabledReason)}
            title={improveDisabledReason ?? "Re-run grounded generation with an instruction"}
            onClick={() => {
              const { from, to } = editor.state.selection;
              onImprove(editor.state.doc.textBetween(from, to, " "));
            }}
          >
            Improve
          </ToolbarButton>
        ) : null}
      </BubbleMenu>

      <EditorContent editor={editor} />

      {slash && filteredSlashItems.length > 0 ? (
        <div
          role="listbox"
          aria-label="Insert block"
          className="absolute z-20 w-48 rounded-md border bg-popover p-1 shadow-md"
          style={{ top: slash.top, left: slash.left }}
        >
          {filteredSlashItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={false}
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
              onMouseDown={(event) => {
                event.preventDefault();
                applySlashItem(item);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  active,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      className="h-7 px-2 text-xs"
      {...props}
    >
      {children}
    </Button>
  );
}
