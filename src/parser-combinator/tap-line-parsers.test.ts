import { it, describe } from 'node:test';
import assert from 'node:assert';
import {
    diagnostic,
    tapTest,
    tapTestPlanRange,
    tapTestTitle,
    tapVersion13,
} from './tap-line-parsers.js';
import { Context } from './context.js';
import { fail, isSuccess } from './parser.js';

describe('TAP version', async () => {
    it(`fails with a specific error on version mismatch`, async () => {
        const testCtx = new Context(['TAP version 12']);
        const result = await tapVersion13(testCtx);

        assert.deepStrictEqual(
            result,
            fail(
                testCtx.advanceLine(1),
                'Unexpected TAP version: Expected 13, received 12'
            )
        );
    });

    const badStrings = [
        '',
        '\n',
        'TAP version\n',
        'TAP version 13.0\n',
    ] as const;

    for (const str of badStrings) {
        it(`fails with an unexpected TAP version string "${str}"`, async () => {
            const testCtx = new Context([str]);
            const result = await tapVersion13(testCtx);

            assert.deepStrictEqual(result, fail(testCtx, 'Not a TAP version'));
        });
    }
});

describe('TAP test plan', () => {
    it('parses a simple test plan from the docs correctly', async () => {
        const ctx = new Context(['1..2']);
        const tapPlanParser = tapTestPlanRange();

        const tapPlanResult = await tapPlanParser(ctx);

        if (!isSuccess(tapPlanResult)) {
            return assert.fail(tapPlanResult.message);
        }

        return assert.deepStrictEqual(tapPlanResult.token, {
            start: 1,
            through: 2,
            type: 'testPlan',
        });
    });
});

describe('diagnostic line', () => {
    it('parses an example from the docs as expected', async () => {
        const ctx = new Context(['# Diagnostic contents!']);
        const diagnosticParser = diagnostic();

        const diagnosticResult = await diagnosticParser(ctx);

        if (!isSuccess(diagnosticResult)) {
            return assert.fail(diagnosticResult.message);
        }

        return assert.deepStrictEqual(diagnosticResult.token, {
            diagnostic: 'Diagnostic contents!',
            type: 'diagnostic',
        });
    });
});

describe('tapTestTitle', () => {
    const cases = [
        {
            line: 'ok 1 - /Path/to/project/dist/parser-combinator/combinators.test.js',
            expectation: {
                ok: true,
                testNumber: 1,
                description:
                    '- /Path/to/project/dist/parser-combinator/combinators.test.js',
            },
        },
        {
            line: 'ok this is the description of the test',
            expectation: {
                ok: true,
                description: 'this is the description of the test',
            },
        },
        {
            line: 'ok 42 this is the description of the test',
            expectation: {
                ok: true,
                testNumber: 42,
                description: 'this is the description of the test',
            },
        },
        {
            line: 'ok 42 this is the description of the test # todo',
            expectation: {
                ok: true,
                testNumber: 42,
                description: 'this is the description of the test',
                diagnostic: 'todo',
            },
        },
        {
            line: 'ok this is the description of the test # skip',
            expectation: {
                ok: true,
                description: 'this is the description of the test',
                diagnostic: 'skip',
            },
        },
        {
            line: 'ok # skip',
            expectation: {
                ok: true,
                diagnostic: 'skip',
            },
        },
        {
            line: 'not ok # todo',
            expectation: {
                ok: false,
                diagnostic: 'todo',
            },
        },
    ] as const;

    for (const { line, expectation } of cases) {
        it(`parses test case "${line}" to ${JSON.stringify(
            expectation
        )}`, () => {
            const testCtx = new Context([line]);
            const testTitleParser = tapTestTitle();
            const result = testTitleParser(testCtx);

            if (!isSuccess(result)) {
                assert.fail(
                    `Expected to parse line: "${line}" but failed with message "${result.message}"`
                );
            }

            const optionalProps = {
                diagnostic: undefined,
                description: undefined,
                testNumber: undefined,
            };
            const normalizedExpecation = {
                ...optionalProps,
                type: 'tapTestTitle',
                ...expectation,
            };
            assert.deepStrictEqual(result?.token, normalizedExpecation);
        });
    }
});

describe('tapTest', () => {
    it('parses a successful test as expected', async () => {
        const tapTestParser = tapTest();
        const testCtx = new Context([
            // TODO handle diagnostics
            // '# Subtest: parses test case "ok this is the description of the test # skip" to {"ok":true,"description":"this is the description of the test","diagnostic":"skip"}',
            'ok 5 - parses test case "ok this is the description of the test # skip" to {"ok":true,"description":"this is the description of the test","diagnostic":"skip"}',
            '  ---',
            '  duration_ms: 0.256792',
            '  ...',
        ]);
        const parseResult = await tapTestParser(testCtx);

        if (!isSuccess(parseResult)) {
            return assert.fail(parseResult.message);
        }

        return assert.deepStrictEqual(
            parseResult.token.yamlDocContents.yamlDocLines,
            ['duration_ms: 0.256792']
        );
    });

    it('does not fail on more indented lines', async () => {
        const tapTestParser = tapTest();
        const testCtx = new Context([
            // TODO handle diagnostics
            // '# Subtest: parses test case "ok this is the description of the test # skip" to {"ok":true,"description":"this is the description of the test","diagnostic":"skip"}',
            'ok 5 - parses test case "ok this is the description of the test # skip" to {"ok":true,"description":"this is the description of the test","diagnostic":"skip"}',
            '  ---',
            '  duration_ms: 0.256792',
            "  failureType: 'testCodeFailure'",
            '  error: |-',
            '    Expected values to be strictly deep-equal:',
            '    + actual - expected',
            '    + {}',
            '    - []',
            "  code: 'ERR_ASSERTION'",
            '  stack: |-',
            '    Object.<anonymous> (file:///foo/bar.test.js:143:16)',
            '    async ItTest.run (node:internal/test_runner/test:512:9)',
            '    async Promise.all (index 0)',
            '    async Suite.run (node:internal/test_runner/test:739:7)',
            '  ...',
        ]);
        const parseResult = await tapTestParser(testCtx);

        if (!isSuccess(parseResult)) {
            return assert.fail(parseResult.message);
        }

        return assert.deepStrictEqual(
            parseResult.token.yamlDocContents.yamlDocLines,
            [
                'duration_ms: 0.256792',
                "failureType: 'testCodeFailure'",
                'error: |-',
                '  Expected values to be strictly deep-equal:',
                '  + actual - expected',
                '  + {}',
                '  - []',
                "code: 'ERR_ASSERTION'",
                'stack: |-',
                '  Object.<anonymous> (file:///foo/bar.test.js:143:16)',
                '  async ItTest.run (node:internal/test_runner/test:512:9)',
                '  async Promise.all (index 0)',
                '  async Suite.run (node:internal/test_runner/test:739:7)',
            ]
        );
    });
});
