import {
    fail,
    isSuccess,
    Parser,
    ParseResult,
    ParseSuccess,
    success,
    SyncParser,
    Token,
} from './parser.js';

interface SequenceToken<Tokens extends Token[]> {
    type: 'sequence';
    tokens: Tokens;
}

export function sequence<T1 extends Token, T2 extends Token>(
    ...parsers: [Parser<T1>, Parser<T2>]
): Parser<SequenceToken<[T1, T2]>>;
export function sequence<T1 extends Token>(
    ...parsers: [Parser<T1>]
): Parser<SequenceToken<[T1]>>;
export function sequence<Tokens extends Token[]>(
    ...parsers: Parser<Tokens[number]>[]
): Parser<SequenceToken<Tokens>> {
    return async (initialCtx) => {
        let lastCtx = initialCtx;
        let tokens = [] as unknown as Tokens;

        for (const parser of parsers) {
            const parseResult = await parser(lastCtx);

            if (!isSuccess(parseResult)) {
                return parseResult;
            }

            tokens.push(parseResult.token);
            lastCtx = parseResult.ctx;
        }

        return success(lastCtx, { type: 'sequence', tokens });
    };
}

export function mapSuccess<T1, T2>(
    parserOne: SyncParser<T1>,
    mapFunction: (parseResult: ParseSuccess<T1>) => ParseResult<T2>
): SyncParser<T2> {
    return (ctx) => {
        const parseResult = parserOne(ctx);
        if (!isSuccess(parseResult)) {
            return parseResult;
        }
        return mapFunction(parseResult);
    };
}

export function anyOf<T1, T2, T3>(
    sequenceName: string,
    ...parsers: [Parser<T1>, Parser<T2>, Parser<T3>]
): Parser<T1 | T2 | T3>;
export function anyOf<T1, T2>(
    sequenceName: string,
    ...parsers: [Parser<T1>, Parser<T2>]
): Parser<T1 | T2>;
export function anyOf(
    sequenceName: string,
    ...parsers: Parser<any>[]
): Parser<any> {
    return async (ctx) => {
        for (const parser of parsers) {
            const maybeParseResult = await parser(ctx);
            if (isSuccess(maybeParseResult)) {
                return maybeParseResult;
            }
        }
        // TODO: some way to note what context was scanned?
        return fail(
            ctx,
            `Failed to match any parser in sequence "${sequenceName}"`
        );
    };
}

interface ZeroOrManyToken<TokenType extends string, SubToken extends Token>
    extends Token {
    type: TokenType;
    tokens: SubToken[];
}

export function zeroOrManyOf<TokenName extends string, T extends Token>(
    tokenType: TokenName,
    parser: Parser<T>,
    iterLimit: number = 500
): Parser<ZeroOrManyToken<TokenName, T>> {
    return async (initCtx) => {
        let tokens: T[] = [];
        let currentCtx = initCtx;
        let numIters = 0;
        while (!currentCtx.done() && numIters < iterLimit) {
            numIters++;
            const parseResult = await parser(currentCtx);
            if (!isSuccess(parseResult)) {
                return success(parseResult.ctx, { type: tokenType, tokens });
            }
            tokens.push(parseResult.token);

            currentCtx = parseResult.ctx;
        }
        return success(currentCtx, { type: tokenType, tokens });
    };
}
