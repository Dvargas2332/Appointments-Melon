/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  coverageDirectory: "../coverage",
  collectCoverageFrom: ["**/*.ts", "!**/*.spec.ts", "!main.ts"],
};
