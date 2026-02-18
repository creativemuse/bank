/**
 * Type declaration for react/jsx-runtime so TypeScript resolves it when using
 * "jsx": "react-jsx" with moduleResolution "bundler" (e.g. pnpm + Next.js).
 * Ensures the compiler can find the module path required by the automatic JSX transform.
 */
declare module "react/jsx-runtime" {
  import type { ReactNode } from "react";
  export const Fragment: symbol;
  export function jsx(type: unknown, props: unknown, key?: string | number): ReactNode;
  export function jsxs(type: unknown, props: unknown, key?: string | number): ReactNode;
}
