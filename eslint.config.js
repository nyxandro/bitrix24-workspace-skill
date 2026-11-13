import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Базовые рекомендованные правила JS + TypeScript для src/.
// skills/** — упакованный контент скилла с генерируемым бандлом scripts/b24.cjs.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'skills/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
