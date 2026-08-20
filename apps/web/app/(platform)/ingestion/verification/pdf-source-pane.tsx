"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  fileUrl: string | null;
  page: number;
  excerpt: string | null;
};

export function PdfSourcePane({ fileUrl, page, excerpt }: Props) {
  const [pageCount, setPageCount] = useState(1);
  const current = Math.min(Math.max(page, 1), pageCount);

  if (!fileUrl) {
    return <p className="text-sm text-muted-foreground">No signed PDF URL.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Page {current}
        {excerpt ? ` — highlight: ${excerpt}` : ""}
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/30 p-2">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
          loading={<p className="text-sm">Loading PDF…</p>}
        >
          <Page pageNumber={current} width={520} />
        </Document>
      </div>
    </div>
  );
}
