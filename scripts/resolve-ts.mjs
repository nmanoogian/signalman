// Lets `node --test` load the app's extensionless relative imports, which Vite resolves for
// the browser build but Node's ESM loader does not. Registered via `--import`.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // Not a TypeScript module; fall through to the specifier as written.
      }
    }
    return next(specifier, context);
  },
});
