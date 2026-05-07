import type { Config } from "tailwindcss";
import { glassboxTailwindPreset } from "@glassbox/theme/tailwind";

const config: Config = {
  presets: [glassboxTailwindPreset],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {}
  }
};

export default config;

