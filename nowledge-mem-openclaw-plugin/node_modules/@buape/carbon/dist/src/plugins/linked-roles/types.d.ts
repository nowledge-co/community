/**
 * The type of metadata that you can check for
 */
export declare enum ApplicationRoleConnectionMetadataType {
    /**
     * The metadata value (`integer`) is less than or equal to the guild's configured value (`integer`)
     */
    IntegerLessThanOrEqual = 1,
    /**
     * The metadata value (`integer`) is greater than or equal to the guild's configured value (`integer`)
     */
    IntegerGreaterThanOrEqual = 2,
    /**
     * The metadata value (`integer`) is equal to the guild's configured value (`integer`)
     */
    IntegerEqual = 3,
    /**
     * The metadata value (`integer`) is not equal to the guild's configured value (`integer`)
     */
    IntegerNotEqual = 4,
    /**
     * The metadata value (`ISO8601 string`) is less than or equal to the guild's configured value (`integer`; days before current date)
     */
    DatetimeLessThanOrEqual = 5,
    /**
     * The metadata value (`ISO8601 string`) is greater than or equal to the guild's configured value (`integer`; days before current date)
     */
    DatetimeGreaterThanOrEqual = 6,
    /**
     * The metadata value (`integer`) is equal to the guild's configured value (`integer`; `1`)
     */
    BooleanEqual = 7,
    /**
     * The metadata value (`integer`) is not equal to the guild's configured value (`integer`; `1`)
     */
    BooleanNotEqual = 8
}
/**
 * The options for the linked roles package
 */
export type LinkedRolesOptions = {
    /**
     * The metadata that you want to check for, and that should show to the end-user on Discord.
     */
    metadata: LinkedRoleCriteria[];
    /**
     * The functions that you want to use to check the metadata.
     * @remarks
     * If you are checking a boolean, you should return `true` or `false`.
     * If you are checking an integer, you should return a number that is safe to use as an integer.
     * If you are checking a datetime, you should return a Date.now() timestamp.
     */
    metadataCheckers: {
        [name: string]: (userId: string) => Promise<number | boolean>;
    };
    /**
     * Whether the deploy route should be disabled.
     * @default false
     */
    disableDeployRoute?: boolean;
    /**
     * Whether the connect route should be disabled.
     * @default false
     */
    disableVerifyUserRoute?: boolean;
    /**
     * Whether the connect callback route should be disabled.
     * @default false
     */
    disableVerifyUserCallbackRoute?: boolean;
};
/**
 * The metadata that you want to check for, and that should show to the end-user on Discord.
 * @remarks You can only have 5 metadata per application, and they apply across all guilds your app is in.
 */
export type LinkedRoleCriteria = {
    /**
     * The key of the metadata. This is only used on the code side, and is not seen by the end user.
     */
    key: string;
    /**
     * The type of metadata that you want to check for.
     */
    type: ApplicationRoleConnectionMetadataType;
    /**
     * The name of the metadata. This is what the end user will see.
     */
    name: string;
    /**
     * A description of the metadata.
     */
    description: string;
};
//# sourceMappingURL=types.d.ts.map