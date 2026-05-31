/**
 * Regex-based secret scanner.
 * Rejects memory text if it contains likely secrets.
 */

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "AWS Secret Key", pattern: /(?:aws.{0,20})?[0-9a-zA-Z/+]{40}(?=\s|$)/ },
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

export function scanForSecrets(text: string): ScanResult {
  const detectedSecrets: string[] = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      detectedSecrets.push(name);
    }
  }

  return {
    safe: detectedSecrets.length === 0,
    detectedSecrets,
  };
}
