import crypto from "node:crypto";
import { config } from "./config.js";

export function verifyMetaSignature(request) {
  const signature = request.header("x-hub-signature-256");

  if (!signature) {
    return false;
  }

  const [algorithm, providedHash] = signature.split("=");

  if (algorithm !== "sha256" || !providedHash || !request.rawBody) {
    return false;
  }

  const expectedHash = crypto
    .createHmac("sha256", config.metaAppSecret)
    .update(request.rawBody)
    .digest("hex");

  const expected = Buffer.from(expectedHash, "hex");
  const provided = Buffer.from(providedHash, "hex");

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
