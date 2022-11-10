/**
 * Accumulate emission of an async iterable into an array.
 *
 * Note that any values returned from the async iterable will NOT be included in the array. However, a
 * cleanup function, if any, returned will be called.
 */
export async function accumulate<T>(gen: AsyncIterable<T>): Promise<T[]> {
    const acc: T[] = [];

    for await (const emission of gen) {
        acc.push(emission);
    }

    return acc;
}

export async function* readableStreamLines(
    readableStream: NodeJS.ReadableStream
): AsyncGenerator<string> {
    for await (const tapBytes of readableStream) {
        if (!Buffer.isBuffer(tapBytes)) {
            throw new Error(
                `Didn't receive an array of bytes from TAPStream as expected`
            );
        }
        yield tapBytes.toString('utf-8');
    }
}
