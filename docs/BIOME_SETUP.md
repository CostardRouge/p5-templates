# Biome Setup for AI Agent Code Formatting

This project uses Biome as the primary code formatter and linter to ensure consistent code style across all AI agents and manual development.

## Why Biome?

Biome provides:
- Fast formatting and linting (much faster than ESLint + Prettier)
- Built-in support in many AI coding assistants
- Consistent formatting that matches your strict stylistic preferences
- Single tool for both formatting and basic linting

## Configuration

Biome is configured in `biome.json` with the following key settings to match your ESLint preferences:
- **Indentation**: 2 spaces
- **Quotes**: Double quotes
- **Semicolons**: Always required
- **Bracket spacing**: Spaces around brackets
- **Line width**: 80 characters
- **Tailwind CSS support**: Enabled for CSS files
- **Ignored folders**: `src/generated/**`, `public/assets/libraries/**`

## Available Commands

```bash
# Check formatting and linting
npm run biome

# Fix formatting and linting issues
npm run biome:fix

# Format all files
npm run biome:format

# Combined format and ESLint fix (recommended before commits)
npm run format

# Combined check (Biome + ESLint)
npm run check
```

## For AI Agents

When using AI coding assistants (opencode, Windsurf, Kiro, Cursor, etc.), they should automatically respect the `biome.json` configuration. If they don't:

1. **Run formatting manually**: Use `npm run biome:format` after AI-generated code
2. **Check before committing**: Always run `npm run check` to ensure code meets standards
3. **Configure your AI tool**: Some AI assistants can be configured to use Biome directly

## Integration

Biome is now integrated into the development workflow:
- `npm run format` - Formats with Biome and fixes ESLint issues
- `npm run check` - Validates both Biome and ESLint rules
- Pre-commit hooks can be added to automatically format code

## Migration from ESLint Stylistic Rules

The Biome configuration replicates your ESLint stylistic preferences:
- `@stylistic/js/semi: "always"` → `"semicolons": "always"`
- `@stylistic/js/quotes: "double"` → `"quoteStyle": "double"`
- `@stylistic/js/indent: 2` → `"indentWidth": 2`
- And many more spacing/alignment rules

## Why Keep ESLint?

While Biome handles most formatting and basic linting, **ESLint is still essential** for:

### Rules Biome Cannot Replace:
- **Next.js Framework Rules**: `@next/next/*` rules (pages routing, image optimization, etc.)
- **React Ecosystem Rules**: `react/*`, `react-hooks/*` rules (component lifecycle, hooks usage)
- **TypeScript Rules**: `@typescript-eslint/*` rules (type safety, unused variables, etc.)
- **Accessibility Rules**: `jsx-a11y/*` rules (WCAG compliance)
- **Advanced Code Quality**: Complex logic analysis that Biome doesn't support

### Current ESLint-Only Rules:
```javascript
// These cannot be migrated to Biome:
"@next/next/no-html-link-for-pages": "off",
"@next/next/no-img-element": "off",
"@typescript-eslint/ban-ts-comment": "off",
"@typescript-eslint/no-unused-vars": "off",
"@typescript-eslint/no-explicit-any": "off",
"react/react-in-jsx-scope": "off",
"react-hooks/exhaustive-deps": "warn",
// ... and many more
```

### Migration Status:

#### ✅ **Migrated to Biome:**
- All `@stylistic/js/*` rules → Biome formatter
- Basic JavaScript/TypeScript linting
- Import organization
- Code formatting consistency

#### ❌ **Cannot Migrate (Keep ESLint):**
- Framework-specific rules (Next.js, React)
- TypeScript-specific rules
- Accessibility rules
- Complex code analysis

### Recommended Workflow:
1. **Formatting**: Use Biome (`npm run biome:format`)
2. **Linting**: Use both (`npm run check`)
3. **AI Agents**: Rely on Biome for consistency
4. **CI/CD**: Run both Biome and ESLint

## Tips for AI Agents

- Always run `npm run format` after generating or modifying code
- Use `npm run check` to validate code quality before submitting
- Biome will handle most formatting automatically if the AI tool supports it
- For complex formatting issues, Biome's `biome:fix` can resolve many linting problems