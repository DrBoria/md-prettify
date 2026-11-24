const fs = require('fs');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const utils = require('/home/legion/Documents/fun/md-prettify/packages/utils/out/index.js');

const cfgPath = process.argv[2];
const srcPath = process.argv[3];
const raw = fs.readFileSync(cfgPath, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
const entry = JSON.parse(raw);
const grammarPath = '/var/home/linuxbrew/.linuxbrew/Caskroom/visual-studio-code-linux/1.132.0/VSCode-linux-x64/resources/app/extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json';

async function main() {
	const onigLib = await utils.loadOnigLib(oniguruma, () => {}, (e) => console.error(e));
	const registry = new vsctm.Registry({ onigLib, loadGrammar: async (s) => (s === 'source.ts' ? vsctm.parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), grammarPath) : null) });
	const grammar = await registry.loadGrammar('source.ts');
	const text = fs.readFileSync(srcPath, 'utf8');
	const lines = text.split('\n');
	const rules = utils.compiledRulesOf(entry, 'typescript');
	const excluded = new Set(entry.excludedScopes ?? []);
	let stack = null;
	for (let i = 0; i < lines.length; i++) {
		const parsed = grammar.tokenizeLine(lines[i], stack);
		stack = parsed.ruleStack;
		const spans = utils.spansOfLine(lines[i], i, parsed.tokens, rules, excluded, entry.textMateInitialScope ?? 'source.ts');
		if (!spans.length) continue;
		console.log(`L${i + 1}: ${lines[i]}`);
		for (const s of spans) {
			const rule = rules.find((r) => utils.getDecorationCacheKey(r) === s.key);
			const textOf = lines[i].slice(s.span.start.character, s.span.end.character);
			const scopes = new Set();
			for (const token of parsed.tokens) {
				if (token.endIndex <= s.span.start.character || token.startIndex >= s.span.end.character) continue;
				for (const sc of token.scopes) scopes.add(sc);
			}
			console.log(`   matches ${JSON.stringify(textOf)} by ${String(rule.ugly)} rendered=${JSON.stringify(s.pretty)}`);
			console.log(`      token scopes: ${[...scopes].join(' ')}`);
		}
	}
}
main().catch((e) => { console.error(e); process.exit(1); });
