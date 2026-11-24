import * as assert from 'assert';
import { groupAndMergeTokensByScope } from '@md-prettify/utils';
import type { IToken } from 'vscode-textmate';

const tok = (startIndex: number, endIndex: number, ...scopes: string[]): IToken => ({ startIndex, endIndex, scopes });

suite('text-mate pure helpers', () => {
	test('groupAndMergeTokensByScope merges touching ranges but keeps gapped ones separate', () => {
		const tokens = [tok(0, 4, 'a', 'x'), tok(4, 8, 'a'), tok(10, 14, 'a')];
		const grouped = groupAndMergeTokensByScope(tokens);
		// (0,4) and (4,8) touch and merge to (0,8); (10,14) has a gap (8..10) and stays separate
		assert.deepStrictEqual(grouped['a'], [
			{ startIndex: 0, endIndex: 8 },
			{ startIndex: 10, endIndex: 14 },
		]);
		assert.deepStrictEqual(grouped['x'], [{ startIndex: 0, endIndex: 4 }]);
		assert.deepStrictEqual(groupAndMergeTokensByScope([]), {});
	});
});
