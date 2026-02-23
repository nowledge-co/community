import type { Chat, User } from "./manage.js";
import type { Message, MessageEntity, PaidMedia, Sticker } from "./message.js";
/** This object represents a portion of the price for goods or services. */
export interface LabeledPrice {
    /** Portion label */
    label: string;
    /** Price of the product in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
    amount: number;
}
/** This object contains basic information about an invoice. */
export interface Invoice {
    /** Product name */
    title: string;
    /** Product description */
    description: string;
    /** Unique bot deep-linking parameter that can be used to generate this invoice */
    start_parameter: string;
    /** Three-letter ISO 4217 currency code, or “XTR” for payments in Telegram Stars */
    currency: string;
    /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
    total_amount: number;
}
/** This object represents a shipping address. */
export interface ShippingAddress {
    /** Two-letter ISO 3166-1 alpha-2 country code */
    country_code: string;
    /** State, if applicable */
    state: string;
    /** City */
    city: string;
    /** First line for the address */
    street_line1: string;
    /** Second line for the address */
    street_line2: string;
    /** Address post code */
    post_code: string;
}
/** This object represents information about an order. */
export interface OrderInfo {
    /** User name */
    name?: string;
    /** User's phone number */
    phone_number?: string;
    /** User email */
    email?: string;
    /** User shipping address */
    shipping_address?: ShippingAddress;
}
/** This object represents one shipping option. */
export interface ShippingOption {
    /** Shipping option identifier */
    id: string;
    /** Option title */
    title: string;
    /** List of price portions */
    prices: LabeledPrice[];
}
/** This object contains basic information about a successful payment. Note that if the buyer initiates a chargeback with the relevant payment provider following this transaction, the funds may be debited from your balance. This is outside of Telegram's control. */
export interface SuccessfulPayment {
    /** Three-letter ISO 4217 currency code, or “XTR” for payments in Telegram Stars */
    currency: string;
    /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
    total_amount: number;
    /** Bot specified invoice payload */
    invoice_payload: string;
    /** Expiration date of the subscription, in Unix time; for recurring payments only */
    subscription_expiration_date?: number;
    /** True, if the payment is a recurring payment for a subscription */
    is_recurring?: true;
    /** True, if the payment is the first payment for a subscription */
    is_first_recurring?: true;
    /** Identifier of the shipping option chosen by the user */
    shipping_option_id?: string;
    /** Order information provided by the user */
    order_info?: OrderInfo;
    /** Telegram payment identifier */
    telegram_payment_charge_id: string;
    /** Provider payment identifier */
    provider_payment_charge_id: string;
}
/** This object contains basic information about a refunded payment. */
export interface RefundedPayment {
    /** Three-letter ISO 4217 currency code, or “XTR” for payments in Telegram Stars. Currently, always “XTR” */
    currency: string;
    /** Total refunded price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45, total_amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
    total_amount: number;
    /** Bot-specified invoice payload */
    invoice_payload: string;
    /** Telegram payment identifier */
    telegram_payment_charge_id: string;
    /** Provider payment identifier */
    provider_payment_charge_id?: string;
}
/** This object contains information about an incoming shipping query. */
export interface ShippingQuery {
    /** Unique query identifier */
    id: string;
    /** User who sent the query */
    from: User;
    /** Bot specified invoice payload */
    invoice_payload: string;
    /** User specified shipping address */
    shipping_address: ShippingAddress;
}
/** This object contains information about an incoming pre-checkout query. */
export interface PreCheckoutQuery {
    /** Unique query identifier */
    id: string;
    /** User who sent the query */
    from: User;
    /** Three-letter ISO 4217 currency code, or “XTR” for payments in Telegram Stars */
    currency: string;
    /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
    total_amount: number;
    /** Bot specified invoice payload */
    invoice_payload: string;
    /** Identifier of the shipping option chosen by the user */
    shipping_option_id?: string;
    /** Order information provided by the user */
    order_info?: OrderInfo;
}
/** This object describes the state of a revenue withdrawal operation. Currently, it can be one of

- RevenueWithdrawalStatePending
- RevenueWithdrawalStateSucceeded
- RevenueWithdrawalStateFailed */
export type RevenueWithdrawalState = RevenueWithdrawalStatePending | RevenueWithdrawalStateSucceeded | RevenueWithdrawalStateFailed;
/** The withdrawal is in progress. */
export interface RevenueWithdrawalStatePending {
    /** Type of the state, always “pending” */
    type: "pending";
}
/** The withdrawal succeeded. */
export interface RevenueWithdrawalStateSucceeded {
    /** Type of the state, always “succeeded” */
    type: "succeeded";
    /** Date the withdrawal was completed in Unix time */
    date: number;
    /** An HTTPS URL that can be used to see transaction details */
    url: string;
}
/** The withdrawal failed and the transaction was refunded. */
export interface RevenueWithdrawalStateFailed {
    /** Type of the state, always “failed” */
    type: "failed";
}
/** Contains information about the affiliate that received a commission via this transaction. */
export interface AffiliateInfo {
    /** The bot or the user that received an affiliate commission if it was received by a bot or a user */
    affiliate_user?: User;
    /** The chat that received an affiliate commission if it was received by a chat */
    affiliate_chat?: Chat;
    /** The number of Telegram Stars received by the affiliate for each 1000 Telegram Stars received by the bot from referred users */
    commission_per_mille: number;
    /** Integer amount of Telegram Stars received by the affiliate from the transaction, rounded to 0; can be negative for refunds */
    amount: number;
    /** The number of 1/1000000000 shares of Telegram Stars received by the affiliate; from -999999999 to 999999999; can be negative for refunds */
    nanostar_amount?: number;
}
/** This object describes the source of a transaction, or its recipient for outgoing transactions. Currently, it can be one of

- TransactionPartnerUser
- TransactionPartnerChat
- TransactionPartnerAffiliateProgram
- TransactionPartnerFragment
- TransactionPartnerTelegramAds
- TransactionPartnerTelegramApi
- TransactionPartnerOther */
export type TransactionPartner = TransactionPartnerUser | TransactionPartnerChat | TransactionPartnerAffiliateProgram | TransactionPartnerFragment | TransactionPartnerTelegramAds | TransactionPartnerTelegramApi | TransactionPartnerOther;
/** Describes a transaction with a user. */
export interface TransactionPartnerUser {
    /** Type of the transaction partner, always “user” */
    type: "user";
    /** Type of the transaction, currently one of “invoice_payment” for payments via invoices, “paid_media_payment” for payments for paid media, “gift_purchase” for gifts sent by the bot, “premium_purchase” for Telegram Premium subscriptions gifted by the bot, “business_account_transfer” for direct transfers from managed business accounts */
    transaction_type: "invoice_payment" | "paid_media_payment" | "gift_purchase" | "premium_purchase" | "business_account_transfer";
    /** Information about the user */
    user: User;
    /** Information about the affiliate that received a commission via this transaction. Can be available only for “invoice_payment” and “paid_media_payment” transactions. */
    affiliate?: AffiliateInfo;
    /** Bot-specified invoice payload. Can be available only for “invoice_payment” transactions. */
    invoice_payload?: string;
    /** The duration of the paid subscription. Can be available only for “invoice_payment” transactions. */
    subscription_period?: number;
    /** Information about the paid media bought by the user; for “paid_media_payment” transactions only */
    paid_media?: PaidMedia[];
    /** Bot-specified paid media payload. Can be available only for “paid_media_payment” transactions. */
    paid_media_payload?: string;
    /** The gift sent to the user by the bot; for “gift_purchase” transactions only */
    gift?: Gift;
    /** Number of months the gifted Telegram Premium subscription will be active for; for “premium_purchase” transactions only */
    premium_subscription_duration?: number;
}
/** Describes a transaction with a chat. */
export interface TransactionPartnerChat {
    /** Type of the transaction partner, always “chat” */
    type: "chat";
    /** Information about the chat */
    chat: Chat;
    /** The gift sent to the chat by the bot */
    gift?: Gift;
}
/** Describes the affiliate program that issued the affiliate commission received via this transaction. */
export interface TransactionPartnerAffiliateProgram {
    /** Type of the transaction partner, always “affiliate_program” */
    type: "affiliate_program";
    /** Information about the bot that sponsored the affiliate program */
    sponsor_user?: User;
    /** The number of Telegram Stars received by the bot for each 1000 Telegram Stars received by the affiliate program sponsor from referred users */
    commission_per_mille: number;
}
/** Describes a withdrawal transaction with Fragment. */
export interface TransactionPartnerFragment {
    /** Type of the transaction partner, always “fragment” */
    type: "fragment";
    /** State of the transaction if the transaction is outgoing */
    withdrawal_state?: RevenueWithdrawalState;
}
/** Describes a withdrawal transaction to the Telegram Ads platform. */
export interface TransactionPartnerTelegramAds {
    /** Type of the transaction partner, always “telegram_ads” */
    type: "telegram_ads";
}
/** Describes a transaction with payment for paid broadcasting. */
export interface TransactionPartnerTelegramApi {
    /** Type of the transaction partner, always “telegram_api” */
    type: "telegram_api";
    /** The number of successful requests that exceeded regular limits and were therefore billed */
    request_count: number;
}
/** Describes a transaction with an unknown source or recipient. */
export interface TransactionPartnerOther {
    /** Type of the transaction partner, always “other” */
    type: "other";
}
/** Describes a Telegram Star transaction. Note that if the buyer initiates a chargeback with the payment provider from whom they acquired Stars (e.g., Apple, Google) following this transaction, the refunded Stars will be deducted from the bot's balance. This is outside of Telegram's control. */
export interface StarTransaction {
    /** Unique identifier of the transaction. Coincides with the identifier of the original transaction for refund transactions. Coincides with SuccessfulPayment.telegram_payment_charge_id for successful incoming payments from users. */
    id: string;
    /** Integer amount of Telegram Stars transferred by the transaction */
    amount: number;
    /** The number of 1/1000000000 shares of Telegram Stars transferred by the transaction; from 0 to 999999999 */
    nanostar_amount?: number;
    /** Date the transaction was created in Unix time */
    date: number;
    /** Source of an incoming transaction (e.g., a user purchasing goods or services, Fragment refunding a failed withdrawal). Only for incoming transactions */
    source?: TransactionPartner;
    /** Receiver of an outgoing transaction (e.g., a user for a purchase refund, Fragment for a withdrawal). Only for outgoing transactions */
    receiver?: TransactionPartner;
}
/** Contains a list of Telegram Star transactions. */
export interface StarTransactions {
    /** The list of transactions */
    transactions: StarTransaction[];
}
/** This object contains information about a paid media purchase. */
export interface PaidMediaPurchased {
    /** User who purchased the media */
    from: User;
    /** Bot-specified paid media payload */
    paid_media_payload: string;
}
/** This object describes the background of a gift. */
export interface GiftBackground {
    /** Center color of the background in RGB format */
    center_color: number;
    /** Edge color of the background in RGB format */
    edge_color: number;
    /** Text color of the background in RGB format */
    text_color: number;
}
/** This object represents a gift that can be sent by the bot. */
export interface Gift {
    /** Unique identifier of the gift */
    id: string;
    /** Information about the chat that published the gift */
    publisher_chat?: Chat;
    /** The sticker that represents the gift */
    sticker: Sticker;
    /** Background of the gift */
    background?: GiftBackground;
    /** True, if the gift can only be purchased by Telegram Premium subscribers */
    is_premium?: true;
    /** True, if the gift can be used (after being upgraded) to customize a user's appearance */
    has_colors?: true;
    /** The number of Telegram Stars that must be paid to send the sticker */
    star_count: number;
    /** The number of Telegram Stars that must be paid to upgrade the gift to a unique one */
    upgrade_star_count?: number;
    /** The total number of different unique gifts that can be obtained by upgrading the gift */
    unique_gift_variant_count?: number;
    /** The total number of gifts of this type that can be sent by all users; for limited gifts only */
    total_count?: number;
    /** The number of remaining gifts of this type that can be sent by all users; for limited gifts only */
    remaining_count?: number;
    /** The total number of gifts of this type that can be sent by the bot; for limited gifts only */
    personal_total_count?: number;
    /** The number of remaining gifts of this type that can be sent by the bot; for limited gifts only */
    personal_remaining_count?: number;
}
/** This object represent a list of gifts. */
export interface Gifts {
    /** The list of gifts */
    gifts: Gift[];
}
/** This object describes the model of a unique gift. */
export interface UniqueGiftModel {
    /** Name of the model */
    name: string;
    /** The sticker that represents the unique gift */
    sticker: Sticker;
    /** The number of unique gifts that receive this model for every 1000 gift upgrades. Always 0 for crafted gifts. */
    rarity_per_mille: number;
    /** Rarity of the model if it is a crafted model. Currently, can be “uncommon”, “rare”, “epic”, or “legendary”. */
    rarity?: "uncommon" | "rare" | "epic" | "legendary";
}
/** This object describes the symbol shown on the pattern of a unique gift. */
export interface UniqueGiftSymbol {
    /** Name of the symbol */
    name: string;
    /** The sticker that represents the unique gift */
    sticker: Sticker;
    /** The number of unique gifts that receive this model for every 1000 gifts upgraded */
    rarity_per_mille: number;
}
/** This object describes the colors of the backdrop of a unique gift. */
export interface UniqueGiftBackdropColors {
    /** The color in the center of the backdrop in RGB format */
    center_color: number;
    /** The color on the edges of the backdrop in RGB format */
    edge_color: number;
    /** The color to be applied to the symbol in RGB format */
    symbol_color: number;
    /** The color for the text on the backdrop in RGB format */
    text_color: number;
}
/** This object describes the backdrop of a unique gift. */
export interface UniqueGiftBackdrop {
    /** Name of the backdrop */
    name: string;
    /** Colors of the backdrop */
    colors: UniqueGiftBackdropColors;
    /** The number of unique gifts that receive this backdrop for every 1000 gifts upgraded */
    rarity_per_mille: number;
}
/** This object describes a unique gift that was upgraded from a regular gift. */
export interface UniqueGift {
    /** Identifier of the regular gift from which the gift was upgraded */
    gift_id: string;
    /** Human-readable name of the regular gift from which this unique gift was upgraded */
    base_name: string;
    /** Unique name of the gift. This name can be used in https://t.me/nft/... links and story areas */
    name: string;
    /** Information about the chat that published the gift */
    publisher_chat?: Chat;
    /** True, if the original regular gift was exclusively purchaseable by Telegram Premium subscribers */
    is_premium?: true;
    /** True, if the gift is assigned from the TON blockchain and can't be resold or transferred in Telegram */
    is_from_blockchain?: true;
    /** Unique number of the upgraded gift among gifts upgraded from the same regular gift */
    number: number;
    /** Model of the gift */
    model: UniqueGiftModel;
    /** Symbol of the gift */
    symbol: UniqueGiftSymbol;
    /** Backdrop of the gift */
    backdrop: UniqueGiftBackdrop;
    /** The color scheme that can be used by the gift's owner for the chat's name, replies to messages and link previews */
    colors?: UniqueGiftColors;
    /** True, if the gift was used to craft another gift and isn't available anymore */
    is_burned?: true;
}
/** This object contains information about the color scheme for a user's name, message replies and link previews based on a unique gift. */
export interface UniqueGiftColors {
    /** Custom emoji identifier of the unique gift's model */
    model_custom_emoji_id: string;
    /** Custom emoji identifier of the unique gift's symbol */
    symbol_custom_emoji_id: string;
    /** Main color used in light themes; RGB format */
    light_theme_main_color: number;
    /** List of 1-3 additional colors used in light themes; RGB format */
    light_theme_other_colors: number[];
    /** Main color used in dark themes; RGB format */
    dark_theme_main_color: number;
    /** List of 1-3 additional colors used in dark themes; RGB format */
    dark_theme_other_colors: number[];
}
/** Describes a service message about a regular gift that was sent or received. */
export interface GiftInfo {
    /** Information about the gift */
    gift: Gift;
    /** Unique identifier of the received gift for the bot; only present for gifts received on behalf of business accounts */
    owned_gift_id?: string;
    /** Number of Telegram Stars that can be claimed by the receiver by converting the gift; omitted if conversion to Telegram Stars is impossible */
    convert_star_count?: number;
    /** Number of Telegram Stars that were prepaid by the sender for the ability to upgrade the gift */
    prepaid_upgrade_star_count?: number;
    /** True, if the gift can be upgraded to a unique gift */
    can_be_upgraded?: true;
    /** True, if the gift's upgrade was purchased after the gift was sent */
    is_upgrade_separate?: true;
    /** Unique number reserved for this gift when upgraded. See the number field in UniqueGift */
    unique_gift_number?: number;
    /** Text of the message that was added to the gift */
    text?: string;
    /** Special entities that appear in the text */
    entities?: MessageEntity[];
    /** True, if the sender and gift text are shown only to the gift receiver; otherwise, everyone will be able to see them */
    is_private?: true;
}
/** Describes a service message about a unique gift that was sent or received. */
export interface UniqueGiftInfo {
    /** Information about the gift */
    gift: UniqueGift;
    /** Origin of the gift. Currently, either “upgrade” for gifts upgraded from regular gifts, “transfer” for gifts transferred from other users or channels, “resale” for gifts bought from other users, “gifted_upgrade” for upgrades purchased after the gift was sent, or “offer” for gifts bought or sold through gift purchase offers */
    origin: "upgrade" | "transfer" | "resale" | "gifted_upgrade" | "offer";
    /** Unique identifier of the received gift for the bot; only present for gifts received on behalf of business accounts */
    owned_gift_id?: string;
    /** Number of Telegram Stars that must be paid to transfer the gift; omitted if the bot cannot transfer the gift */
    transfer_star_count?: number;
    /** For gifts bought from other users, the currency in which the payment for the gift was done. Currently, one of “XTR” for Telegram Stars or “TON” for toncoins. */
    last_resale_currency?: "XTR" | "TON";
    /** For gifts bought from other users, the price paid for the gift in either Telegram Stars or nanotoncoins */
    last_resale_amount?: number;
    /** Point in time (Unix timestamp) when the gift can be transferred. If it is in the past, then the gift can be transferred now */
    next_transfer_date?: number;
}
/** Describes a service message about a change in the price of paid messages within a chat. */
export interface PaidMessagePriceChanged {
    /** The new number of Telegram Stars that must be paid by non-administrator users of the supergroup chat for each sent message */
    paid_message_star_count: number;
}
/** Describes an amount of Telegram Stars. */
export interface StarAmount {
    /** Integer amount of Telegram Stars, rounded to 0; can be negative */
    amount: number;
    /** The number of 1/1000000000 shares of Telegram Stars; from -999999999 to 999999999; can be negative if and only if amount is non-positive */
    nanostar_amount?: number;
}
/** This object describes a gift received and owned by a user or a chat. Currently, it can be one of

- OwnedGiftRegular
- OwnedGiftUnique */
export type OwnedGift = OwnedGiftRegular | OwnedGiftUnique;
/** Describes a regular gift owned by a user or a chat. */
export interface OwnedGiftRegular {
    /** Type of the gift, always “regular” */
    type: "regular";
    /** Information about the regular gift */
    gift: Gift;
    /** Unique identifier of the gift for the bot; for gifts received on behalf of business accounts only */
    owned_gift_id?: string;
    /** Sender of the gift if it is a known user */
    sender_user?: User;
    /** Date the gift was sent in Unix time */
    send_date: number;
    /** Unique number reserved for this gift when upgraded. See the number field in UniqueGift */
    unique_gift_number?: number;
    /** Text of the message that was added to the gift */
    text?: string;
    /** Special entities that appear in the text */
    entities?: MessageEntity[];
    /** True, if the sender and gift text are shown only to the gift receiver; otherwise, everyone will be able to see them */
    is_private?: true;
    /** True, if the gift is displayed on the account's profile page; for gifts received on behalf of business accounts only */
    is_saved?: true;
    /** True, if the gift can be upgraded to a unique gift; for gifts received on behalf of business accounts only */
    can_be_upgraded?: true;
    /** True, if the gift's upgrade was purchased after the gift was sent */
    is_upgrade_separate?: true;
    /** True, if the gift was refunded and isn't available anymore */
    was_refunded?: true;
    /** Number of Telegram Stars that can be claimed by the receiver instead of the gift; omitted if the gift cannot be converted to Telegram Stars */
    convert_star_count?: number;
    /** Number of Telegram Stars that were paid by the sender for the ability to upgrade the gift */
    prepaid_upgrade_star_count?: number;
}
/** Describes a unique gift received and owned by a user or a chat. */
export interface OwnedGiftUnique {
    /** Type of the gift, always “unique” */
    type: "unique";
    /** Information about the unique gift */
    gift: UniqueGift;
    /** Unique identifier of the received gift for the bot; for gifts received on behalf of business accounts only */
    owned_gift_id?: string;
    /** Sender of the gift if it is a known user */
    sender_user?: User;
    /** Date the gift was sent in Unix time */
    send_date: number;
    /** True, if the gift is displayed on the account's profile page; for gifts received on behalf of business accounts only */
    is_saved?: true;
    /** True, if the gift can be transferred to another owner; for gifts received on behalf of business accounts only */
    can_be_transferred?: true;
    /** Number of Telegram Stars that must be paid to transfer the gift; omitted if the bot cannot transfer the gift */
    transfer_star_count?: number;
    /** Point in time (Unix timestamp) when the gift can be transferred. If it is in the past, then the gift can be transferred now */
    next_transfer_date?: number;
}
/** Contains the list of gifts received and owned by a user or a chat. */
export interface OwnedGifts {
    /** The total number of gifts owned by the user or the chat */
    total_count: number;
    /** The list of gifts */
    gifts: OwnedGift[];
    /** Offset for the next request. If empty, then there are no more results */
    next_offset?: string;
}
/** Describes the price of a suggested post. */
export interface SuggestedPostPrice {
    /** Currency in which the post will be paid. Currently, must be one of “XTR” for Telegram Stars or “TON” for toncoins */
    currency: "XTR" | "TON";
    /** The amount of the currency that will be paid for the post in the smallest units of the currency, i.e. Telegram Stars or nanotoncoins. Currently, price in Telegram Stars must be between 5 and 100000, and price in nanotoncoins must be between 10000000 and 10000000000000. */
    amount: number;
}
/** Contains information about a suggested post. */
export interface SuggestedPostInfo {
    /** State of the suggested post. Currently, it can be one of “pending”, “approved”, “declined”. */
    state: "pending" | "approved" | "declined";
    /** Proposed price of the post. If the field is omitted, then the post is unpaid. */
    price?: SuggestedPostPrice;
    /** Proposed send date of the post. If the field is omitted, then the post can be published at any time within 30 days at the sole discretion of the user or administrator who approves it. */
    send_date?: number;
}
/** Describes a service message about the approval of a suggested post. */
export interface SuggestedPostApproved {
    /** Message containing the suggested post. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    suggested_post_message?: Message;
    /** Amount paid for the post */
    price?: SuggestedPostPrice;
    /** Date when the post will be published */
    send_date: number;
}
/** Describes a service message about the failed approval of a suggested post. Currently, only caused by insufficient user funds at the time of approval. */
export interface SuggestedPostApprovalFailed {
    /** Message containing the suggested post whose approval has failed. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    suggested_post_message?: Message;
    /** Expected price of the post */
    price: SuggestedPostPrice;
}
/** Describes a service message about the rejection of a suggested post. */
export interface SuggestedPostDeclined {
    /** Message containing the suggested post. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    suggested_post_message?: Message;
    /** Comment with which the post was declined */
    comment?: string;
}
/** Describes a service message about a successful payment for a suggested post. */
export interface SuggestedPostPaid {
    /** Message containing the suggested post. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    suggested_post_message?: Message;
    /** Currency in which the payment was made. Currently, one of “XTR” for Telegram Stars or “TON” for toncoins */
    currency: string;
    /** The amount of the currency that was received by the channel in nanotoncoins; for payments in toncoins only */
    amount?: number;
    /** The amount of Telegram Stars that was received by the channel; for payments in Telegram Stars only */
    star_amount?: StarAmount;
}
/** Describes a service message about a payment refund for a suggested post. */
export interface SuggestedPostRefunded {
    /** Message containing the suggested post. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    suggested_post_message?: Message;
    /** Reason for the refund. Currently, one of “post_deleted” if the post was deleted within 24 hours of being posted or removed from scheduled messages without being posted, or “payment_refunded” if the payer refunded their payment. */
    reason: string;
}
