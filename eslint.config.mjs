import {
  dirname
} from "path";
import {
  fileURLToPath
} from "url";
import {
  FlatCompat
} from "@eslint/eslintrc";

const __filename = fileURLToPath( import.meta.url );
const __dirname = dirname( __filename );

const compat = new FlatCompat( {
  baseDirectory: __dirname,
} );

const eslintConfig = [
  {
    ignores: [
      "src/generated/**"
    ]
  },
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@next/next/recommended",
  ),
  ...compat.config( {
    plugins: [
      "@stylistic/js",
    ],
    rules: {
      // Overides
      "react/react-in-jsx-scope": "off",

      // Example rules (customize as needed)
      "@stylistic/js/semi": [
        "error",
        "always"
      ],
      "@stylistic/js/no-extra-semi": [
        "error"
      ],
      "@stylistic/js/quotes": [
        "error",
        "double"
      ],
      "@stylistic/js/array-bracket-newline": [
        "error",
        "always"
      ],
      "@stylistic/js/array-bracket-spacing": [
        "error",
        "always"
      ],
      "@stylistic/js/array-element-newline": [
        "error",
        "always"
      ],
      "@stylistic/js/key-spacing": [
        "error",
        {
          afterColon: true
        }
      ],
      "@stylistic/js/function-call-argument-newline": [
        "error",
        "always"
      ],
      "@stylistic/js/function-paren-newline": [
        "error",
        {
          minItems: 2
        }
      ],
      "@stylistic/js/no-trailing-spaces": "error",
      "@stylistic/js/no-multiple-empty-lines": [
        "error",
        {
          max: 1
        }
      ],
      "@stylistic/js/no-multi-spaces": "error",
      "@stylistic/js/space-before-function-paren": [
        "error",
        "never"
      ],
      "@stylistic/js/space-in-parens": [
        "error",
        "always"
      ],
      "@stylistic/js/semi-spacing": "error",
      "@stylistic/js/switch-colon-spacing": "error",
      "@stylistic/js/function-call-spacing": [
        "error",
        "never"
      ],
      "@stylistic/js/comma-spacing": [
        "error",
        {
          before: false,
          after: true
        }
      ],
      "@stylistic/js/arrow-spacing": "error",
      "@stylistic/js/spaced-comment": [
        "error",
        "always"
      ],
      "@stylistic/js/computed-property-spacing": [
        "error",
        "always"
      ],
      "@stylistic/js/space-infix-ops": "error",
      "@stylistic/js/space-unary-ops": "error",
      "@stylistic/js/padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: [
            "const",
            "let",
            "var"
          ],
          next: "*"
        },
        {
          blankLine: "any",
          prev: [
            "const",
            "let",
            "var"
          ],
          next: [
            "const",
            "let",
            "var"
          ]
        }
      ],
      "@stylistic/js/newline-per-chained-call": "error",
      "@stylistic/js/object-curly-newline": [
        "error",
        "always"
      ],
      "@stylistic/js/object-property-newline": "error",
      "@stylistic/js/padded-blocks": [
        "error",
        {
          blocks: "never"
        }
      ],
      "@stylistic/js/indent": [
        "error",
        2,
        {
          SwitchCase: 1,
          ObjectExpression: 1,
        }
      ],

      "@stylistic/js/jsx-quotes": [
        "error",
        "prefer-double"
      ],
      "@stylistic/js/space-before-blocks": "error",
      "@stylistic/js/template-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/js/quote-props": [
        "error",
        "as-needed"
      ],

      // Your existing rules
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  } ),
];

export default eslintConfig;