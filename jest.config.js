/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  rootDir: ".",
  roots: [
    "<rootDir>/src",
    "<rootDir>/scripts"
  ],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx"
  ],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "ts-jest",
      {
        tsconfig: {
          // Tests don't care about emit; relax JSX/module settings so options.ts
          // and helper files compile without the Next-specific tsconfig plugin.
          jsx: "react",
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          isolatedModules: true,
          allowJs: true,
          target: "ES2022"
        },
        diagnostics: false
      }
    ]
  },
  moduleNameMapper: {
    "^@/p5/(.*)$": "<rootDir>/src/sketches/p5/$1",
    "^@/gsap/(.*)$": "<rootDir>/src/sketches/gsap/$1",
    "^@/html/(.*)$": "<rootDir>/src/sketches/html/$1",
    "^@/threejs/(.*)$": "<rootDir>/src/sketches/threejs/$1",
    "^@/public/(.*)$": "<rootDir>/public/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js"
  },
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json"
  ],
  // Sketch index.js files use the global p5 API at module top-level and
  // pull in browser-only assets — never load them through the resolver.
  modulePathIgnorePatterns: [
    "<rootDir>/.next",
    "<rootDir>/src/generated"
  ]
};

module.exports = config;
