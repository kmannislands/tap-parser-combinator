import { anyOf, sequence, zeroOrManyOf } from './combinators.js';
import { Context } from './context.js';
import { isSuccess, ParseError } from './parser.js';
import {
    diagnostic,
    tapTest,
    tapTestPlanRange,
    tapVersion13,
} from './tap-line-parsers.js';

const tapLine = zeroOrManyOf(
    'tapLine',
    anyOf('TAP Lines', tapTestPlanRange(), diagnostic(), tapTest())
);

const tapGrammar = sequence(tapVersion13, tapLine);

interface TapContents {
    version: 13;
    testPlan?: {
        start: number;
        through: number;
    };
    diagnostics: string[];
    tests: any[];
}

export async function parseTap(
    tapLines: string[] | NodeJS.ReadableStream
): Promise<TapContents | ParseError> {
    const context = Array.isArray(tapLines)
        ? new Context(tapLines)
        : await Context.fromStream(tapLines);

    const tapResults = await tapGrammar(context);

    let diagnostics: string[] = [];
    let testPlan: TapContents['testPlan'];
    let tests: TapContents['tests'] = [];

    if (!isSuccess(tapResults)) {
        return tapResults;
    }

    const [_versionToken, linesToken] = tapResults.token.tokens;

    for (const tapLine of linesToken.tokens) {
        switch (tapLine.type) {
            case 'diagnostic':
                diagnostics.push(tapLine.diagnostic);
                break;
            case 'testPlan':
                testPlan = {
                    start: tapLine.start,
                    through: tapLine.through,
                };
                break;
            case 'tapTest':
                tests.push(tapLine);
                break;
        }
    }

    return {
        version: 13,
        testPlan,
        diagnostics,
        tests,
    };
}
