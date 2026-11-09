// Express/proxy-addr aliases. Only infrastructure hops on private or local
// networks are trusted; the first public address remains the client address.
export const TRUSTED_PROXY_RANGES = ["loopback", "linklocal", "uniquelocal"] as const;
