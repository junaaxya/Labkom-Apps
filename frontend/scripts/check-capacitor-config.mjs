const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "example.edu",
  "app.example.edu",
  "api.example.edu",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

const PRIVATE_ALIAS_SUFFIXES = [
  ".nip.io",
  ".sslip.io",
  ".localhost.direct",
  ".localtest.me",
];

function isBlockedIpv6Host(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe80:")
    || normalized.startsWith("ff");
}

export function validateCapacitorServerUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("CAPACITOR_SERVER_URL wajib diisi");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("CAPACITOR_SERVER_URL harus berupa URL yang valid");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("CAPACITOR_SERVER_URL harus memakai HTTPS");
  }

  if (!parsed.hostname) {
    throw new Error("CAPACITOR_SERVER_URL harus punya hostname");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    PLACEHOLDER_HOSTS.has(hostname)
    || hostname.endsWith(".local")
    || hostname.endsWith(".test")
    || hostname.endsWith(".example")
    || PRIVATE_ALIAS_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    || isBlockedIpv6Host(hostname)
    || /^192\.168\./.test(hostname)
    || /^10\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    throw new Error("CAPACITOR_SERVER_URL harus memakai domain produksi publik, bukan localhost/placeholder/private host");
  }

  if (parsed.username || parsed.password) {
    throw new Error("CAPACITOR_SERVER_URL tidak boleh mengandung kredensial");
  }

  if (parsed.search) {
    throw new Error("CAPACITOR_SERVER_URL tidak boleh mengandung query string");
  }

  if (parsed.hash) {
    throw new Error("CAPACITOR_SERVER_URL tidak boleh mengandung hash fragment");
  }

  const normalized = parsed.toString().replace(/\/$/, "");
  return {
    normalized,
    origin: parsed.origin,
    hostname: parsed.hostname,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin } = validateCapacitorServerUrl(process.env.CAPACITOR_SERVER_URL);
  console.log(`Capacitor server URL OK: ${origin}`);
}
