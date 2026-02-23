import { type CopyTextButton, type InlineKeyboardButton, type KeyboardButton, type KeyboardButtonPollType, type KeyboardButtonRequestChat, type KeyboardButtonRequestUsers, type LoginUrl, type SwitchInlineQueryChosenChat, type WebAppInfo } from "../types.js";
type KeyboardButtonSource = string | KeyboardButton;
type KeyboardSource = KeyboardButtonSource[][] | Keyboard;
/**
 * Use this class to simplify building a custom keyboard (something like this:
 * https://core.telegram.org/bots/features#keyboards).
 *
 * ```ts
 * // Build a custom keyboard:
 * const keyboard = new Keyboard()
 *   .text('A').text('B').row()
 *   .text('C').text('D')
 *
 * // Now you can send it like so:
 * await ctx.reply('Here is your custom keyboard!', {
 *   reply_markup: keyboard
 * })
 * ```
 *
 * If you already have some source data which you would like to turn into a
 * keyboard button object, you can use the static equivalents which every button
 * has. You can use them to create a two-dimensional keyboard button array. The
 * resulting array can be turned into a keyboard instance.
 *
 * ```ts
 * const button = Keyboard.text('push my buttons')
 * const array = [[button]]
 * const keyboard = Keyboard.from(array)
 * ```
 *
 * If you want to create text buttons only, you can directly use a
 * two-dimensional string array and turn it into a keyboard.
 *
 * ```ts
 * const data = [['A', 'B'], ['C', 'D']]
 * const keyboard = Keyboard.from(data)
 * ```
 *
 * Be sure to check out the
 * [documentation](https://grammy.dev/plugins/keyboard#custom-keyboards) on
 * custom keyboards in grammY.
 */
export declare class Keyboard {
    readonly keyboard: KeyboardButton[][];
    /**
     * Requests clients to always show the keyboard when the regular keyboard is
     * hidden. Defaults to false, in which case the custom keyboard can be
     * hidden and opened with a keyboard icon.
     */
    is_persistent?: boolean;
    /**
     * Show the current keyboard only to those users that are mentioned in the
     * text of the message object.
     */
    selective?: boolean;
    /**
     * Hide the keyboard after a button is pressed.
     */
    one_time_keyboard?: boolean;
    /**
     * Resize the current keyboard according to its buttons. Usually, this will
     * make the keyboard smaller.
     */
    resize_keyboard?: boolean;
    /**
     * Placeholder to be shown in the input field when the keyboard is active.
     */
    input_field_placeholder?: string;
    /**
     * Initialize a new `Keyboard` with an optional two-dimensional array of
     * `KeyboardButton` objects. This is the nested array that holds the custom
     * keyboard. It will be extended every time you call one of the provided
     * methods.
     *
     * @param keyboard An optional initial two-dimensional button array
     */
    constructor(keyboard?: KeyboardButton[][]);
    /**
     * Allows you to add your own `KeyboardButton` objects if you already have
     * them for some reason. You most likely want to call one of the other
     * methods.
     *
     * @param buttons The buttons to add
     */
    add(...buttons: KeyboardButton[]): this;
    /**
     * Adds a 'line break'. Call this method to make sure that the next added
     * buttons will be on a new row.
     *
     * You may pass a number of `KeyboardButton` objects if you already have the
     * instances for some reason. You most likely don't want to pass any
     * arguments to `row`.
     *
     * @param buttons A number of buttons to add to the next row
     */
    row(...buttons: KeyboardButton[]): this;
    /**
     * Adds a new text button. This button will simply send the given text as a
     * text message back to your bot if a user clicks on it.
     *
     * @param text The text to display, and optional styling information
     * @param options Optional styling information
     */
    text(text: string, options?: KeyboardButton.CommonButton["style"] | Omit<KeyboardButton.CommonButton, "text">): this;
    /**
     * Creates a new text button. This button will simply send the given text as
     * a text message back to your bot if a user clicks on it.
     *
     * @param text The text to display, and optional styling information
     * @param options Optional styling information
     */
    static text(text: string, options?: KeyboardButton.CommonButton["style"] | Omit<KeyboardButton.CommonButton, "text">): KeyboardButton.CommonButton;
    /**
     * Adds a new request users button. When the user presses the button, a list
     * of suitable users will be opened. Tapping on any number of users will
     * send their identifiers to the bot in a “users_shared” service message.
     * Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param requestId A signed 32-bit identifier of the request
     * @param options Options object for further requirements
     */
    requestUsers(text: string | KeyboardButton.CommonButton, requestId: number, options?: Omit<KeyboardButtonRequestUsers, "request_id">): this;
    /**
     * Creates a new request users button. When the user presses the button, a
     * list of suitable users will be opened. Tapping on any number of users
     * will send their identifiers to the bot in a “users_shared” service
     * message. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param requestId A signed 32-bit identifier of the request
     * @param options Options object for further requirements
     */
    static requestUsers(text: string | KeyboardButton.CommonButton, requestId: number, options?: Omit<KeyboardButtonRequestUsers, "request_id">): KeyboardButton.RequestUsersButton;
    /**
     * Adds a new request chat button. When the user presses the button, a list
     * of suitable users will be opened. Tapping on a chat will send its
     * identifier to the bot in a “chat_shared” service message. Available in
     * private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param requestId A signed 32-bit identifier of the request
     * @param options Options object for further requirements
     */
    requestChat(text: string | KeyboardButton.CommonButton, requestId: number, options?: Omit<KeyboardButtonRequestChat, "request_id">): this;
    /**
     * Creates a new request chat button. When the user presses the button, a
     * list of suitable users will be opened. Tapping on a chat will send its
     * identifier to the bot in a “chat_shared” service message. Available in
     * private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param requestId A signed 32-bit identifier of the request
     * @param options Options object for further requirements
     */
    static requestChat(text: string | KeyboardButton.CommonButton, requestId: number, options?: Omit<KeyboardButtonRequestChat, "request_id">): KeyboardButton.RequestChatButton;
    /**
     * Adds a new contact request button. The user's phone number will be sent
     * as a contact when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    requestContact(text: string | KeyboardButton.CommonButton): this;
    /**
     * Creates a new contact request button. The user's phone number will be
     * sent as a contact when the button is pressed. Available in private chats
     * only.
     *
     * @param text The text to display, and optional styling information
     */
    static requestContact(text: string | KeyboardButton.CommonButton): KeyboardButton.RequestContactButton;
    /**
     * Adds a new location request button. The user's current location will be
     * sent when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    requestLocation(text: string | KeyboardButton.CommonButton): this;
    /**
     * Creates a new location request button. The user's current location will
     * be sent when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    static requestLocation(text: string | KeyboardButton.CommonButton): KeyboardButton.RequestLocationButton;
    /**
     * Adds a new poll request button. The user will be asked to create a poll
     * and send it to the bot when the button is pressed. Available in private
     * chats only.
     *
     * @param text The text to display, and optional styling information
     * @param type The type of permitted polls to create, omit if the user may
     * send a poll of any type
     */
    requestPoll(text: string | KeyboardButton.CommonButton, type?: KeyboardButtonPollType["type"]): this;
    /**
     * Creates a new poll request button. The user will be asked to create a
     * poll and send it to the bot when the button is pressed. Available in
     * private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param type The type of permitted polls to create, omit if the user may
     * send a poll of any type
     */
    static requestPoll(text: string | KeyboardButton.CommonButton, type?: KeyboardButtonPollType["type"]): KeyboardButton.RequestPollButton;
    /**
     * Adds a new web app button. The Web App that will be launched when the
     * user presses the button. The Web App will be able to send a
     * “web_app_data” service message. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    webApp(text: string | KeyboardButton.CommonButton, url: string): this;
    /**
     * Creates a new web app button. The Web App that will be launched when the
     * user presses the button. The Web App will be able to send a
     * “web_app_data” service message. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    static webApp(text: string | KeyboardButton.CommonButton, url: string): KeyboardButton.WebAppButton;
    /**
     * Adds a style to the last added button of the keyboard.
     *
     * ```ts
     * const keyboard = new Keyboard()
     *   .text('blue button')
     *   .style('primary')
     * ```
     *
     * @param style Style of the button
     */
    style(style: KeyboardButton.CommonButton["style"]): this;
    /**
     * Adds a danger style to the last added button of the keyboard. Alias for
     * `.style('danger')`.
     *
     * ```ts
     * const keyboard = new Keyboard()
     *   .text('red button')
     *   .danger()
     * ```
     */
    danger(): this;
    /**
     * Adds a success style to the last added button of the keyboard. Alias for
     * `.style('success')`.
     *
     * ```ts
     * const keyboard = new Keyboard()
     *   .text('green button')
     *   .success()
     * ```
     */
    success(): this;
    /**
     * Adds a primary style to the last added button of the keyboard. Alias for
     * `.style('primary')`.
     *
     * ```ts
     * const keyboard = new Keyboard()
     *   .text('blue button')
     *   .primary()
     * ```
     */
    primary(): this;
    /**
     * Adds a custom emoji icon to the last added button of the keyboard.
     *
     * ```ts
     * const keyboard = new Keyboard()
     *   .text('button with icon')
     *   .icon(myCustomEmojiIconIdentifier)
     * ```
     *
     * @param icon Unique identifier of the custom emoji shown before the text of the button
     */
    icon(icon: KeyboardButton.CommonButton["icon_custom_emoji_id"]): this;
    /**
     * Make the current keyboard persistent. See
     * https://grammy.dev/plugins/keyboard#persistent-keyboards for more
     * details.
     *
     * Keyboards are not persistent by default, use this function to enable it
     * (without any parameters or pass `true`). Pass `false` to force the
     * keyboard to not persist.
     *
     * @param isEnabled `true` if the keyboard should persist, and `false` otherwise
     */
    persistent(isEnabled?: boolean): this;
    /**
     * Make the current keyboard selective. See
     * https://grammy.dev/plugins/keyboard#selectively-send-custom-keyboards
     * for more details.
     *
     * Keyboards are non-selective by default, use this function to enable it
     * (without any parameters or pass `true`). Pass `false` to force the
     * keyboard to be non-selective.
     *
     * @param isEnabled `true` if the keyboard should be selective, and `false` otherwise
     */
    selected(isEnabled?: boolean): this;
    /**
     * Make the current keyboard one-time. See
     * https://grammy.dev/plugins/keyboard#one-time-custom-keyboards for
     * more details.
     *
     * Keyboards are non-one-time by default, use this function to enable it
     * (without any parameters or pass `true`). Pass `false` to force the
     * keyboard to be non-one-time.
     *
     * @param isEnabled `true` if the keyboard should be one-time, and `false` otherwise
     */
    oneTime(isEnabled?: boolean): this;
    /**
     * Make the current keyboard resized. See
     * https://grammy.dev/plugins/keyboard#resize-custom-keyboard for more
     * details.
     *
     * Keyboards are non-resized by default, use this function to enable it
     * (without any parameters or pass `true`). Pass `false` to force the
     * keyboard to be non-resized.
     *
     * @param isEnabled `true` if the keyboard should be resized, and `false` otherwise
     */
    resized(isEnabled?: boolean): this;
    /**
     * Set the current keyboard's input field placeholder. See
     * https://grammy.dev/plugins/keyboard#input-field-placeholder for more
     * details.
     *
     * @param value The placeholder text
     */
    placeholder(value: string): this;
    /**
     * Creates a new keyboard that contains the transposed grid of buttons of
     * this keyboard. This means that the resulting keyboard has the rows and
     * columns flipped.
     *
     * Note that buttons can only span multiple columns, but never multiple
     * rows. This means that if the given arrays have different lengths, some
     * buttons might flow up in the layout. In these cases, transposing a
     * keyboard a second time will not undo the first transposition.
     *
     * Here are some examples.
     *
     * ```
     * original    transposed
     * [  a  ]  ~> [  a  ]
     *
     *             [  a  ]
     * [a b c]  ~> [  b  ]
     *             [  c  ]
     *
     * [ a b ]     [a c e]
     * [ c d ]  ~> [ b d ]
     * [  e  ]
     *
     * [ a b ]     [a c d]
     * [  c  ]  ~> [ b e ]
     * [d e f]     [  f  ]
     * ```
     */
    toTransposed(): Keyboard;
    /**
     * Creates a new keyboard with the same buttons but reflowed into a given
     * number of columns as if the buttons were text elements. Optionally, you
     * can specify if the flow should make sure to fill up the last row.
     *
     * This method is idempotent, so calling it a second time will effectively
     * clone this keyboard without reordering the buttons.
     *
     * Here are some examples.
     *
     * ```
     * original    flowed
     * [  a  ]  ~> [  a  ]    (4 columns)
     *
     *             [  a  ]
     * [a b c]  ~> [  b  ]    (1 column)
     *             [  c  ]
     *
     * [ a b ]     [a b c]
     * [ c d ]  ~> [ d e ]    (3 columns)
     * [  e  ]
     *
     * [ a b ]     [abcde]
     * [  c  ]  ~> [  f  ]    (5 columns)
     * [d e f]
     *
     * [a b c]     [  a  ]
     * [d e f]  ~> [b c d]    (3 columns, { fillLastRow: true })
     * [g h i]     [e f g]
     * [  j  ]     [h i j]
     * ```
     *
     * @param columns Maximum number of buttons per row
     * @param options Optional flowing behavior
     */
    toFlowed(columns: number, options?: FlowOptions): Keyboard;
    /**
     * Creates and returns a deep copy of this keyboard.
     *
     * Optionally takes a new grid of buttons to replace the current buttons. If
     * specified, only the options will be cloned, and the given buttons will be
     * used instead.
     */
    clone(keyboard?: KeyboardButton[][]): Keyboard;
    /**
     * Appends the buttons of the given keyboards to this keyboard. If other
     * options are specified in these keyboards, they will be ignored.
     *
     * @param sources A number of keyboards to append
     */
    append(...sources: KeyboardSource[]): this;
    /**
     * Returns the keyboard that was build. Note that it doesn't return
     * `resize_keyboard` or other options that may be set. You don't usually
     * need to call this method. It is no longer useful.
     */
    build(): KeyboardButton[][];
    /**
     * Turns a two-dimensional keyboard button array into a keyboard instance.
     * You can use the static button builder methods to create keyboard button
     * objects.
     *
     * @param source A two-dimensional button array
     */
    static from(source: KeyboardSource): Keyboard;
}
type InlineKeyboardSource = InlineKeyboardButton[][] | InlineKeyboard;
/**
 * Use this class to simplify building an inline keyboard (something like this:
 * https://core.telegram.org/bots/features#inline-keyboards).
 *
 * ```ts
 * // Build an inline keyboard:
 * const keyboard = new InlineKeyboard()
 *   .text('A').text('B', 'callback-data').row()
 *   .text('C').text('D').row()
 *   .url('Telegram', 'telegram.org')
 *
 * // Send the keyboard:
 * await ctx.reply('Here is your inline keyboard!', {
 *   reply_markup: keyboard
 * })
 * ```
 *
 * If you already have some source data which you would like to turn into an
 * inline button object, you can use the static equivalents which every inline
 * button has. You can use them to create a two-dimensional inline button array.
 * The resulting array can be turned into a keyboard instance.
 *
 * ```ts
 * const button = InlineKeyboard.text('GO', 'go')
 * const array = [[button]]
 * const keyboard = InlineKeyboard.from(array)
 * ```
 *
 * Be sure to to check the
 * [documentation](https://grammy.dev/plugins/keyboard#inline-keyboards) on
 * inline keyboards in grammY.
 */
export declare class InlineKeyboard {
    readonly inline_keyboard: InlineKeyboardButton[][];
    /**
     * Initialize a new `InlineKeyboard` with an optional two-dimensional array
     * of `InlineKeyboardButton` objects. This is the nested array that holds
     * the inline keyboard. It will be extended every time you call one of the
     * provided methods.
     *
     * @param inline_keyboard An optional initial two-dimensional button array
     */
    constructor(inline_keyboard?: InlineKeyboardButton[][]);
    /**
     * Allows you to add your own `InlineKeyboardButton` objects if you already
     * have them for some reason. You most likely want to call one of the other
     * methods.
     *
     * @param buttons The buttons to add
     */
    add(...buttons: InlineKeyboardButton[]): this;
    /**
     * Adds a 'line break'. Call this method to make sure that the next added
     * buttons will be on a new row.
     *
     * You may pass a number of `InlineKeyboardButton` objects if you already
     * have the instances for some reason. You most likely don't want to pass
     * any arguments to `row`.
     *
     * @param buttons A number of buttons to add to the next row
     */
    row(...buttons: InlineKeyboardButton[]): this;
    /**
     * Adds a new URL button. Telegram clients will open the provided URL when
     * the button is pressed.
     *
     * @param text The text to display, and optional styling information
     * @param url HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings.
     */
    url(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, url: string): this;
    /**
     * Creates a new URL button. Telegram clients will open the provided URL
     * when the button is pressed.
     *
     * @param text The text to display, and optional styling information
     * @param url HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings.
     */
    static url(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, url: string): InlineKeyboardButton.UrlButton;
    /**
     * Adds a new callback query button. The button contains a text and a custom
     * payload. This payload will be sent back to your bot when the button is
     * pressed. If you omit the payload, the display text will be sent back to
     * your bot.
     *
     * Your bot will receive an update every time a user presses any of the text
     * buttons. You can listen to these updates like this:
     * ```ts
     * // Specific buttons:
     * bot.callbackQuery('button-data', ctx => { ... })
     * // Any button of any inline keyboard:
     * bot.on('callback_query:data',    ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param data The callback data to send back to your bot (default = text)
     */
    text(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, data?: string): this;
    /**
     * Creates a new callback query button. The button contains a text and a
     * custom payload. This payload will be sent back to your bot when the
     * button is pressed. If you omit the payload, the display text will be sent
     * back to your bot.
     *
     * Your bot will receive an update every time a user presses any of the text
     * buttons. You can listen to these updates like this:
     * ```ts
     * // Specific buttons:
     * bot.callbackQuery('button-data', ctx => { ... })
     * // Any button of any inline keyboard:
     * bot.on('callback_query:data',    ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param data The callback data to send back to your bot (default = text)
     */
    static text(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, data?: string): InlineKeyboardButton.CallbackButton;
    /**
     * Adds a new web app button, confer https://core.telegram.org/bots/webapps
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    webApp(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, url: string | WebAppInfo): this;
    /**
     * Creates a new web app button, confer https://core.telegram.org/bots/webapps
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    static webApp(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, url: string | WebAppInfo): InlineKeyboardButton.WebAppButton;
    /**
     * Adds a new login button. This can be used as a replacement for the
     * Telegram Login Widget. You must specify an HTTPS URL used to
     * automatically authorize the user.
     *
     * @param text The text to display, and optional styling information
     * @param loginUrl The login URL as string or `LoginUrl` object
     */
    login(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, loginUrl: string | LoginUrl): this;
    /**
     * Creates a new login button. This can be used as a replacement for the
     * Telegram Login Widget. You must specify an HTTPS URL used to
     * automatically authorize the user.
     *
     * @param text The text to display, and optional styling information
     * @param loginUrl The login URL as string or `LoginUrl` object
     */
    static login(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, loginUrl: string | LoginUrl): InlineKeyboardButton.LoginButton;
    /**
     * Adds a new inline query button. Telegram clients will let the user pick a
     * chat when this button is pressed. This will start an inline query. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The (optional) inline query string to prefill
     */
    switchInline(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: string): this;
    /**
     * Creates a new inline query button. Telegram clients will let the user pick a
     * chat when this button is pressed. This will start an inline query. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The (optional) inline query string to prefill
     */
    static switchInline(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: string): InlineKeyboardButton.SwitchInlineButton;
    /**
     * Adds a new inline query button that acts on the current chat. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it. This will start an inline
     * query.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The (optional) inline query string to prefill
     */
    switchInlineCurrent(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: string): this;
    /**
     * Creates a new inline query button that acts on the current chat. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it. This will start an inline
     * query.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The (optional) inline query string to prefill
     */
    static switchInlineCurrent(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: string): InlineKeyboardButton.SwitchInlineCurrentChatButton;
    /**
     * Adds a new inline query button. Telegram clients will let the user pick a
     * chat when this button is pressed. This will start an inline query. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The query object describing which chats can be picked
     */
    switchInlineChosen(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: SwitchInlineQueryChosenChat): this;
    /**
     * Creates a new inline query button. Telegram clients will let the user pick a
     * chat when this button is pressed. This will start an inline query. The
     * selected chat will be prefilled with the name of your bot. You may
     * provide a text that is specified along with it.
     *
     * Your bot will in turn receive updates for inline queries. You can listen
     * to inline query updates like this:
     * ```ts
     * bot.on('inline_query', ctx => { ... })
     * ```
     *
     * @param text The text to display, and optional styling information
     * @param query The query object describing which chats can be picked
     */
    static switchInlineChosen(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, query?: SwitchInlineQueryChosenChat): InlineKeyboardButton.SwitchInlineChosenChatButton;
    /**
     * Adds a new copy text button. When clicked, the specified text will be
     * copied to the clipboard.
     *
     * @param text The text to display, and optional styling information
     * @param copyText The text to be copied to the clipboard
     */
    copyText(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, copyText: string | CopyTextButton): this;
    /**
     * Creates a new copy text button. When clicked, the specified text will be
     * copied to the clipboard.
     *
     * @param text The text to display, and optional styling information
     * @param copyText The text to be copied to the clipboard
     */
    static copyText(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton, copyText: string | CopyTextButton): InlineKeyboardButton.CopyTextButtonButton;
    /**
     * Adds a new game query button, confer
     * https://core.telegram.org/bots/api#games
     *
     * This type of button must always be the first button in the first row.
     *
     * @param text The text to display, and optional styling information
     */
    game(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton): this;
    /**
     * Creates a new game query button, confer
     * https://core.telegram.org/bots/api#games
     *
     * This type of button must always be the first button in the first row.
     *
     * @param text The text to display, and optional styling information
     */
    static game(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton): InlineKeyboardButton.GameButton;
    /**
     * Adds a new payment button, confer
     * https://core.telegram.org/bots/api#payments
     *
     * This type of button must always be the first button in the first row and
     * can only be used in invoice messages.
     *
     * @param text The text to display, and optional styling information. Substrings “⭐” and “XTR” in the buttons's text will be replaced with a Telegram Star icon.
     */
    pay(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton): this;
    /**
     * Create a new payment button, confer
     * https://core.telegram.org/bots/api#payments
     *
     * This type of button must always be the first button in the first row and
     * can only be used in invoice messages.
     *
     * @param text The text to display, and optional styling information. Substrings “⭐” and “XTR” in the buttons's text will be replaced with a Telegram Star icon.
     */
    static pay(text: string | InlineKeyboardButton.AbstractInlineKeyboardButton): InlineKeyboardButton.PayButton;
    /**
     * Adds a style to the last added button of the inline keyboard.
     *
     * ```ts
     * const keyboard = new InlineKeyboard()
     *   .text('blue button')
     *   .style('primary')
     * ```
     *
     * @param style Style of the button
     */
    style(style: InlineKeyboardButton.AbstractInlineKeyboardButton["style"]): this;
    /**
     * Adds a danger style to the last added button of the inline keyboard.
     * Alias for `.style('danger')`.
     *
     * ```ts
     * const keyboard = new InlineKeyboard()
     *   .text('red button')
     *   .danger()
     * ```
     */
    danger(): this;
    /**
     * Adds a success style to the last added button of the inline keyboard.
     * Alias for `.style('success')`.
     *
     * ```ts
     * const keyboard = new InlineKeyboard()
     *   .text('green button')
     *   .success()
     * ```
     */
    success(): this;
    /**
     * Adds a primary style to the last added button of the inline keyboard.
     * Alias for `.style('primary')`.
     *
     * ```ts
     * const keyboard = new InlineKeyboard()
     *   .text('blue button')
     *   .primary()
     * ```
     */
    primary(): this;
    /**
     * Adds a custom emoji icon to the last added button of the inline keyboard.
     *
     * ```ts
     * const keyboard = new InlineKeyboard()
     *   .text('button with icon')
     *   .icon(myCustomEmojiIconIdentifier)
     * ```
     *
     * @param icon Unique identifier of the custom emoji shown before the text of the button
     */
    icon(icon: InlineKeyboardButton.AbstractInlineKeyboardButton["icon_custom_emoji_id"]): this;
    /**
     * Creates a new inline keyboard that contains the transposed grid of
     * buttons of this inline keyboard. This means that the resulting inline
     * keyboard has the rows and columns flipped.
     *
     * Note that inline buttons can only span multiple columns, but never
     * multiple rows. This means that if the given arrays have different
     * lengths, some buttons might flow up in the layout. In these cases,
     * transposing an inline keyboard a second time will not undo the first
     * transposition.
     *
     * Here are some examples.
     *
     * ```
     * original    transposed
     * [  a  ]  ~> [  a  ]
     *
     *             [  a  ]
     * [a b c]  ~> [  b  ]
     *             [  c  ]
     *
     * [ a b ]     [a c e]
     * [ c d ]  ~> [ b d ]
     * [  e  ]
     *
     * [ a b ]     [a c d]
     * [  c  ]  ~> [ b e ]
     * [d e f]     [  f  ]
     * ```
     */
    toTransposed(): InlineKeyboard;
    /**
     * Creates a new inline keyboard with the same buttons but reflowed into a
     * given number of columns as if the buttons were text elements. Optionally,
     * you can specify if the flow should make sure to fill up the last row.
     *
     * This method is idempotent, so calling it a second time will effectively
     * clone this inline keyboard without reordering the buttons.
     *
     * Here are some examples.
     *
     * ```
     * original    flowed
     * [  a  ]  ~> [  a  ]    (4 columns)
     *
     *             [  a  ]
     * [a b c]  ~> [  b  ]    (1 column)
     *             [  c  ]
     *
     * [ a b ]     [a b c]
     * [ c d ]  ~> [ d e ]    (3 columns)
     * [  e  ]
     *
     * [ a b ]     [abcde]
     * [  c  ]  ~> [  f  ]    (5 columns)
     * [d e f]
     *
     * [a b c]     [  a  ]
     * [d e f]  ~> [b c d]    (3 columns, { fillLastRow: true })
     * [g h i]     [e f g]
     * [  j  ]     [h i j]
     * ```
     *
     * @param columns Maximum number of buttons per row
     * @param options Optional flowing behavior
     */
    toFlowed(columns: number, options?: FlowOptions): InlineKeyboard;
    /**
     * Creates and returns a deep copy of this inline keyboard.
     */
    clone(): InlineKeyboard;
    /**
     * Appends the buttons of the given inline keyboards to this keyboard.
     *
     * @param sources A number of inline keyboards to append
     */
    append(...sources: InlineKeyboardSource[]): this;
    /**
     * Turns a two-dimensional inline button array into an inline keyboard
     * instance. You can use the static button builder methods to create inline
     * button objects.
     *
     * @param source A two-dimensional inline button array
     */
    static from(source: InlineKeyboardSource): InlineKeyboard;
}
interface FlowOptions {
    /** Set to `true` to completely fill up the last row */
    fillLastRow?: boolean;
}
export {};
