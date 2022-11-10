import { accumulate, readableStreamLines } from '../generator-util.js';

export interface IContext {
    logState(): { line: number; column: number };

    done(): boolean;

    iterLines(): Generator<IContext>;

    getLine(): string;

    advanceLine(lines: number): IContext;
}

export class Context implements IContext {
    public static async fromStream(
        lineIterable: NodeJS.ReadableStream
    ): Promise<Context> {
        const emptyTapResult = await accumulate(
            readableStreamLines(lineIterable)
        );

        const trimmedLines = emptyTapResult.map((line) => line.trimEnd());

        return new Context(trimmedLines);
    }

    constructor(
        private readonly contents: Readonly<string[]>,
        private readonly line: number = 0,
        private readonly column: number = 0
    ) {}

    public logState(): { line: number; column: number } {
        return {
            line: this.line,
            column: this.column,
        };
    }

    public done(): boolean {
        return this.line >= this.contents.length;
    }

    public getLine(): string {
        return this.contents[this.line];
    }

    public advanceLine(lines: number): Context {
        // TODO bounds check
        return new Context(this.contents, this.line + lines, 0);
    }

    public *iterLines(): Generator<Context> {
        for (let i = this.line; i < this.contents.length; i++) {
            yield new Context(this.contents, i, 0);
        }
    }
}

export class IndentedCtx implements IContext {
    private indentChars: string;

    constructor(
        private readonly parentContext: IContext,
        private readonly indentLevel: number,
    ) {
        // could be slow
        this.indentChars = Array.from({ length: indentLevel }).fill(' ').join('');
    }

    public logState(): { line: number; column: number } {
        const parentCtxState = this.parentContext.logState();
        return {
            line: parentCtxState.line,
            column: parentCtxState.column + this.indentLevel,
        };
    }

    public advanceLine(lines: number): IndentedCtx {
        return new IndentedCtx(this.parentContext.advanceLine(lines), this.indentLevel);
    }

    public getLine(): string {
        const unindentedLine = this.parentContext.getLine();

        return unindentedLine.slice(this.indentLevel);
    }

    public done(): boolean {
        const unindentedLine = this.parentContext.getLine();
        return !unindentedLine.startsWith(this.indentChars);
    }

    public *iterLines(): Generator<IndentedCtx> {
        for (const parentCtx of this.parentContext.iterLines()) {
            const newIndentedCtx = new IndentedCtx(parentCtx, this.indentLevel);
            if (newIndentedCtx.done()) {
                break;
            }
            yield newIndentedCtx;
        }
    }
}
