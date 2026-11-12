/** @type {import('jest').Config} */
module.exports = {
  rootDir: "../..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { useESM: true, tsconfig: "<rootDir>/tests/tsconfig.json" },
    ],
  },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  restoreMocks: true,
  verbose: true,
  testTimeout: 15000,
  coverageProvider: "v8",
  collectCoverageFrom: [
    "apps/api/src/services/*.ts",
    "apps/api/src/repositories/*.ts",
    "apps/api/src/validators/*.ts",
    "!apps/api/src/**/demo.*",
  ],
  coverageDirectory: "<rootDir>/coverage/jest",
  coverageReporters: ["text", "json-summary", "lcov", "html"],
  coverageThreshold: { global: { lines: 70 } },
};
