import * as assert from 'assert';

suite('Formatter Test Suite', () => {

	test('Formatter::should', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});
