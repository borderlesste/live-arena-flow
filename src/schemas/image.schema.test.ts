import { describe, expect, it } from "vitest";
import { persistedImageSchema } from "./image.schema";

describe("persistedImageSchema", () => {
  it("accepts supported image data URLs", () => {
    expect(persistedImageSchema.safeParse("data:image/webp;base64,aGVsbG8=").success).toBe(true);
  });

  it("rejects SVG and executable data URLs", () => {
    expect(persistedImageSchema.safeParse("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=").success).toBe(false);
    expect(persistedImageSchema.safeParse("data:text/html;base64,PHNjcmlwdD4=").success).toBe(false);
  });
});
