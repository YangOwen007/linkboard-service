import { createHash } from "node:crypto";

export function hashIpAddress(ipAddress: string | undefined, salt: string) {
  if (!ipAddress) {
    return undefined;
  }

  // Hash IP data before storing it so analytics remain useful without keeping raw addresses.
  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex");
}
