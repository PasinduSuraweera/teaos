import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "TEAos.",
  version: packageJson.version,
  copyright: `© ${currentYear}, TEAos. Engineered for Ceylon.`,
  meta: {
    title: "TEAos. | The Operating System for Modern Plantations",
    description:
      "Orchestrate your estate from a single pane of glass. Monitor harvest velocity, analyze real-time yield data, and optimize workforce logistics. Built for speed with Next.js 16 & Tailwind v4.",
  },
};
