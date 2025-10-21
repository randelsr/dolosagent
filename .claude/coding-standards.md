# JavaScript/TypeScript Project Standards

## Core Principles

### Code Style & Philosophy

* Write concise, technical code with accurate TypeScript examples
* Use functional and declarative programming patterns; avoid classes except for errors and framework requirements
* Prefer composition and small, pure functions over large, stateful classes
* Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasPermission`, `shouldUpdate`)
* Structure files and folders with clear, consistent naming:
  * **Files/Folders:** kebab-case (`user-profile.tsx`, `api-client.ts`)
  * **Components:** PascalCase exports (`UserProfile`, `DataTable`)
  * **Functions/Variables:** camelCase (`getUserData`, `isActive`)
  * **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
  * **Types/Interfaces:** PascalCase (`User`, `ApiResponse`)

### Modern JavaScript/TypeScript Practices

* Use ES modules (`import`/`export`) exclusively - no CommonJS
* Prefer `const` for immutable bindings, `let` for reassignment - avoid `var`
* Use template literals for string interpolation
* Leverage destructuring for objects and arrays
* Use optional chaining (`?.`) and nullish coalescing (`??`)
* Prefer arrow functions for inline callbacks, regular functions for top-level declarations
* Use async/await over raw Promises for better readability

## TypeScript Guidelines

### Type Safety

* Enable strict mode in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "allowUnusedLabels": false,
      "allowUnreachableCode": false
    }
  }
  ```
* Provide explicit types for all public APIs (exported functions, components, hooks)
* Use `type` for unions, intersections, primitives, and tuples
* Use `interface` for object shapes that may be extended
* Avoid `any` - use `unknown` for truly unknown types, then narrow with type guards
* Use branded types for IDs and values that need runtime distinction:
  ```typescript
  type UserId = string & { readonly brand: unique symbol };
  type ProductId = string & { readonly brand: unique symbol };
  ```

### Type Organization

* Co-locate types with implementation when used in single file
* Extract shared types to dedicated `types/` directory
* Use `import type` for type-only imports to improve tree-shaking
* Organize imports in this order:
  1. External dependencies (`react`, `next`, `zod`)
  2. Type-only external imports (`import type { ... }`)
  3. Internal absolute imports (`@/lib`, `@/components`)
  4. Type-only internal imports
  5. Relative imports (`./utils`, `../types`)
  6. Type-only relative imports

### Modern Type Patterns

```typescript
// Prefer const assertions for literal types
const STATUSES = ['pending', 'active', 'inactive'] as const;
type Status = typeof STATUSES[number];

// Use satisfies for type checking without widening
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} satisfies Config;

// Use template literal types for string patterns
type Route = `/api/${string}`;
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Prefer utility types
type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

## Code Organization

### File Structure

```
src/
├── app/                    # Next.js app directory or main app code
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── features/          # Feature-specific components
│   └── layouts/           # Layout components
├── lib/                   # Utility functions and business logic
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Pure utility functions
│   └── services/         # API clients, external services
├── types/                 # Shared TypeScript types
├── config/                # Configuration files
└── __tests__/            # Test files (if not co-located)
```

### Module Guidelines

* Keep files under 300 lines; refactor if exceeded
* Keep functions under 40 lines; extract helpers if needed
* One primary export per file (component, hook, utility)
* Co-locate related code (component + styles + tests)
* Use barrel exports (`index.ts`) sparingly - only for public APIs

### Export Patterns

```typescript
// ✅ Named exports for utilities (tree-shakeable)
export function formatDate(date: Date): string { }
export function parseDate(str: string): Date { }

// ✅ Default export for components
export default function UserProfile({ user }: Props) { }

// ✅ Named export for multiple related exports
export { formatDate, parseDate, validateDate };

// ❌ Avoid default exports for utilities
export default { formatDate, parseDate }; // Hard to tree-shake
```

## Error Handling

### Error Types

```typescript
// Create custom error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(
    message: string,
    public readonly resource: string
  ) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Use discriminated unions for results
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### Error Handling Patterns

* Validate inputs at function boundaries (start of public functions)
* Use guard clauses and early returns for edge cases
* Keep the happy path unindented and at the end
* Catch specific errors, not all errors
* Include contextual information in error messages
* Use structured logging for errors:
  ```typescript
  console.error('Failed to fetch user', {
    userId,
    error: error.message,
    stack: error.stack,
  });
  ```

## Dependencies & Tooling

### Package Manager

* Use **npm**, **pnpm**, or **bun** (choose one per project)
* Pin exact versions for production dependencies
* Use lockfiles and commit them to version control
* Audit dependencies regularly: `npm audit` or `pnpm audit`

### Essential Dependencies

* **Runtime Validation:** Zod, Valibot, or Yup for runtime type checking
* **Testing:** Vitest (modern, fast) or Jest (established)
* **Linting:** ESLint with TypeScript support
* **Formatting:** Prettier
* **Type Checking:** TypeScript in strict mode

### Recommended ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "warn"
  }
}
```

## Development Workflow

### Pre-Commit Quality Checks

All code must pass these checks before committing:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "quality": "npm run type-check && npm run lint && npm run format:check && npm run test"
  }
}
```

### Git Hooks (with husky)

```bash
# .husky/pre-commit
npm run type-check
npm run lint
npm run format:check
npm run test:changed
```

### CI/CD Requirements

* All quality checks must pass
* Test coverage must be ≥ 80% (90% preferred)
* No TypeScript errors
* No ESLint errors
* Code formatted with Prettier

## Testing Standards

### Testing Philosophy

* Write tests for **behavior**, not implementation
* Test the public API, not internal details
* Mock external dependencies (network, filesystem, databases)
* Don't mock your own business logic in integration tests
* Follow the Testing Pyramid: more unit tests, fewer integration tests, few E2E tests

### Test Organization

**Co-located Tests (Recommended for Components):**
```
components/
├── user-profile.tsx
├── user-profile.test.tsx
└── user-profile.module.css
```

**Separate Test Directory:**
```
src/
├── lib/
│   └── utils/
│       └── format-date.ts
└── __tests__/
    └── lib/
        └── utils/
            └── format-date.test.ts
```

### Test Naming Conventions

* Unit tests: `[name].test.ts` or `[name].spec.ts`
* Integration tests: `[name].integration.test.ts`
* E2E tests: `[name].e2e.test.ts`

### Test Structure (Arrange-Act-Assert)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    // Arrange
    const amount = 1234.56;
    const currency = 'USD';

    // Act
    const result = formatCurrency(amount, currency);

    // Assert
    expect(result).toBe('$1,234.56');
  });

  it('handles zero amounts', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('throws for invalid currency codes', () => {
    expect(() => formatCurrency(100, 'INVALID')).toThrow(ValidationError);
  });
});
```

### Mocking Best Practices

**HTTP Request Mocking (Fetch API):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('fetchUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches user data successfully', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '1', name: 'John' }),
    } as Response);

    // Act
    const user = await fetchUser('1');

    // Assert
    expect(user).toEqual({ id: '1', name: 'John' });
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/users/1');
  });

  it('handles network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(fetchUser('1')).rejects.toThrow('Network error');
  });

  it('handles 404 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchUser('999')).rejects.toThrow(NotFoundError);
  });
});
```

**React Component Testing:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfile } from './user-profile';

describe('UserProfile', () => {
  it('renders user information', () => {
    render(<UserProfile user={{ name: 'John Doe', email: 'john@example.com' }} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    render(<UserProfile user={null} isLoading />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', async () => {
    const onEdit = vi.fn();
    render(<UserProfile user={{ name: 'John' }} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
```

**Custom Hook Testing:**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from './use-user';

describe('useUser', () => {
  it('fetches user data', async () => {
    const { result } = renderHook(() => useUser('1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: '1', name: 'John' });
  });
});
```

### Testing Guidelines

* **Never make real HTTP requests** - always mock network calls
* **Use test.each for parametrized tests** instead of loops
* **One logical assertion per test** - split complex tests
* **Test edge cases and error paths** as thoroughly as happy paths
* **Keep tests fast** - unit tests should run in < 50ms
* **Use descriptive test names** - describe what is being tested and expected outcome
* **Avoid testing implementation details** - test behavior, not internal state

## Performance & Best Practices

### Modern JavaScript Patterns

```typescript
// ✅ Use optional chaining
const userName = user?.profile?.name ?? 'Anonymous';

// ✅ Use nullish coalescing (only null/undefined)
const port = process.env.PORT ?? 3000;

// ❌ Avoid logical OR (treats 0, '', false as falsy)
const port = process.env.PORT || 3000;

// ✅ Use Array methods
const activeUsers = users.filter(u => u.isActive);
const userNames = users.map(u => u.name);
const hasAdmin = users.some(u => u.role === 'admin');

// ✅ Use object/array destructuring
const { name, email } = user;
const [first, ...rest] = items;

// ✅ Use spread operator for immutability
const updatedUser = { ...user, name: 'New Name' };
const newItems = [...items, newItem];
```

### Async Patterns

```typescript
// ✅ Use async/await
async function fetchUserData(id: string) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

// ✅ Parallel execution with Promise.all
async function fetchAllData() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),
    fetchPosts(),
    fetchComments(),
  ]);
  return { users, posts, comments };
}

// ✅ Error handling with Promise.allSettled
const results = await Promise.allSettled([
  fetchUsers(),
  fetchPosts(),
]);
results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log(result.value);
  } else {
    console.error(result.reason);
  }
});
```

### Code Smells to Avoid

* ❌ Deeply nested conditionals (use guard clauses)
* ❌ Large functions (split into smaller, focused functions)
* ❌ Magic numbers/strings (use named constants)
* ❌ Mutation of function parameters
* ❌ God objects/classes with many responsibilities
* ❌ Tight coupling between modules
* ❌ Comments explaining what code does (code should be self-documenting)

## Security Best Practices

* Never commit secrets, API keys, or credentials
* Use `.env` files for environment-specific configuration
* Add `.env` to `.gitignore`
* Validate all user input at API boundaries
* Sanitize data before rendering (prevent XSS)
* Use CSP headers for additional XSS protection
* Keep dependencies updated (`npm audit`, Dependabot)
* Use HTTPS in production
* Implement rate limiting for public APIs
* Use secure headers (helmet.js for Node.js)

## Documentation Standards

### JSDoc Comments

```typescript
/**
 * Formats a date according to the specified locale and options.
 *
 * @param date - The date to format
 * @param locale - The locale to use (defaults to 'en-US')
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate(new Date(), 'en-US', { dateStyle: 'long' })
 * // => "January 1, 2024"
 * ```
 */
export function formatDate(
  date: Date,
  locale = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
```

### README Requirements

Every project should have:
* Clear description of what the project does
* Installation instructions
* Usage examples
* API documentation (if applicable)
* Development setup guide
* Testing instructions
* Contributing guidelines
* License information

## Version Control

### Commit Message Format

Use conventional commits:
```
type(scope): subject

body

footer
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(auth): add OAuth2 authentication
fix(api): handle null responses in user endpoint
docs(readme): update installation instructions
test(utils): add tests for date formatting
```

### Branching Strategy

* `main` - production-ready code
* `develop` - integration branch
* `feature/*` - new features
* `fix/*` - bug fixes
* `hotfix/*` - urgent production fixes

## Framework-Specific Guidelines

### React Best Practices

* Use functional components with hooks (no class components)
* Keep components small and focused
* Extract custom hooks for reusable logic
* Use `memo` only when measured performance benefit exists
* Prefer composition over prop drilling (Context, component composition)
* Handle errors with Error Boundaries
* Use `key` prop correctly in lists (stable, unique IDs)

### Next.js Best Practices

* Use App Router (not Pages Router for new projects)
* Prefer Server Components by default, use Client Components only when needed
* Use `async`/`await` in Server Components for data fetching
* Implement proper error handling with `error.tsx`
* Use `loading.tsx` for loading states
* Optimize images with `next/image`
* Use dynamic imports for code splitting
* Configure proper caching with `revalidate` or `cache`
