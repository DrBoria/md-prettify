import * as assert from 'assert';
import { decorationOptionsFor } from '@md-prettify/utils';

suite('config', () => {
	suite('decorationOptionsFor', () => {
		test('the pretty text becomes the after-content', () => {
			const options = decorationOptionsFor('λ');
			assert.strictEqual(options.after?.contentText, 'λ');
			assert.strictEqual(options.rangeBehavior, 'ClosedClosed');
		});

		test('the rule style reaches the after options', () => {
			const options = decorationOptionsFor('AND', { color: 'blue', backgroundColor: 'green' });
			assert.strictEqual(options.color, 'blue');
			assert.strictEqual(options.backgroundColor, 'green');
		});

		test('hackCSS joins textDecoration', () => {
			const options = decorationOptionsFor('x', { textDecoration: 'underline', hackCSS: 'letter-spacing: 2px' });
			assert.ok(options.after?.textDecoration?.includes('underline; letter-spacing: 2px'));
		});

		test('a rule without style still gets the hiding hack', () => {
			const options = decorationOptionsFor('x');
			assert.ok(options.after?.textDecoration?.includes('visibility: visible'));
		});
	});
});
