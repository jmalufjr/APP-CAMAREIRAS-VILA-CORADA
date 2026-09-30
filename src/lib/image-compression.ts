// Reduz uma foto tirada no celular (frequentemente vários MB) pra um
// tamanho mais leve antes de enviar — mais rápido pra enviar com sinal
// fraco e ocupa menos espaço de armazenamento. Usa só APIs nativas do
// navegador (sem nenhuma biblioteca nova). Se algo der errado (formato não
// suportado etc.), devolve o arquivo original sem travar o envio.
export async function compressImageForUpload(
  file: File,
  maxDimension = 1600,
  quality = 0.72
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
