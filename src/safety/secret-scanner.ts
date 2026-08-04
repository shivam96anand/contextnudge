/**
 * Regex-based secret scanner.
 * Rejects memory text if it contains likely secrets.
 */

const SECRET_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  verify?: (match: string) => boolean;
}> = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  {
    name: "AWS Secret Key",
    pattern: /aws[^\n]{0,20}?['"]?([0-9a-zA-Z/+]{40})['"]?(?=\s|$)/i,
  },
  {
    name: "AWS Secret Key",
    // A bare 40-char base64-ish run is only credential-like when it mixes
    // character classes. Hex digests (git SHAs, sha256) and long identifiers
    // must not match, or legitimate memories get rejected and silently lost.
    pattern: /(?:^|[\s'"=:])([0-9a-zA-Z/+]{40})(?=[\s'"]|$)/,
    verify: looksLikeHighEntropySecret,
  },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
  { name: "GitHub Personal Access Token", pattern: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: "Generic API Key", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{20,}['"]?/i },
  { name: "Generic Secret", pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/i },
  { name: "Bearer Token", pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: "Connection String", pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s]+:[^\s]+@[^\s]+/ },
  { name: "Slack Token", pattern: /xox[baprs]-[0-9]{10,}-[A-Za-z0-9-]+/ },
  { name: "npm Token", pattern: /npm_[A-Za-z0-9]{36}/ },
  { name: "Stripe Key", pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/ },
  { name: "OpenAI API Key", pattern: /sk-[A-Za-z0-9]{32,}/ },
  { name: "JWT Token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/ },
];

export interface ScanResult {
  safe: boolean;
  detectedSecrets: string[];
}

/**
 * Distinguishes a real credential from a hex digest or long identifier.
 * AWS secret keys draw from the full base64 alphabet, so they mix cases and
 * digits; git SHAs and sha256 digests are pure hex, and code identifiers
 * rarely contain digits. Requiring all three classes keeps those out.
 */
function looksLikeHighEntropySecret(value: string): boolean {
  if (/^[0-9a-f]+$/i.test(value)) return false; // hex digest
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value);
}

export function scanForSecrets(text: string): ScanResult {
  const detectedSecrets: string[] = [];

  for (const { name, pattern, verify } of SECRET_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    if (verify && !verify(match[1] ?? match[0])) continue;
    if (!detectedSecrets.includes(name)) {
      detectedSecrets.push(name);
    }
  }

  return {
    safe: detectedSecrets.length === 0,
    detectedSecrets,
  };
}
