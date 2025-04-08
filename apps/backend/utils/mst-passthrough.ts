/**
 * A mobx-state-tree custom type that stores the value as-is: no snapshot
 * processing, no proxying. Used for Set/Map/sparse arrays and objects mutated
 * in place (e.g. vscode Range/TextDocument/Host instances).
 */
import { types as t } from "mobx-state-tree";

const identitySnapshot = <T,>(s: T): T => s;
const identityTarget = (): boolean => true;
const noValidation = (): string => "";

export const passthrough = <T,>(name: string) =>
	t.custom<T, T>({
		name,
		fromSnapshot: identitySnapshot,
		toSnapshot: identitySnapshot,
		isTargetType: identityTarget,
		getValidationMessage: noValidation,
	});
