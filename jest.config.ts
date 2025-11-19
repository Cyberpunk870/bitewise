import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/backend-lib/__tests__"],
  setupFilesAfterEnv: ["<rootDir>/backend-lib/test-utils/setup.ts"],
  collectCoverageFrom: [
    "backend-lib/backend-api/**/*.ts",
    "!backend-lib/backend-api/**/__tests__/**"
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json"
      }
    ]
  }
};

export default config;
