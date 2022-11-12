# TAP 13 parser

This is a `--wip--` example parser for TAP 13 (and 14) documents implemented using a parser combinator.

## Why a parser combinator?

Parser combinators are a declarative approach to writing parsers that use function composition to build
complex parsers out of many simple pieces.

Parser combinators cleanly support heterogenous nested parsers.
The contract of a parser is simply that it returns `success` or `fail`.
The internal implementation of a parser can be almost anything. Simple cases can use `regexp` (see
`regexpLine` parser). More complicated parsers can internally use a traditional LL(k) parser or something else
suited to parsing the construct that it is written for.

These isolated, modular parsers are built up into more complex parsers for a grammar by combining them with
"combinators". For example, a tap document parser might look like:

```typescript
/**
 * Parse a structure like:
 * ```
 * not ok 14 - Description # todo Why it's todo
 *   ---
 *   duration_ms: 12.121
 *   error: testCodeFailure
 *   ...
 * ```
 */
const tapTest = sequence(
    tapTestTitle(),
    indentedBlock(
        delimitedBlock(
            { start: '---\n', end: '...\n' },
            nestedYamlDoc(),
        )
        2
    )
);

// A line in a tap document (after the version) could be a part of any one of these. Parsers will be tried in the order specified here.
const tapFragment = zeroOrManyOf(
    'tapFragment',
    anyOf('TAP Lines', tapTestPlanRange(), diagnostic(), tapTest(), bailOut())
);

// The document _must_ start with `TAP Version 13`, followed by other tap output
const tapDocument = sequence(tapVersion13, tapFragment);
```

Notice how parser and combinator here are highly modular. Compared to other approaches like a hand-rolled
LL(n) parser, this makes parser combinators very maintainable in practice.
Each parser or combinator is well-isolated and can be unit tested effectively with minimal side-effects on
other parsers.
For example, see [tap line parser tests](./src/parser-combinator/tap-line-parsers.test.ts) or [combinator tests](./src/parser-combinator/combinators.test.ts).

High quality error messaging is possible because line/column state is tracked via `Context`. Parsers are
responsible for advancing the line/column in context and returning a new context.

For example, here's the implementation of a full line Regexp parser that is used to build a lot of the simple
line parsers like `tapVersionParser`:

```typescript
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
```

Note the call to `advanceLine(1)` in the returned context. This means that the next parser will know to pick
up on the next line. By including `Context` and a message in the failure case, it is possible to render very
nice errors.

This `regexpLine` parser can be used to build more complex parsers like:

```typescript
export function tapVersion(expectedVersion: number): Parser<TapVersionToken> {
    const tapVersionRegexp = new RegExp(/^TAP version (\d{1,3})$/);
    const regexpParser = regexpLine(tapVersionRegexp, 'Not a TAP version');

    return mapSuccess(regexpParser, (parseResult) => {
        const { ctx, token } = parseResult;
        // This is the first/only capture group in the `tapVersionRegexp`
        const [tapVersionStr] = token.matches;
        const versionNum = Number.parseInt(tapVersionStr);

        const versionNumPosition = ctx.getLine().indexOf(tapVersionStr);
        if (versionNum !== expectedVersion) {
            return fail(
                ctx.advanceColumn(versionNumPosition),
                `Unexpected TAP version: Expected ${expectedVersion}, received ${versionNum}`
            );
        }

        return success(ctx, { version: versionNum, type: 'tapVersion' });
    });
}
```

By advancing the column, this parser has enough information to render an error like:
```
Error at line 1, column 12: Unexpected TAP version: Expected 13, received 12

TAP version 12
            ^
```

## How would streaming work?

This is somewhat uncharted territory but `AsyncGenerator`s seem like a good approach. Context can be modified
so that:

- `getLine` is async
- `iterLines` is an async generator

This would allow Context to accumulate a stream lazily, returning/yielding requested lines when a `\n`
character is encountered in its source decoded byte stream.
