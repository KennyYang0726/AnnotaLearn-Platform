export async function loadPdfJs() {
  // Use PDF.js' legacy build for wider real-device browser/WebView support.
  // The modern build in pdfjs-dist 6.x uses very new JavaScript APIs such as
  // Map.prototype.getOrInsertComputed(), which can fail on otherwise capable
  // mobile browsers that have not implemented those APIs yet.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

export async function getPdfPageCount(file: File) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    await task.destroy();
  }
}
