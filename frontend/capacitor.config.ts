import type { CapacitorConfig } from "@capacitor/cli";
import { validateCapacitorServerUrl } from "./scripts/check-capacitor-config.mjs";

const { normalized, hostname } = validateCapacitorServerUrl(process.env.CAPACITOR_SERVER_URL);

const config: CapacitorConfig = {
  appId: "id.ac.labkom.management",
  appName: "LabKom Management",
  webDir: "capacitor-web",
  server: {
    url: normalized,
    cleartext: false,
    allowNavigation: [hostname],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
