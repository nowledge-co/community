# Telegram Bot API types for grammY

[grammY](https://github.com/grammyjs/grammY) makes writing Telegram bots easy. Check it out!

This package just provides type annotations for the complete Telegram Bot API, and aims at making them usable for grammY. It contains no runnable code.

Originally, this package is based on `typegram`, but since the update to Telegram Bot API 5.1, `typegram` is no longer directly updated. Instead, this package is maintained and its updates are backported to `typegram`. Hence, both packages are kept up to date with the Telegram Bot API for now.

## Available Types

Generally this package just exposes a huge load of `interface`s that correspond to the **types** used throughout the Telegram Bot API.

Note that the API specification sometimes only has one name for multiple variants of a type, e.g. there is a number of different `Update`s you can receive, but they're all just called `Update`.
If you need to access the individual variants of an `Update`, refer to `Update.MessageUpdate` and its siblings.

In fact, this pattern is used for various types, namely:

- `CallbackQuery`
- `Chat`
- `ChatFullInfo`
- `InlineKeyboardButton`
- `KeyboardButton`
- `Message`
- `MessageEntity`
- `Location`
- `Update`

Naturally, when the API specification is actually modelling types to be unions (e.g. `InlineQueryResult`), this is reflected here as a union type, too.
Those types are not closed.

## Available Methods

In addition to the types, this package provides you with another type `Telegram` which contains all available **methods** of the API.
There is no further structure applied to this, but if you can come up with something reasonable, please suggest it in an issue or directly open a PR.
In grammY, these types are what defines the `bot.api.raw` object.

Each method takes just a single argument with a structure that corresponds to the object expected by Telegram.
The helper type `Opts<M>` (where `M` is the method name) allows grammY to access that type directly.

## Handling JSON-Serialized Objects

Some methods of the Telegram Bot API are expected to be called with JSON-serialized objects contained in a property of the payload, rather than an actual JSON payload.
In other words, the objects are serialized twice—the first time in order to conform with the docs, and the second time when the payload is actually sent in the POST body to the API server.

The most prominent example is the `reply_markup` property that appears in a number of different methods, but more than a dozen other properties like this can be found throughout the API.

Strictly speaking, the `@grammyjs/types` types do not reflect this accurately.
Instead of using `string` (representing a serialized object) as the type, `@grammyjs/types` uses the type of the object itself, thus ignoring the serialization step.
For instance, instead of declaring `reply_markup: string`, it declares the property as `reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply` because that is what is supposed to be serialized to `string` before calling the respective method.

That makes sense for the reason that grammY uses the types in its wrapper code around the Telegram Bot API, exposed as `bot.raw.api`.
This wrapper code does the necessary JSON serialization automatically for the required properties.
Bots written with grammY then do not need to care about which properties to serialize and which not.
Given that `@grammyjs/types` refers to the objects themselves instead of their serialized strings, the wrapper code can now simply expose the `@grammyjs/types` types to its consumers without having to transform them before.

Consequently, the descriptions of all methods are adjusted in order to reflect this, i.e. the JSDoc comments do not mention JSON serialization (in contrast to their official equivalents).

## Customizing `InputFile`

The Telegram Bot API lets bots send files in [three different ways](https://core.telegram.org/bots/api#sending-files).
Two of those ways are by specifying a `string`—either a `file_id` or a URL.
The third option, however, is by uploading files to the server using multipart/form-data.

The first two means to send a file are already covered by the type annotations across the library.
In all places where a `file_id` or a URL is permitted, the corresponding property allows a `string`.

We will now look at the type declarations that are relevant for uploading files directly.
grammY automatically translates calls to `sendDocument` and the like to multipart/form-data uploads when supplied with an `InputFile` object in the `document` property of the argument object.

`@grammyjs/types` should not have to know what objects you want to support as `InputFile`s.
Consequently, the type `InputFile` is not defined in this library.

Instead, grammY specifies its own version of what an `InputFile` is, hence automatically adjusting `@grammyjs/types` with a custom `InputFile` type used throughout all affected methods and interfaces.
This is possible by adding a type parameter to all affected types.
grammY then import types parametrises these types with its version of `InputFile`, and re-exports the adjusted types.
This is why you should always import Bot API as described here: <https://grammy.dev/guide/api.html#type-definitions-for-the-api>.

## Differences to the Bot API

Some documentation strings are intentionally different from what is written on the website.
The actual type definitions themselves are never different.

1. No formatting.
   We do not leverage the markdown capabilities of JSDoc for the sake of easier copying and thus reduced maintenance efforts.
2. No mentions of `JSON-serialized`.
   As underlying libraries handle serialization, these words are removed from the explanations.
3. No mentions of integer numbers that exceed 2^31 but not 2^51.
   All numbers are 64-bit floats in JS, so this is irrelevant.
   Note that JS bit operators cast numbers to 32-bit integers and back, but we deliberately ignore this because people who use bit operators on identifiers or file sizes should know what they're doing, and they should also know that it's a bad idea.
4. No `More info on Sending Files »`.
   File handling is abstracted away by the underlying library.
   Also, without the links, it's useless anyway.
   The same is true for the links to more info about requesting chats and users.
5. No images.
   Documentation strings containing an image are adjusted to make sense without the images, too.

## Contributing

This is a Deno project.
All the files are TypeScript files that are published on <https://deno.land/x/grammy_types>.
This project uses [deno2node](https://github.com/fromdeno/deno2node) to emit declaration files which are then published on npm.

If you want to work on this, you do not need to have Node.js installed.
You also should not run `npm install`.
You only need [Deno](https://deno.land) and the VSCode extensions recommended in this repo.

Run `deno task` to see available development scripts.
