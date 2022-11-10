import type { IContext } from './context.js';

// TODO base token?
export interface Token {
    type: string;
};

export interface ParseSuccess<Token> {
    token: Token;
    success: true;
    ctx: IContext;
}

export interface ParseError {
    success: false;
    message: string;
    ctx: IContext;
}

export type ParseResult<T> = ParseSuccess<T> | ParseError;

export type SyncParser<T> = (ctx: IContext) => ParseResult<T>;
export type AsyncParser<T> = (ctx: IContext) => Promise<ParseResult<T>>;
export type Parser<T> = SyncParser<T> | AsyncParser<T>;

export function isSuccess(maybe: unknown): maybe is ParseSuccess<unknown> {
    if (typeof maybe === 'object' && maybe) {
        return 'success' in maybe && (maybe as any).success === true;
    }

    return false;
}

export function success<T>(ctx: IContext, token: T): ParseSuccess<T> {
    return {
        success: true,
        ctx,
        token,
    };
}

export function fail(ctx: IContext, message: string): ParseError {
    return {
        success: false,
        ctx,
        message,
    };
}
