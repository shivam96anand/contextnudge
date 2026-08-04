import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../src/safety/secret-scanner.js";

describe("scanForSecrets", () => {
  describe("must not reject legitimate developer memories", () => {
    // Regression: the AWS rule had an optional `aws` prefix, so it matched any
    // 40-char alphanumeric run. A git SHA is exactly 40 chars, so saving a
    // memory that referenced a commit threw and the memory was silently lost.
    const allowed = [
      "Deploy is pinned to commit 4c7bfb0aa1b2c3d4e5f60718293a4b5c6d7e8f90",
      "The build cache key is sha256 abcdef0123456789abcdef0123456789abcdef01",
      "Use ErrKindWrapperForEveryPublicApiErrorHandlerXY here",
      "Run pnpm build then pnpm test",
      "This repo uses pnpm, not npm.",
    ];

    it.each(allowed)("allows: %s", (text) => {
      const result = scanForSecrets(text);
      expect(result.detectedSecrets).toEqual([]);
      expect(result.safe).toBe(true);
    });
  });

  describe("must still reject real credentials", () => {
    const blocked: Array<[string, string]> = [
      ["AWS access key", "AKIAIOSFODNN7EXAMPLE is a key"],
      [
        "AWS secret with context",
        "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      ],
      ["bare AWS secret", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"],
      ["GitHub token", "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"],
      ["generic password", "password: hunter2000"],
      ["private key", "-----BEGIN RSA PRIVATE KEY-----"],
      ["connection string", "postgres://user:pass@host/db"],
    ];

    it.each(blocked)("blocks %s", (_label, text) => {
      expect(scanForSecrets(text).safe).toBe(false);
    });
  });

  it("reports each matching rule only once", () => {
    const result = scanForSecrets("AKIAIOSFODNN7EXAMPLE and AKIAIOSFODNN7EXAMPLE");
    expect(result.detectedSecrets).toEqual(["AWS Access Key"]);
  });
});
