/**
 * A mobx-state-tree custom type that stores the value as-is: no snapshot
 * processing, no proxying. Used for Set/Map/sparse arrays and objects mutated
 * in place (e.g. vscode Range/TextDocument/Host instances).
 */
import { types as t } from "mobx-state-tree";

const identitySnapshot = <T,>(s: T): T => s;

// mst freezes whatever a custom type hands back as its snapshot, and that would
// freeze the very object the value stands for (grammars, hosts, debounce state
// all mutate in place). A detached view keeps the stored value untouched.
const detachedView = <T>(value: T): T => (typeof value === "object" && value !== null ? { ...value } : value);

const identityTarget = (): boolean => true;
const noValidation = (): string => "";

export const passthrough = <T,>(name: string) =>
	t.custom<T, T>({
		name,
		fromSnapshot: identitySnapshot,
		toSnapshot: detachedView,
		isTargetType: identityTarget,
		getValidationMessage: noValidation,
	});
