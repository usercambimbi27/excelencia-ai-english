import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env["CAPACITOR_SERVER_URL"];

const config: CapacitorConfig = {
  appId: "ao.excelencia.ai",
  appName: "Excelência AI English",
  webDir: "dist/client",
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
  android: {
    backgroundColor: "#1a1f3a",
  },
  ios: {
    backgroundColor: "#1a1f3a",
    contentInset: "always",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1f3a",
    },
  },
};

export default config;
