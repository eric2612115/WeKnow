// Shrink a photo on the device before any model reads it: faster reads, less data over the network.

export async function shrinkPhoto(input: Blob, maxSide = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && input.type === 'image/jpeg' && input.size < 600_000) {
    bitmap.close();
    return input;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return input;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}
