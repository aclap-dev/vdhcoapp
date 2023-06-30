const OK = "off";
const _W = "warn";
const E = "error";

module.exports = {
  root: true,
  extends: "eslint:recommended",
  env: {
    node: true,
    browser: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  ignorePatterns: ["addon/src-modules/chrome-buy.js"],
  rules: {
    "prefer-const": [OK],
    "no-constant-condition": [OK],
    "no-useless-escape": [OK],
    "no-inner-declarations": [OK],
    "strict": [E, "global"],
    "no-undef": [E],
    "no-unused-vars": [E, {"varsIgnorePattern": "^_", "argsIgnorePattern": "^_"}],
    "yoda": [E],
    "semi": [E, "always"],
    "linebreak-style": [E, "unix"],
    "no-trailing-spaces": [E],
    "no-tabs": [E],
    "no-var": [E],
    "no-implicit-globals": [E],
    "space-infix-ops": [E],
    "space-unary-ops": [E],
    "arrow-spacing": [E],
    "arrow-parens": [E],
    "space-before-blocks": [E],
    "comma-spacing": [E],
    "func-call-spacing": [E],
    "computed-property-spacing": [E],
    "key-spacing": [E],
    "keyword-spacing": [E],
    "no-multi-spaces": [E],
    "no-multiple-empty-lines": [E, {max: 1, maxBOF: 0, maxEOF: 0}],
    "brace-style": [E, "1tbs"],
    "curly": [E, "all"],
    "rest-spread-spacing": [E],
    "semi-spacing": [E],
    "switch-colon-spacing": [E],
    "one-var": [E, "never"],
    "padding-line-between-statements": [
      E,
      {"blankLine": "always", "prev": "*", "next": "function"},
      {"blankLine": "always", "prev": "function", "next": "*"},
    ],
  },
};
