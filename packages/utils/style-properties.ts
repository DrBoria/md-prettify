import type { PrettyStyleProperties } from '@md-prettify/types';

/** Build the `textDecoration` value, appending the hack CSS if present */
const buildTextDecoration = (textDecoration: string | undefined, hackCSS: string | undefined): string | undefined => {
	if (textDecoration)
		return textDecoration + (hackCSS ? '; ' + hackCSS : "");
	if (hackCSS)
		return 'none; ' + hackCSS;
	return undefined;
};

/** Pick only the defined styling properties from a source style */
const definedStyleProperties = (source: PrettyStyleProperties): PrettyStyleProperties => {
	const decoration = buildTextDecoration(source.textDecoration, source.hackCSS);
	const properties: PrettyStyleProperties = {};
	if (source.backgroundColor) properties.backgroundColor = source.backgroundColor;
	if (source.border) properties.border = source.border;
	if (source.color) properties.color = source.color;
	if (decoration) properties.textDecoration = decoration;

	return properties;
};

/** Merge all defined styling properties from the source onto the target, returning a new object */
export function assignStyleProperties<T extends PrettyStyleProperties>(target: T, source: PrettyStyleProperties | undefined): T {
	const defined = source ? definedStyleProperties(source) : {};

	return { ...target, ...defined } as T;
}
