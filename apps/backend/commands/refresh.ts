import { disablePrettySymbols, enablePrettySymbols } from './toggle';

/** Disable then re-enable everything — a full refresh of all documents. */
export const refreshPage = (): void => {
  disablePrettySymbols();
  enablePrettySymbols();
};
