import sharp from "sharp";

/** Longest side of a stored photo, in pixels. Plenty for a card and a dialog. */
export const MAX_PHOTO_SIDE = 1600;

export interface PreparedImage {
  data: Buffer;
  contentType: string;
  ext: string;
}

export class UnsupportedImageError extends Error {}

/**
 * Normalise an uploaded photo before it is stored: apply the camera's
 * rotation, shrink it to at most MAX_PHOTO_SIDE on the long edge and save it as
 * JPEG.
 *
 * A phone photo can be 10MB and several thousand pixels wide. Stored as it
 * came, the image optimiser has to decode and re-encode all of that on every
 * first view (AVIF first, which is slow), and on a serverless function that
 * can run out of time and leave a broken image on the page. A 1600px JPEG is a
 * few hundred KB and displays everywhere.
 *
 * Formats sharp cannot read, notably iPhone HEIC, are refused with a message
 * rather than stored: a file the browser cannot show is a broken image waiting
 * to happen.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const data = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_PHOTO_SIDE,
        height: MAX_PHOTO_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      // A PNG with transparency would turn black as a JPEG.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { data, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    throw new UnsupportedImageError(
      `Imej "${file.name}" tidak dapat diproses. Jika ia gambar HEIC daripada iPhone, sila tukar kepada JPEG atau PNG dahulu.`
    );
  }
}
