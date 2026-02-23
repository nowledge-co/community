/**
 * Split a text by multiple separators, and return a result of the text and separators.
 * For example, `splitText("Hello <and> world [then] !", ["<and>", "[then]"])`
 *   will return `["Hello ", new Separator("<and>"), " world ", new Separator("[then]"), " !"]`
 */
export declare function splitText<const S extends string>(text: string, separators: readonly S[]): (string | {
    [Sep in S]: Separator<Sep>;
}[S])[];
export declare class Separator<S extends string> {
    readonly separator: S;
    private constructor();
}
