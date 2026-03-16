// file: test/setup.ts
// Global test setup: extends expect with DOM matchers.
// Configures jsdom environment for component testing.
// Used by: vitest.config via setupFiles.
// Import this nowhere - vitest loads it automatically.

import '@testing-library/jest-dom/vitest';
