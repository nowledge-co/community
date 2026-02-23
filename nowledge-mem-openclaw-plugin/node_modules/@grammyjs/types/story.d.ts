import type { ReactionType } from "./message.js";
/** Describes the position of a clickable area within a story. */
export interface StoryAreaPosition {
    /** The abscissa of the area's center, as a percentage of the media width */
    x_percentage: number;
    /** The ordinate of the area's center, as a percentage of the media height */
    y_percentage: number;
    /** The width of the area's rectangle, as a percentage of the media width */
    width_percentage: number;
    /** The height of the area's rectangle, as a percentage of the media height */
    height_percentage: number;
    /** The clockwise rotation angle of the rectangle, in degrees; 0-360 */
    rotation_angle: number;
    /** The radius of the rectangle corner rounding, as a percentage of the media width */
    corner_radius_percentage: number;
}
/** Describes the physical address of a location. */
export interface LocationAddress {
    /** The two-letter ISO 3166-1 alpha-2 country code of the country where the location is located */
    country_code: string;
    /** State of the location */
    state?: string;
    /** City of the location */
    city?: string;
    /** Street address of the location */
    street?: string;
}
/** Describes the type of a clickable area on a story. Currently, it can be one of

- StoryAreaTypeLocation
- StoryAreaTypeSuggestedReaction
- StoryAreaTypeLink
- StoryAreaTypeWeather
- StoryAreaTypeUniqueGift */
export type StoryAreaType = StoryAreaTypeLocation | StoryAreaTypeSuggestedReaction | StoryAreaTypeLink | StoryAreaTypeWeather | StoryAreaTypeUniqueGift;
/** Describes a story area pointing to a location. Currently, a story can have up to 10 location areas. */
export interface StoryAreaTypeLocation {
    /** Type of the area, always “location” */
    type: "location";
    /** Location latitude in degrees */
    latitude: number;
    /** Location longitude in degrees */
    longitude: number;
    /** Address of the location */
    address?: LocationAddress;
}
/** Describes a story area pointing to a suggested reaction. Currently, a story can have up to 5 suggested reaction areas. */
export interface StoryAreaTypeSuggestedReaction {
    /** Type of the area, always “suggested_reaction” */
    type: "suggested_reaction";
    /** Type of the reaction */
    reaction_type: ReactionType;
    /** Pass True if the reaction area has a dark background */
    is_dark?: boolean;
    /** Pass True if reaction area corner is flipped */
    is_flipped?: boolean;
}
/** Describes a story area pointing to an HTTP or tg:// link. Currently, a story can have up to 3 link areas. */
export interface StoryAreaTypeLink {
    /** Type of the area, always “link” */
    type: "link";
    /** HTTP or tg:// URL to be opened when the area is clicked */
    url: string;
}
/** Describes a story area containing weather information. Currently, a story can have up to 3 weather areas. */
export interface StoryAreaTypeWeather {
    /** Type of the area, always “weather” */
    type: "weather";
    /** Temperature, in degree Celsius */
    temperature: number;
    /** Emoji representing the weather */
    emoji: string;
    /** A color of the area background in the ARGB format */
    background_color: number;
}
/** Describes a story area pointing to a unique gift. Currently, a story can have at most 1 unique gift area. */
export interface StoryAreaTypeUniqueGift {
    /** Type of the area, always “unique_gift” */
    type: "unique_gift";
    /** Unique name of the gift */
    name: string;
}
/** Describes a clickable area on a story media. */
export interface StoryArea {
    /** Position of the area */
    position: StoryAreaPosition;
    /** Type of the area */
    type: StoryAreaType;
}
