import assert from 'node:assert';
import { describe, it } from 'node:test';
import { anyOf, sequence } from './combinators.js';
import { Context } from './context.js';
import { Parser, success, fail, SyncParser, isSuccess } from './parser.js';

describe('Sequence combinator', () => {
    const failIfNotOneParser: Parser<{ type: 'fail'; token: true }> = (ctx) => {
        const { line } = ctx.logState();
        if (line !== 1) {
            return fail(ctx, `Test fail, line was ${line}`);
        }
        return success(ctx, { type: 'fail', token: true });
    };

    const twoLineEmptyCtx = new Context(['\n', '\n']);

    it('returns failure result from failing parsers', async () => {
        const sanityCheckParser = sequence(failIfNotOneParser);

        const parseResult = await sanityCheckParser(twoLineEmptyCtx);

        return assert.deepStrictEqual(
            parseResult,
            fail(twoLineEmptyCtx, 'Test fail, line was 0')
        );
    });

    it('Advances context between parsers', async () => {
        const advanceLineParser: Parser<{ type: 'advance'; token: true }> = (
            ctx
        ) => {
            return success(ctx.advanceLine(1), {
                type: 'advance',
                token: true,
            });
        };

        const testParser = sequence(advanceLineParser, failIfNotOneParser);
        const parseResult = await testParser(twoLineEmptyCtx);

        if (!isSuccess(parseResult)) {
            return assert.fail(JSON.stringify(parseResult));
        }

        const { tokens } = parseResult.token;

        assert.equal(tokens.length, 2);
        // all passed
        return assert.deepStrictEqual(tokens, [
            {
                token: true,
                type: 'advance',
            },
            {
                token: true,
                type: 'fail',
            },
        ]);
    });
});

describe('Any combinator', () => {
    const neverParser: SyncParser<never> = () => {
        throw new Error('shouldnt happen');
    };

    const failParser: SyncParser<never> = (ctx) => fail(ctx, 'Expect fail');

    const successParser: SyncParser<true> = (ctx) => {
        return success(ctx, true);
    };

    it('returns fail if all options fail', async () => {
        const emptyCtx = new Context(['\n']);

        const anyOfFail = anyOf('Any fail', failParser, failParser);

        const expectedFail = await anyOfFail(emptyCtx);

        assert.deepStrictEqual(
            expectedFail,
            fail(emptyCtx, 'Failed to match any parser in sequence "Any fail"')
        );
    });

    it('bails on the first parse success', async () => {
        const emptyCtx = new Context(['\n']);

        // should fail, call the 2nd parser and the neverParser is a tombstone that will err if called
        const anyOfFail = anyOf(
            'Any fail',
            failParser,
            successParser,
            neverParser
        );

        const expectedFail = await anyOfFail(emptyCtx);

        assert.deepStrictEqual(expectedFail, success(emptyCtx, true));
    });
});
