/**
 * Using a runner for grammY allows your bot to run middleware concurrently.
 * This has the benefit that multiple messages can be processed concurrently,
 * hence making your bot drastically more scalable, but it comes at the cost
 * that race conditions may occur because some messages need to be processed in
 * order.
 *
 * The solution to this problem is by making sure that some updates wait for
 * others to be done processing before running their middleware. This can be
 * achieved by middleware.
 *
 * This function creates that middleware for you. You can pass in a constraint
 * function that determines what updates could clash, and you will be provided
 * by middleware that will ensure that clashes will not occur. A constraint is
 * simply a string that is derived from an update.
 *
 * As an example, you can use this constraint function to make sure that
 * messages inside the same chat are never processed concurrently:
 *
 * ```ts
 * // Correctly order updates with the same chat identifier
 * const constraint = (ctx: Context) => String(ctx.chat.id)
 *
 * bot.use(sequentialize(constraint))
 * ```
 *
 * It is possible to return an array of strings if multiple constraints should
 * hold, such as "process things inside the same chat in sequence, but also from
 * the same user across chats":
 * ```ts
 * const constraints = (ctx: Context) => [String(ctx.chat.id), String(ctx.from.id)]
 *
 * bot.use(sequentialize(constraints))
 * ```
 *
 * Sequentializing updates is especially important when using session middleware
 * in order to prevent write-after-read hazards. In this case, you should
 * provide the same function to determine constraints as you use to resolve the
 * session key.
 *
 * @param constraint Function that determines the constraints of an update
 * @returns Sequentializing middleware to be installed on the bot
 */
export declare function sequentialize<C>(constraint: (ctx: C) => string | string[] | undefined): (ctx: C, next: () => void | Promise<void>) => Promise<void>;
