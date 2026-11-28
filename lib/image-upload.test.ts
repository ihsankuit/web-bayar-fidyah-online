import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_PHOTO_SIDE, prepareImage, UnsupportedImageError } from "./image-upload";

async function fakePhoto(width: number, height: number, name = "foto.jpg") {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg({ quality: 100 })
    .toBuffer();
  return new File([new Uint8Array(buf)], name, { type: "image/jpeg" });
}

describe("prepareImage", () => {
  it("shrinks a large camera photo to the maximum side and keeps the aspect ratio", async () => {
    const file = await fakePhoto(4000, 3000);
    const out = await prepareImage(file);
    const meta = await sharp(out.data).metadata();
    expect(meta.width).toBe(MAX_PHOTO_SIDE);
    expect(meta.height).toBe(1200);
    expect(out.data.length).toBeLessThan(file.size);
    expect(out.contentType).toBe("image/jpeg");
    expect(out.ext).toBe("jpg");
  });

  it("does not enlarge a small image", async () => {
    const out = await prepareImage(await fakePhoto(640, 480));
    const meta = await sharp(out.data).metadata();
    expect([meta.width, meta.height]).toEqual([640, 480]);
  });

  it("turns a transparent PNG white rather than black", async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const out = await prepareImage(new File([new Uint8Array(png)], "logo.png", { type: "image/png" }));
    const { data } = await sharp(out.data).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });

  it("applies the camera's rotation", async () => {
    const buf = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await prepareImage(new File([new Uint8Array(buf)], "r.jpg", { type: "image/jpeg" }));
    const meta = await sharp(out.data).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
  });

  it("refuses a file that is not a readable image, naming it", async () => {
    const bad = new File([new Uint8Array([1, 2, 3, 4])], "IMG_0001.HEIC", { type: "image/heic" });
    await expect(prepareImage(bad)).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(prepareImage(bad)).rejects.toThrow(/IMG_0001\.HEIC.*HEIC/);
  });
});
