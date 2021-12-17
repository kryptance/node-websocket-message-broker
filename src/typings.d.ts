import {MultiMap} from 'collections'

declare class MultiMap<A, B> {
    add(B, A);

    delete(A);

    keys(): A[];

    values(): B[];

    entries(): [A, B][];

    has(A): boolean;

    get(A): B[];

    add(value, key)
}
