import assert from 'node:assert';
import { describe, it, run } from 'node:test';
import { parseTap } from './tap-parser.js';

describe('Integration', () => {
    it('works', async () => {
        const parseResult = await parseTap(['TAP version 13', '1..4']);

        assert.deepStrictEqual(parseResult, {
            version: 13,
            testPlan: { start: 1, through: 4 },
            tests: [],
            diagnostics: [],
        });
    });

    it('parses a TAP output with two successful test as expected', async () => {
        const testLines = [
            'TAP version 13',
            '1..2',
            '# Subtest: /Path/to/project/dist/some-test.test.js',
            'ok 1 - /Path/to/project/dist/some-test.test.js',
            '  ---',
            '  duration_ms: 61.432875',
            '  ...',
            '# Subtest: /Path/to/project/dist/a-second-test.test.js',
            'ok 2 - /Path/to/project/dist/a-second-test.test.js',
            '  ---',
            '  duration_ms: 63.843833',
            '  ...',
            '# tests 2',
            '# pass 2',
            '# fail 0',
            '# cancelled 0',
            '# skipped 0',
            '# todo 0',
            '# duration_ms 125.795667',
        ];

        const parseResult = await parseTap(testLines);

        assert.deepStrictEqual(parseResult, {
            version: 13,
            testPlan: { start: 1, through: 2 },
            diagnostics: [
                'Subtest: /Path/to/project/dist/some-test.test.js',
                'Subtest: /Path/to/project/dist/a-second-test.test.js'
            ],
            tests: [
                {
                    title: {
                        description:
                            '- /Path/to/project/dist/some-test.test.js',
                        diagnostic: undefined,
                        ok: true,
                        testNumber: 1,
                        type: 'tapTestTitle',
                    },
                    type: 'tapTest',
                    yamlDocContents: {
                        type: 'yamlDocLines',
                        yamlDocLines: ['duration_ms: 61.432875'],
                    },
                },
                {
                    title: {
                        description:
                            '- /Path/to/project/dist/a-second-test.test.js',
                        diagnostic: undefined,
                        ok: true,
                        testNumber: 2,
                        type: 'tapTestTitle',
                    },
                    type: 'tapTest',
                    yamlDocContents: {
                        type: 'yamlDocLines',
                        yamlDocLines: ['duration_ms: 63.843833'],
                    },
                },
            ],
        });
    });

    it('parses node.js 18-19 empty output as expected', async () => {
        const currentNodeVersion = Number.parseInt(process.version.slice(1));

        assert.equal(currentNodeVersion > 18, true);

        const emptyTestRunTAPStream = run({ timeout: 0 });

        const successParseResult = await parseTap(emptyTestRunTAPStream);

        const currentTestFilePath = import.meta.url.slice('file://'.length);

        return assert.deepStrictEqual(successParseResult, {
            version: 13,
            testPlan: undefined,
            diagnostics: [`Subtest: ${currentTestFilePath}`],
            tests: [],
        });
    });
});
