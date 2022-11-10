import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Context } from './context.js';
import { fail, isSuccess, success } from './parser.js';

describe('isSuccess', () => {
    const emptyCtx = new Context([]);

    it('passes with a successful value', () => {
        const parseSuccess = success(emptyCtx, true);
        assert.equal(isSuccess(parseSuccess), true);
    });

    const badValues = [
        null,
        1,
        {},
        { success: false },
        { success: 1 },
        'success',
        fail(emptyCtx, 'Definitely a fail'),
    ] as const;

    for (const badValue of badValues) {
        it(`marks non-successful results properly: \`${JSON.stringify(badValue)}\``, () => {
            assert.equal(isSuccess(badValue), false);
        });
    }
});
