// `navigator.connection` is not in TypeScript's DOM lib. Only the one field the app consults
// is declared, and it stays optional because Safari does not implement any of it.
interface NetworkInformation {
  readonly saveData?: boolean;
}

interface Navigator {
  readonly connection?: NetworkInformation;
}
