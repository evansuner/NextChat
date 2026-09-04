import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      "src/generated/**/*",
      "public/serviceWorker.js",
      "app/mcp/mcp_config.json",
      "app/mcp/mcp_config.default.json",
    ],
  },
];

// Add rule overrides to disable @typescript-eslint/no-explicit-any
eslintConfig.push({
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-ts-comment": "error",
  },
});
export default eslintConfig;
