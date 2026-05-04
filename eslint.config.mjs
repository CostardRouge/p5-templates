import stylistic from "@stylistic/eslint-plugin";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals.js";
import nextTypescript from "eslint-config-next/typescript.js";
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
  baseDirectory: __dirname
} );

const eslintConfig = [
  {
    ignores: [
      "src/generated/**",
      "node_modules/**",
      "public/assets/libraries/**"
    ]
  },
  ...compat.config( nextCoreWebVitals ),
  ...compat.config( nextTypescript ),
  ...compat.extends( "plugin:react/recommended" ),
  ...compat.extends( "plugin:react-hooks/recommended" ),
  ...compat.extends( "plugin:@next/next/recommended" ),
  {
    plugins: {
      "@stylistic": stylistic
    },
    rules: {
      // Overides
      "react/react-in-jsx-scope": "off",

      // Example rules (customize as needed)
      "@stylistic/semi": [
        "error",
        "always"
      ],
      "@stylistic/no-extra-semi": [
        "error"
      ],
      "@stylistic/quotes": [
        "error",
        "double"
      ],
      "@stylistic/array-bracket-newline": [
        "error",
        {
          minItems: 1
        }
      ],
      "@stylistic/array-bracket-spacing": [
        "error",
        "always"
      ],
      "@stylistic/array-element-newline": [
        "error",
        "always"
      ],
      "@stylistic/key-spacing": [
        "error",
        {
          beforeColon: false,
          afterColon: true
        }
      ],
      "@stylistic/keyword-spacing": [
        "error",
        {
          after: true
        }
      ],
      "@stylistic/function-call-argument-newline": [
        "error",
        "always"
      ],
      "@stylistic/function-paren-newline": [
        "error",
        {
          minItems: 2
        }
      ],
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/no-multiple-empty-lines": [
        "error",
        {
          max: 1
        }
      ],
      "@stylistic/no-multi-spaces": "error",
      "@stylistic/space-before-function-paren": [
        "error",
        "never"
      ],
      "@stylistic/space-in-parens": [
        "error",
        "always"
      ],
      "@stylistic/semi-spacing": "error",
      "@stylistic/switch-colon-spacing": "error",
      "@stylistic/function-call-spacing": [
        "error",
        "never"
      ],
      "@stylistic/comma-spacing": [
        "error",
        {
          before: false,
          after: true
        }
      ],
      "@stylistic/arrow-spacing": "error",
      "@stylistic/spaced-comment": [
        "error",
        "always"
      ],
      "@stylistic/computed-property-spacing": [
        "error",
        "always"
      ],
      "@stylistic/space-infix-ops": "error",
      "@stylistic/space-unary-ops": "error",
      "@stylistic/padding-line-between-statements": [
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
      "@stylistic/newline-per-chained-call": "error",
      "@stylistic/object-curly-newline": [
        "error",
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 1
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 1
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 1
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 1
          }
        }
      ],
      "@stylistic/jsx-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/comma-dangle": [
        "error",
        "never"
      ],
      "@stylistic/object-property-newline": "error",
      "@stylistic/padded-blocks": [
        "error",
        {
          blocks: "never"
        }
      ],
      "@stylistic/indent": [
        "error",
        2,
        {
          SwitchCase: 1,
          ObjectExpression: 1
        }
      ],
      "@stylistic/jsx-quotes": [
        "error",
        "prefer-double"
      ],
      "@stylistic/space-before-blocks": "error",
      "@stylistic/template-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/quote-props": [
        "error",
        "as-needed"
      ],
      "@stylistic/brace-style": [
        "error",
        "1tbs",
        {
          allowSingleLine: false
        }
      ],

      // Your existing rules
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",

      // Braces: require { } on all control flow, never inline
      curly: [
        "error",
        "all"
      ]
    }
  }
];

export default eslintConfig;