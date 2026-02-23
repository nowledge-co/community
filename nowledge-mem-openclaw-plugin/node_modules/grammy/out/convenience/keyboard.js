"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineKeyboard = exports.Keyboard = void 0;
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
class Keyboard {
    /**
     * Initialize a new `Keyboard` with an optional two-dimensional array of
     * `KeyboardButton` objects. This is the nested array that holds the custom
     * keyboard. It will be extended every time you call one of the provided
     * methods.
     *
     * @param keyboard An optional initial two-dimensional button array
     */
    constructor(keyboard = [[]]) {
        this.keyboard = keyboard;
    }
    /**
     * Allows you to add your own `KeyboardButton` objects if you already have
     * them for some reason. You most likely want to call one of the other
     * methods.
     *
     * @param buttons The buttons to add
     */
    add(...buttons) {
        var _a;
        (_a = this.keyboard[this.keyboard.length - 1]) === null || _a === void 0 ? void 0 : _a.push(...buttons);
        return this;
    }
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
    row(...buttons) {
        this.keyboard.push(buttons);
        return this;
    }
    /**
     * Adds a new text button. This button will simply send the given text as a
     * text message back to your bot if a user clicks on it.
     *
     * @param text The text to display, and optional styling information
     * @param options Optional styling information
     */
    text(text, options) {
        return this.add(Keyboard.text(text, options));
    }
    /**
     * Creates a new text button. This button will simply send the given text as
     * a text message back to your bot if a user clicks on it.
     *
     * @param text The text to display, and optional styling information
     * @param options Optional styling information
     */
    static text(text, options) {
        return typeof options === "string"
            ? { text, style: options }
            : { text, ...options };
    }
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
    requestUsers(text, requestId, options = {}) {
        return this.add(Keyboard.requestUsers(text, requestId, options));
    }
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
    static requestUsers(text, requestId, options = {}) {
        return typeof text === "string"
            ? { text, request_users: { request_id: requestId, ...options } }
            : { ...text, request_users: { request_id: requestId, ...options } };
    }
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
    requestChat(text, requestId, options = {
        chat_is_channel: false,
    }) {
        return this.add(Keyboard.requestChat(text, requestId, options));
    }
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
    static requestChat(text, requestId, options = {
        chat_is_channel: false,
    }) {
        const request_chat = { request_id: requestId, ...options };
        return typeof text === "string"
            ? { text, request_chat }
            : { ...text, request_chat };
    }
    /**
     * Adds a new contact request button. The user's phone number will be sent
     * as a contact when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    requestContact(text) {
        return this.add(Keyboard.requestContact(text));
    }
    /**
     * Creates a new contact request button. The user's phone number will be
     * sent as a contact when the button is pressed. Available in private chats
     * only.
     *
     * @param text The text to display, and optional styling information
     */
    static requestContact(text) {
        const request_contact = true;
        return typeof text === "string"
            ? { text, request_contact }
            : { ...text, request_contact };
    }
    /**
     * Adds a new location request button. The user's current location will be
     * sent when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    requestLocation(text) {
        return this.add(Keyboard.requestLocation(text));
    }
    /**
     * Creates a new location request button. The user's current location will
     * be sent when the button is pressed. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     */
    static requestLocation(text) {
        const request_location = true;
        return typeof text === "string"
            ? { text, request_location }
            : { ...text, request_location };
    }
    /**
     * Adds a new poll request button. The user will be asked to create a poll
     * and send it to the bot when the button is pressed. Available in private
     * chats only.
     *
     * @param text The text to display, and optional styling information
     * @param type The type of permitted polls to create, omit if the user may
     * send a poll of any type
     */
    requestPoll(text, type) {
        return this.add(Keyboard.requestPoll(text, type));
    }
    /**
     * Creates a new poll request button. The user will be asked to create a
     * poll and send it to the bot when the button is pressed. Available in
     * private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param type The type of permitted polls to create, omit if the user may
     * send a poll of any type
     */
    static requestPoll(text, type) {
        const request_poll = { type };
        return typeof text === "string"
            ? { text, request_poll }
            : { ...text, request_poll };
    }
    /**
     * Adds a new web app button. The Web App that will be launched when the
     * user presses the button. The Web App will be able to send a
     * “web_app_data” service message. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    webApp(text, url) {
        return this.add(Keyboard.webApp(text, url));
    }
    /**
     * Creates a new web app button. The Web App that will be launched when the
     * user presses the button. The Web App will be able to send a
     * “web_app_data” service message. Available in private chats only.
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    static webApp(text, url) {
        const web_app = { url };
        return typeof text === "string"
            ? { text, web_app }
            : { ...text, web_app };
    }
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
    style(style) {
        const rows = this.keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        const lastRow = this.keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        let lastButton = lastRow[cols - 1];
        if (typeof lastButton === "string") {
            lastButton = { text: lastButton };
            lastRow[cols - 1] = lastButton;
        }
        lastButton.style = style;
        return this;
    }
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
    danger() {
        return this.style("danger");
    }
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
    success() {
        return this.style("success");
    }
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
    primary() {
        return this.style("primary");
    }
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
    icon(icon) {
        const rows = this.keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        const lastRow = this.keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        let lastButton = lastRow[cols - 1];
        if (typeof lastButton === "string") {
            lastButton = { text: lastButton };
            lastRow[cols - 1] = lastButton;
        }
        lastButton.icon_custom_emoji_id = icon;
        return this;
    }
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
    persistent(isEnabled = true) {
        this.is_persistent = isEnabled;
        return this;
    }
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
    selected(isEnabled = true) {
        this.selective = isEnabled;
        return this;
    }
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
    oneTime(isEnabled = true) {
        this.one_time_keyboard = isEnabled;
        return this;
    }
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
    resized(isEnabled = true) {
        this.resize_keyboard = isEnabled;
        return this;
    }
    /**
     * Set the current keyboard's input field placeholder. See
     * https://grammy.dev/plugins/keyboard#input-field-placeholder for more
     * details.
     *
     * @param value The placeholder text
     */
    placeholder(value) {
        this.input_field_placeholder = value;
        return this;
    }
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
    toTransposed() {
        const original = this.keyboard;
        const transposed = transpose(original);
        return this.clone(transposed);
    }
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
    toFlowed(columns, options = {}) {
        const original = this.keyboard;
        const flowed = reflow(original, columns, options);
        return this.clone(flowed);
    }
    /**
     * Creates and returns a deep copy of this keyboard.
     *
     * Optionally takes a new grid of buttons to replace the current buttons. If
     * specified, only the options will be cloned, and the given buttons will be
     * used instead.
     */
    clone(keyboard = this.keyboard) {
        const clone = new Keyboard(keyboard.map((row) => row.slice()));
        clone.is_persistent = this.is_persistent;
        clone.selective = this.selective;
        clone.one_time_keyboard = this.one_time_keyboard;
        clone.resize_keyboard = this.resize_keyboard;
        clone.input_field_placeholder = this.input_field_placeholder;
        return clone;
    }
    /**
     * Appends the buttons of the given keyboards to this keyboard. If other
     * options are specified in these keyboards, they will be ignored.
     *
     * @param sources A number of keyboards to append
     */
    append(...sources) {
        for (const source of sources) {
            const keyboard = Keyboard.from(source);
            this.keyboard.push(...keyboard.keyboard.map((row) => row.slice()));
        }
        return this;
    }
    /**
     * Returns the keyboard that was build. Note that it doesn't return
     * `resize_keyboard` or other options that may be set. You don't usually
     * need to call this method. It is no longer useful.
     */
    build() {
        return this.keyboard;
    }
    /**
     * Turns a two-dimensional keyboard button array into a keyboard instance.
     * You can use the static button builder methods to create keyboard button
     * objects.
     *
     * @param source A two-dimensional button array
     */
    static from(source) {
        if (source instanceof Keyboard)
            return source.clone();
        function toButton(btn) {
            return typeof btn === "string" ? Keyboard.text(btn) : btn;
        }
        return new Keyboard(source.map((row) => row.map(toButton)));
    }
}
exports.Keyboard = Keyboard;
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
class InlineKeyboard {
    /**
     * Initialize a new `InlineKeyboard` with an optional two-dimensional array
     * of `InlineKeyboardButton` objects. This is the nested array that holds
     * the inline keyboard. It will be extended every time you call one of the
     * provided methods.
     *
     * @param inline_keyboard An optional initial two-dimensional button array
     */
    constructor(inline_keyboard = [[]]) {
        this.inline_keyboard = inline_keyboard;
    }
    /**
     * Allows you to add your own `InlineKeyboardButton` objects if you already
     * have them for some reason. You most likely want to call one of the other
     * methods.
     *
     * @param buttons The buttons to add
     */
    add(...buttons) {
        var _a;
        (_a = this.inline_keyboard[this.inline_keyboard.length - 1]) === null || _a === void 0 ? void 0 : _a.push(...buttons);
        return this;
    }
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
    row(...buttons) {
        this.inline_keyboard.push(buttons);
        return this;
    }
    /**
     * Adds a new URL button. Telegram clients will open the provided URL when
     * the button is pressed.
     *
     * @param text The text to display, and optional styling information
     * @param url HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings.
     */
    url(text, url) {
        return this.add(InlineKeyboard.url(text, url));
    }
    /**
     * Creates a new URL button. Telegram clients will open the provided URL
     * when the button is pressed.
     *
     * @param text The text to display, and optional styling information
     * @param url HTTP or tg:// url to be opened when the button is pressed. Links tg://user?id=<user_id> can be used to mention a user by their ID without using a username, if this is allowed by their privacy settings.
     */
    static url(text, url) {
        return typeof text === "string" ? { text, url } : { ...text, url };
    }
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
    text(text, data = typeof text === "string" ? text : text.text) {
        return this.add(InlineKeyboard.text(text, data));
    }
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
    static text(text, data = typeof text === "string" ? text : text.text) {
        return typeof text === "string"
            ? { text, callback_data: data }
            : { ...text, callback_data: data };
    }
    /**
     * Adds a new web app button, confer https://core.telegram.org/bots/webapps
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    webApp(text, url) {
        return this.add(InlineKeyboard.webApp(text, url));
    }
    /**
     * Creates a new web app button, confer https://core.telegram.org/bots/webapps
     *
     * @param text The text to display, and optional styling information
     * @param url An HTTPS URL of a Web App to be opened with additional data
     */
    static webApp(text, url) {
        const web_app = typeof url === "string" ? { url } : url;
        return typeof text === "string"
            ? { text, web_app }
            : { ...text, web_app };
    }
    /**
     * Adds a new login button. This can be used as a replacement for the
     * Telegram Login Widget. You must specify an HTTPS URL used to
     * automatically authorize the user.
     *
     * @param text The text to display, and optional styling information
     * @param loginUrl The login URL as string or `LoginUrl` object
     */
    login(text, loginUrl) {
        return this.add(InlineKeyboard.login(text, loginUrl));
    }
    /**
     * Creates a new login button. This can be used as a replacement for the
     * Telegram Login Widget. You must specify an HTTPS URL used to
     * automatically authorize the user.
     *
     * @param text The text to display, and optional styling information
     * @param loginUrl The login URL as string or `LoginUrl` object
     */
    static login(text, loginUrl) {
        const login_url = typeof loginUrl === "string"
            ? { url: loginUrl }
            : loginUrl;
        return typeof text === "string"
            ? { text, login_url }
            : { ...text, login_url };
    }
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
    switchInline(text, query = "") {
        return this.add(InlineKeyboard.switchInline(text, query));
    }
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
    static switchInline(text, query = "") {
        return typeof text === "string"
            ? { text, switch_inline_query: query }
            : { ...text, switch_inline_query: query };
    }
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
    switchInlineCurrent(text, query = "") {
        return this.add(InlineKeyboard.switchInlineCurrent(text, query));
    }
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
    static switchInlineCurrent(text, query = "") {
        return typeof text === "string"
            ? { text, switch_inline_query_current_chat: query }
            : { ...text, switch_inline_query_current_chat: query };
    }
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
    switchInlineChosen(text, query = {}) {
        return this.add(InlineKeyboard.switchInlineChosen(text, query));
    }
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
    static switchInlineChosen(text, query = {}) {
        return typeof text === "string"
            ? { text, switch_inline_query_chosen_chat: query }
            : { ...text, switch_inline_query_chosen_chat: query };
    }
    /**
     * Adds a new copy text button. When clicked, the specified text will be
     * copied to the clipboard.
     *
     * @param text The text to display, and optional styling information
     * @param copyText The text to be copied to the clipboard
     */
    copyText(text, copyText) {
        return this.add(InlineKeyboard.copyText(text, copyText));
    }
    /**
     * Creates a new copy text button. When clicked, the specified text will be
     * copied to the clipboard.
     *
     * @param text The text to display, and optional styling information
     * @param copyText The text to be copied to the clipboard
     */
    static copyText(text, copyText) {
        const copy_text = typeof copyText === "string"
            ? { text: copyText }
            : copyText;
        return typeof text === "string"
            ? { text, copy_text }
            : { ...text, copy_text };
    }
    /**
     * Adds a new game query button, confer
     * https://core.telegram.org/bots/api#games
     *
     * This type of button must always be the first button in the first row.
     *
     * @param text The text to display, and optional styling information
     */
    game(text) {
        return this.add(InlineKeyboard.game(text));
    }
    /**
     * Creates a new game query button, confer
     * https://core.telegram.org/bots/api#games
     *
     * This type of button must always be the first button in the first row.
     *
     * @param text The text to display, and optional styling information
     */
    static game(text) {
        const callback_game = {};
        return typeof text === "string"
            ? { text, callback_game }
            : { ...text, callback_game };
    }
    /**
     * Adds a new payment button, confer
     * https://core.telegram.org/bots/api#payments
     *
     * This type of button must always be the first button in the first row and
     * can only be used in invoice messages.
     *
     * @param text The text to display, and optional styling information. Substrings “⭐” and “XTR” in the buttons's text will be replaced with a Telegram Star icon.
     */
    pay(text) {
        return this.add(InlineKeyboard.pay(text));
    }
    /**
     * Create a new payment button, confer
     * https://core.telegram.org/bots/api#payments
     *
     * This type of button must always be the first button in the first row and
     * can only be used in invoice messages.
     *
     * @param text The text to display, and optional styling information. Substrings “⭐” and “XTR” in the buttons's text will be replaced with a Telegram Star icon.
     */
    static pay(text) {
        const pay = true;
        return typeof text === "string" ? { text, pay } : { ...text, pay };
    }
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
    style(style) {
        const rows = this.inline_keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        const lastRow = this.inline_keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before applying a style!");
        }
        lastRow[cols - 1].style = style;
        return this;
    }
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
    danger() {
        return this.style("danger");
    }
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
    success() {
        return this.style("success");
    }
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
    primary() {
        return this.style("primary");
    }
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
    icon(icon) {
        const rows = this.inline_keyboard.length;
        if (rows === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        const lastRow = this.inline_keyboard[rows - 1];
        const cols = lastRow.length;
        if (cols === 0) {
            throw new Error("Need to add a button before adding an icon!");
        }
        lastRow[cols - 1].icon_custom_emoji_id = icon;
        return this;
    }
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
    toTransposed() {
        const original = this.inline_keyboard;
        const transposed = transpose(original);
        return new InlineKeyboard(transposed);
    }
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
    toFlowed(columns, options = {}) {
        const original = this.inline_keyboard;
        const flowed = reflow(original, columns, options);
        return new InlineKeyboard(flowed);
    }
    /**
     * Creates and returns a deep copy of this inline keyboard.
     */
    clone() {
        return new InlineKeyboard(this.inline_keyboard.map((row) => row.slice()));
    }
    /**
     * Appends the buttons of the given inline keyboards to this keyboard.
     *
     * @param sources A number of inline keyboards to append
     */
    append(...sources) {
        for (const source of sources) {
            const keyboard = InlineKeyboard.from(source);
            this.inline_keyboard.push(...keyboard.inline_keyboard.map((row) => row.slice()));
        }
        return this;
    }
    /**
     * Turns a two-dimensional inline button array into an inline keyboard
     * instance. You can use the static button builder methods to create inline
     * button objects.
     *
     * @param source A two-dimensional inline button array
     */
    static from(source) {
        if (source instanceof InlineKeyboard)
            return source.clone();
        return new InlineKeyboard(source.map((row) => row.slice()));
    }
}
exports.InlineKeyboard = InlineKeyboard;
function transpose(grid) {
    var _a;
    const transposed = [];
    for (let i = 0; i < grid.length; i++) {
        const row = grid[i];
        for (let j = 0; j < row.length; j++) {
            const button = row[j];
            ((_a = transposed[j]) !== null && _a !== void 0 ? _a : (transposed[j] = [])).push(button);
        }
    }
    return transposed;
}
function reflow(grid, columns, { fillLastRow = false }) {
    var _a;
    let first = columns;
    if (fillLastRow) {
        const buttonCount = grid
            .map((row) => row.length)
            .reduce((a, b) => a + b, 0);
        first = buttonCount % columns;
    }
    const reflowed = [];
    for (const row of grid) {
        for (const button of row) {
            const at = Math.max(0, reflowed.length - 1);
            const max = at === 0 ? first : columns;
            let next = ((_a = reflowed[at]) !== null && _a !== void 0 ? _a : (reflowed[at] = []));
            if (next.length === max) {
                next = [];
                reflowed.push(next);
            }
            next.push(button);
        }
    }
    return reflowed;
}
