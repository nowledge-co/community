import { type InlineQueryResultArticle, type InlineQueryResultAudio, type InlineQueryResultCachedAudio, type InlineQueryResultCachedDocument, type InlineQueryResultCachedGif, type InlineQueryResultCachedMpeg4Gif, type InlineQueryResultCachedPhoto, type InlineQueryResultCachedSticker, type InlineQueryResultCachedVideo, type InlineQueryResultCachedVoice, type InlineQueryResultContact, type InlineQueryResultDocument, type InlineQueryResultGame, type InlineQueryResultGif, type InlineQueryResultLocation, type InlineQueryResultMpeg4Gif, type InlineQueryResultPhoto, type InlineQueryResultVenue, type InlineQueryResultVideo, type InlineQueryResultVoice, type InputContactMessageContent, type InputInvoiceMessageContent, type InputLocationMessageContent, type InputTextMessageContent, type InputVenueMessageContent, type LabeledPrice } from "../types.js";
type InlineQueryResultOptions<T, K extends keyof T> = Omit<T, "type" | "id" | "input_message_content" | K>;
type OptionalKeys<T> = {
    [K in keyof T]-?: undefined extends T[K] ? K : never;
};
type OptionalFields<T> = Pick<T, OptionalKeys<T>[keyof T]>;
/**
 * Holds a number of helper methods for building `InlineQueryResult*` objects.
 *
 * For example, letting the user pick one out of three photos can be done like
 * this.
 *
 * ```ts
 * const results = [
 *     InlineQueryResultBuilder.photo('id0', 'https://grammy.dev/images/Y.png'),
 *     InlineQueryResultBuilder.photo('id1', 'https://grammy.dev/images/Y.png'),
 *     InlineQueryResultBuilder.photo('id2', 'https://grammy.dev/images/Y.png'),
 * ];
 * await ctx.answerInlineQuery(results)
 * ```
 *
 * If you want the message content to be different from the content in the
 * inline query result, you can perform another method call on the resulting
 * objects.
 *
 * ```ts
 * const results = [
 *     InlineQueryResultBuilder.photo("id0", "https://grammy.dev/images/Y.png")
 *         .text("Picked photo 0!"),
 *     InlineQueryResultBuilder.photo("id1", "https://grammy.dev/images/Y.png")
 *         .text("Picked photo 1!"),
 *     InlineQueryResultBuilder.photo("id2", "https://grammy.dev/images/Y.png")
 *         .text("Picked photo 2!"),
 * ];
 * await ctx.answerInlineQuery(results)
 * ```
 *
 * Be sure to check the
 * [documentation](https://core.telegram.org/bots/api#inline-mode) on inline
 * mode.
 */
export declare const InlineQueryResultBuilder: {
    /**
     * Builds an InlineQueryResultArticle object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultarticle. Requires you
     * to specify the actual message content by calling another function on the
     * object returned from this method.
     *
     * @param id Unique identifier for this result, 1-64 Bytes
     * @param title Title of the result
     * @param options Remaining options
     */
    article(id: string, title: string, options?: InlineQueryResultOptions<InlineQueryResultArticle, "title">): {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultArticle;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultArticle;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultArticle;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultArticle;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultArticle;
    };
    /**
     * Builds an InlineQueryResultAudio object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultaudio.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title
     * @param audio_url A valid URL for the audio file
     * @param options Remaining options
     */
    audio(id: string, title: string, audio_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultAudio, "title" | "audio_url">): InlineQueryResultAudio & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultAudio;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultAudio;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultAudio;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultAudio;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultAudio;
    };
    /**
     * Builds an InlineQueryResultCachedAudio object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedaudio.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param audio_file_id A valid file identifier for the audio file
     * @param options Remaining options
     */
    audioCached(id: string, audio_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedAudio, "audio_file_id">): InlineQueryResultCachedAudio & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedAudio;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedAudio;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedAudio;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedAudio;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedAudio;
    };
    /**
     * Builds an InlineQueryResultContact object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcontact.
     *
     * @param id Unique identifier for this result, 1-64 Bytes
     * @param phone_number Contact's phone number
     * @param first_name Contact's first name
     * @param options Remaining options
     */
    contact(id: string, phone_number: string, first_name: string, options?: InlineQueryResultOptions<InlineQueryResultContact, "phone_number" | "first_name">): InlineQueryResultContact & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultContact;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultContact;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultContact;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultContact;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultContact;
    };
    /**
     * Builds an InlineQueryResultDocument object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultdocument with
     * mime_type set to "application/pdf".
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param document_url A valid URL for the file
     * @param options Remaining options
     */
    documentPdf(id: string, title: string, document_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultDocument, "mime_type" | "title" | "document_url">): InlineQueryResultDocument & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultDocument;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultDocument;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultDocument;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultDocument;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultDocument;
    };
    /**
     * Builds an InlineQueryResultDocument object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultdocument with
     * mime_type set to "application/zip".
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param document_url A valid URL for the file
     * @param options Remaining options
     */
    documentZip(id: string, title: string, document_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultDocument, "mime_type" | "title" | "document_url">): InlineQueryResultDocument & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultDocument;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultDocument;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultDocument;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultDocument;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultDocument;
    };
    /**
     * Builds an InlineQueryResultCachedDocument object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcacheddocument.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param document_file_id A valid file identifier for the file
     * @param options Remaining options
     */
    documentCached(id: string, title: string, document_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedDocument, "title" | "document_file_id">): InlineQueryResultCachedDocument & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedDocument;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedDocument;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedDocument;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedDocument;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedDocument;
    };
    /**
     * Builds an InlineQueryResultGame object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultgame.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param game_short_name Short name of the game
     * @param options Remaining options
     */
    game(id: string, game_short_name: string, options?: InlineQueryResultOptions<InlineQueryResultGame, "game_short_name">): {
        reply_markup?: import("@grammyjs/types/markup.js").InlineKeyboardMarkup | undefined;
        type: string;
        id: string;
        game_short_name: string;
    };
    /**
     * Builds an InlineQueryResultGif object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultgif.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param gif_url A valid URL for the GIF file. File size must not exceed 1MB
     * @param thumbnail_url URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result
     * @param options Remaining options
     */
    gif(id: string, gif_url: string | URL, thumbnail_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultGif, "gif_url" | "thumbnail_url">): InlineQueryResultGif & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultGif;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultGif;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultGif;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultGif;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultGif;
    };
    /**
     * Builds an InlineQueryResultCachedGif object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedgif.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param gif_file_id A valid file identifier for the GIF file
     * @param options Remaining options
     */
    gifCached(id: string, gif_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedGif, "gif_file_id">): InlineQueryResultCachedGif & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedGif;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedGif;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedGif;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedGif;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedGif;
    };
    /**
     * Builds an InlineQueryResultLocation object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultlocation.
     *
     * @param id Unique identifier for this result, 1-64 Bytes
     * @param title Location title
     * @param latitude Location latitude in degrees
     * @param longitude Location longitude in degrees
     * @param options Remaining options
     */
    location(id: string, title: string, latitude: number, longitude: number, options?: InlineQueryResultOptions<InlineQueryResultLocation, "title" | "latitude" | "longitude">): InlineQueryResultLocation & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultLocation;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultLocation;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultLocation;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultLocation;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultLocation;
    };
    /**
     * Builds an InlineQueryResultMpeg4Gif object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultmpeg4gif.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param mpeg4_url A valid URL for the MPEG4 file. File size must not exceed 1MB
     * @param thumbnail_url URL of the static (JPEG or GIF) or animated (MPEG4) thumbnail for the result
     * @param options Remaining options
     */
    mpeg4gif(id: string, mpeg4_url: string | URL, thumbnail_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultMpeg4Gif, "mpeg4_url" | "thumbnail_url">): InlineQueryResultMpeg4Gif & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultMpeg4Gif;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultMpeg4Gif;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultMpeg4Gif;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultMpeg4Gif;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultMpeg4Gif;
    };
    /**
     * Builds an InlineQueryResultCachedMpeg4Gif object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedmpeg4gif.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param mpeg4_file_id A valid file identifier for the MPEG4 file
     * @param options Remaining options
     */
    mpeg4gifCached(id: string, mpeg4_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedMpeg4Gif, "mpeg4_file_id">): InlineQueryResultCachedMpeg4Gif & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedMpeg4Gif;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedMpeg4Gif;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedMpeg4Gif;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedMpeg4Gif;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedMpeg4Gif;
    };
    /**
     * Builds an InlineQueryResultPhoto object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultphoto with the
     * thumbnail defaulting to the photo itself.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param photo_url A valid URL of the photo. Photo must be in JPEG format. Photo size must not exceed 5MB
     * @param options Remaining options
     */
    photo(id: string, photo_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultPhoto, "photo_url">): InlineQueryResultPhoto & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultPhoto;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultPhoto;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultPhoto;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultPhoto;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultPhoto;
    };
    /**
     * Builds an InlineQueryResultCachedPhoto object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedphoto.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param photo_file_id A valid file identifier of the photo
     * @param options Remaining options
     */
    photoCached(id: string, photo_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedPhoto, "photo_file_id">): InlineQueryResultCachedPhoto & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedPhoto;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedPhoto;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedPhoto;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedPhoto;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedPhoto;
    };
    /**
     * Builds an InlineQueryResultCachedSticker object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedsticker.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param sticker_file_id A valid file identifier of the sticker
     * @param options Remaining options
     */
    stickerCached(id: string, sticker_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedSticker, "sticker_file_id">): InlineQueryResultCachedSticker & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedSticker;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedSticker;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedSticker;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedSticker;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedSticker;
    };
    /**
     * Builds an InlineQueryResultVenue object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultvenue.
     *
     * @param id Unique identifier for this result, 1-64 Bytes
     * @param title Title of the venue
     * @param latitude Latitude of the venue location in degrees
     * @param longitude Longitude of the venue location in degrees
     * @param address Address of the venue
     * @param options Remaining options
     */
    venue(id: string, title: string, latitude: number, longitude: number, address: string, options?: InlineQueryResultOptions<InlineQueryResultVenue, "title" | "latitude" | "longitude" | "address">): InlineQueryResultVenue & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultVenue;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultVenue;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultVenue;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultVenue;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultVenue;
    };
    /**
     * Builds an InlineQueryResultVideo object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultvideo with mime_type
     * set to "text/html". This will send an embedded video player. Requires you
     * to specify the actual message content by calling another function on the
     * object returned from this method.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param video_url A valid URL for the embedded video player
     * @param thumbnail_url URL of the thumbnail (JPEG only) for the video
     * @param options Remaining options
     */
    videoHtml(id: string, title: string, video_url: string | URL, thumbnail_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultVideo, "mime_type" | "title" | "video_url" | "thumbnail_url">): {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultVideo;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultVideo;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultVideo;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultVideo;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultVideo;
    };
    /**
     * Builds an InlineQueryResultVideo object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultvideo with mime_type
     * set to "video/mp4".
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param video_url A valid URL for the video file
     * @param thumbnail_url URL of the thumbnail (JPEG only) for the video
     * @param options Remaining options
     */
    videoMp4(id: string, title: string, video_url: string | URL, thumbnail_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultVideo, "mime_type" | "title" | "video_url" | "thumbnail_url">): InlineQueryResultVideo & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultVideo;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultVideo;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultVideo;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultVideo;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultVideo;
    };
    /**
     * Builds an InlineQueryResultCachedVideo object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedvideo.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Title for the result
     * @param video_file_id A valid file identifier for the video file
     * @param options Remaining options
     */
    videoCached(id: string, title: string, video_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedVideo, "title" | "video_file_id">): InlineQueryResultCachedVideo & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedVideo;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedVideo;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedVideo;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedVideo;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedVideo;
    };
    /**
     * Builds an InlineQueryResultVoice object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultvoice.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Voice message title
     * @param voice_url A valid URL for the voice recording
     * @param options Remaining options
     */
    voice(id: string, title: string, voice_url: string | URL, options?: InlineQueryResultOptions<InlineQueryResultVoice, "title" | "voice_url">): InlineQueryResultVoice & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultVoice;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultVoice;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultVoice;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultVoice;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultVoice;
    };
    /**
     * Builds an InlineQueryResultCachedVoice object as specified by
     * https://core.telegram.org/bots/api#inlinequeryresultcachedvoice.
     *
     * @param id Unique identifier for this result, 1-64 bytes
     * @param title Voice message title
     * @param voice_file_id A valid file identifier for the voice message
     * @param options Remaining options
     */
    voiceCached(id: string, title: string, voice_file_id: string, options?: InlineQueryResultOptions<InlineQueryResultCachedVoice, "title" | "voice_file_id">): InlineQueryResultCachedVoice & {
        text(message_text: string, options?: OptionalFields<InputTextMessageContent>): InlineQueryResultCachedVoice;
        location(latitude: number, longitude: number, options?: OptionalFields<InputLocationMessageContent>): InlineQueryResultCachedVoice;
        venue(title: string, latitude: number, longitude: number, address: string, options: OptionalFields<InputVenueMessageContent>): InlineQueryResultCachedVoice;
        contact(first_name: string, phone_number: string, options?: OptionalFields<InputContactMessageContent>): InlineQueryResultCachedVoice;
        invoice(title: string, description: string, payload: string, provider_token: string, currency: string, prices: LabeledPrice[], options?: OptionalFields<InputInvoiceMessageContent>): InlineQueryResultCachedVoice;
    };
};
export {};
