// Compatibility source entry. Importing this module is intentionally inert;
// MPA hosts call bootReader() after installing their adapters.
export {
  bootReader,
  purgeLegacyMarkup,
  resolveReaderRoot,
  syncReaderBodyClasses,
} from "./boot.js";
export type { ReaderBootOptions } from "./boot.js";
