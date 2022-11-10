import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Context, IndentedCtx } from './context.js';

describe('IndentedCtx', () => {
    const fakePyCtx = new Context([
        'def my_py_method(arg)',
        '  arg_len = len(arg)',
        '  arg_type = type(arg)',
        '  ',
        '  return [arg_len, arg_type]',
        'val = my_py_method(1)',
    ]);

    const testIndentCtx = new IndentedCtx(fakePyCtx, 2);

    it('returns trimmed lines', () => {
        assert.equal(
            testIndentCtx.advanceLine(1).getLine(),
            'arg_len = len(arg)'
        );
    });

    it('is not marked as done on indented lines', () => {
        assert.equal(testIndentCtx.advanceLine(1).done(), false);
        assert.equal(testIndentCtx.advanceLine(1).done(), false);
        assert.equal(testIndentCtx.advanceLine(1).done(), false);
        assert.equal(testIndentCtx.advanceLine(1).done(), false);
    });

    it('marks itself as done when lines are no longer indented', () => {
        const lastLineCtx = testIndentCtx.advanceLine(4);
        assert.equal(lastLineCtx.getLine(), 'return [arg_len, arg_type]');
        assert.equal(lastLineCtx.advanceLine(1).done(), true);
    });

    it('completes when the indented block ends', () => {
        let blockLines: string[] = [];
        for (const ctx of testIndentCtx.advanceLine(1).iterLines()) {
            blockLines.push(ctx.getLine());
        }

        assert.deepStrictEqual(blockLines, [
            'arg_len = len(arg)',
            'arg_type = type(arg)',
            '',
            'return [arg_len, arg_type]',
        ]);
    });

    it('advances the line count with advance line', () => {
        const firstLine = testIndentCtx.getLine();
        const secondLine = testIndentCtx.advanceLine(1).getLine();
        const thirdLine = testIndentCtx.advanceLine(2).getLine();

        assert.notEqual(firstLine, secondLine);
        assert.notEqual(secondLine, thirdLine);
    });
});
