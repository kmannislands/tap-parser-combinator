import { mapSuccess, sequence } from './combinators.js';
import { IndentedCtx } from './context.js';
import {
    fail,
    isSuccess,
    Parser,
    success,
    SyncParser,
    Token,
} from './parser.js';

interface TapVersionToken extends Token {
    type: 'tapVersion';
    version: number;
}

interface RegexpToken extends Token {
    type: 'regexpMatch';
    matches: string[];
}

function regexpLine(
    regexp: RegExp,
    errorMessage: string
): SyncParser<RegexpToken> {
    return (ctx) => {
        const execResults = regexp.exec(ctx.getLine());

        if (!execResults) {
            return fail(ctx, errorMessage);
        }

        const [_originalString, ...capturedGroups] = execResults;

        return success(ctx.advanceLine(1), {
            matches: capturedGroups,
            type: 'regexpMatch',
        });
    };
}

export function tapVersion(expectedVersion: number): Parser<TapVersionToken> {
    const tapVersionRegexp = new RegExp(/^TAP version (\d{1,3})$/);
    const regexpParser = regexpLine(tapVersionRegexp, 'Not a TAP version');

    return mapSuccess(regexpParser, (parseResult) => {
        const { ctx, token } = parseResult;
        // This is the first/only capture group in the `tapVersionRegexp`
        const [tapVersionStr] = token.matches;
        const versionNum = Number.parseInt(tapVersionStr);

        if (versionNum !== expectedVersion) {
            return fail(
                ctx,
                `Unexpected TAP version: Expected ${expectedVersion}, received ${versionNum}`
            );
        }

        return success(ctx, { version: versionNum, type: 'tapVersion' });
    });
}

export const tapVersion13 = tapVersion(13);

interface TapPlanToken extends Token {
    type: 'testPlan';
    start: number;
    through: number;
}

export function tapTestPlanRange(): Parser<TapPlanToken> {
    const tapPlanRegexp = new RegExp(/^(\d+)\.\.(\d+)$/);
    return mapSuccess(
        regexpLine(tapPlanRegexp, 'Not a test plan'),
        ({ token, ctx }) => {
            const [startStr, throughStr] = token.matches;

            const start = Number.parseInt(startStr);
            const through = Number.parseInt(throughStr);

            return success(ctx, { start, through, type: 'testPlan' });
        }
    );
}

interface DiagnosticToken extends Token {
    type: 'diagnostic';
    diagnostic: string;
}

export function diagnostic(): Parser<DiagnosticToken> {
    const diagnosticLine = new RegExp(/^# (.+)/);

    return mapSuccess(
        regexpLine(diagnosticLine, 'Not a diagnostic line'),
        ({ token, ctx }) => {
            const [diagnosticStr] = token.matches;

            return success(ctx, {
                diagnostic: diagnosticStr,
                type: 'diagnostic',
            });
        }
    );
}

interface TapTestTitleToken extends Token {
    type: 'tapTestTitle';
    ok: boolean;
    testNumber?: number;
    description?: string;
    diagnostic?: 'todo' | 'skip';
}

export function tapTestTitle(): SyncParser<TapTestTitleToken> {
    const tapTestLineRegexp = new RegExp(
        '(ok|not ok) (\\d* )?([^#]+)?(?:# )?(todo|skip)?'
    );
    const tapTestLineParser = regexpLine(
        tapTestLineRegexp,
        'Not a tap test result line'
    );

    return mapSuccess(tapTestLineParser, ({ ctx, token }) => {
        const { matches } = token;
        const [maybeOk, testNumberStr, description, diagnostic] = matches;
        const ok = maybeOk === 'ok';
        const testNumber = testNumberStr
            ? Number.parseInt(testNumberStr)
            : undefined;
        const trimmedDescription = description
            ? description.trimEnd()
            : undefined;

        if (diagnostic && !(diagnostic === 'skip' || diagnostic === 'todo')) {
            return fail(
                ctx,
                `Unexpected test diagnostic value "${diagnostic}", only "todo" and "skip" are valid`
            );
        }

        return success(ctx, {
            type: 'tapTestTitle',
            ok,
            testNumber,
            description: trimmedDescription,
            diagnostic: diagnostic as any,
        });
    });
}

interface TapTestToken extends Token {
    type: 'tapTest';
    title: TapTestTitleToken;
    yamlDocContents: TempYamlDocToken;
}

export function tapTest(): Parser<TapTestToken> {
    const tapTestSequence = sequence(
        tapTestTitle(),
        indentedBlock(nestedYamlDoc(), 2)
    );

    return async (ctx) => {
        const seqResults = await tapTestSequence(ctx);

        if (!isSuccess(seqResults)) {
            return seqResults;
        }

        const [title, yamlDocContents] = seqResults.token.tokens;

        return success(seqResults.ctx, { type: 'tapTest', title, yamlDocContents });
    };
}

function indentedBlock<T extends Token>(
    parser: SyncParser<T>,
    indentLevel: number
): SyncParser<T> {
    return (ctx) => {
        const indentedCtx = new IndentedCtx(ctx, indentLevel);
        const parseResult = parser(indentedCtx);

        return parseResult;
    };
}

interface TempYamlDocToken extends Token {
    type: 'yamlDocLines';
    yamlDocLines: string[];
}

/**
 * @todo abstract away 'delimited context'
 */
function nestedYamlDoc(
    yamlLineLimit: number = 10_000
): SyncParser<TempYamlDocToken> {
    return (ctx) => {
        const yamlStartSeparator = ctx.getLine();

        if (yamlStartSeparator !== '---') {
            return fail(
                ctx,
                `Expected a TAP YAML document separator ("---") but received ${yamlStartSeparator}`
            );
        }

        const yamlDocLines: string[] = [];

        for (const lineCtx of ctx.advanceLine(1).iterLines()) {
            const yamlDocLine = lineCtx.getLine();

            if (yamlDocLine === '...' ) {
                return success(lineCtx, {
                    type: 'yamlDocLines',
                    yamlDocLines,
                });
            }

            yamlDocLines.push(yamlDocLine);
        }

        return fail(
            ctx,
            `Didn't encounter a YAML line delimiter before configured limit of ${yamlLineLimit} lines.`
        );
    };
}
