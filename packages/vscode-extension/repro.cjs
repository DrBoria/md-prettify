const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const utils = require('/home/legion/Documents/fun/md-prettify/packages/utils/out/index.js');

// the example config is JSONC: strip the line comments and trailing commas
const raw = fs.readFileSync('/home/legion/Documents/fun/md-prettify/examples/typescript-to-python.json', 'utf8')
	.replace(/^\s*\/\/.*$/gm, '')
	.replace(/,(\s*[}\]])/g, '$1');
const entry = JSON.parse(raw);

const grammarPath = '/var/home/linuxbrew/.linuxbrew/Caskroom/visual-studio-code-linux/1.132.0/VSCode-linux-x64/resources/app/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json';

async function main() {
	const onigLib = await utils.loadOnigLib(oniguruma, () => {}, (m, e) => console.error(m, e));
	const registry = new vsctm.Registry({
		onigLib,
		loadGrammar: async (scopeName) => {
			if (scopeName !== 'source.ts') return null;
			return vsctm.parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath);
		},
	});
	const grammar = await registry.loadGrammar('source.ts');
	const text = fs.readFileSync(process.argv[2], 'utf8');
	const lines = text.split('\n');
	const rules = utils.compiledRulesOf(entry, 'typescript');
	const excluded = new Set(entry.excludedScopes ?? []);
	const scope = entry.textMateInitialScope ?? 'source.ts';
	const prettySpans = new Map();
	for (const rule of rules) prettySpans.set(utils.getDecorationCacheKey(rule), { pretty: rule.pretty, ranges: new Set() });
	let stack = null;
	for (let i = 0; i < lines.length; i++) {
		const parsed = grammar.tokenizeLine(lines[i], stack);
		stack = parsed.ruleStack;
		for (const found of utils.spansOfLine(lines[i], i, parsed.tokens, rules, excluded, scope)) {
			const bucket = prettySpans.get(found.key);
			if (bucket) bucket.ranges.add(found.span);
		}
	}
	const doc = {
		uri: 'file:///repro.ts',
		languageId: 'typescript',
		fileName: 'repro.ts',
		isClosed: false,
		lineCount: lines.length,
		text,
		lineStarts: utils.lineStartsOf(text),
	};
	for (let i = 0; i < lines.length; i++) {
		const range = utils.rangeFrom(i, 0, i, lines[i].length);
		const decorated = utils.getDecoratedText(prettySpans, doc, range);
		console.log(String(i + 1).padStart(2), '|', decorated);
	}
}
main().catch((e) => { console.error(e); process.exit(1); });
