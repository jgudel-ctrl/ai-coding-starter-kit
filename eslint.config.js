const nextConfig = require("eslint-config-next/core-web-vitals");

module.exports = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "playwright-report-deploy/**",
      "test-results/**",
      "test-results-deploy/**",
      "out/**",
      "build/**",
    ],
  },
];
