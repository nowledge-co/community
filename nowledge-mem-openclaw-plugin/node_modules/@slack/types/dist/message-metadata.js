"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomFieldType = exports.EntityType = void 0;
var EntityType;
(function (EntityType) {
    EntityType["Task"] = "slack#/entities/task";
    EntityType["File"] = "slack#/entities/file";
    EntityType["Item"] = "slack#/entities/item";
    EntityType["Incident"] = "slack#/entities/incident";
    EntityType["ContentItem"] = "slack#/entities/content_item";
})(EntityType || (exports.EntityType = EntityType = {}));
var CustomFieldType;
(function (CustomFieldType) {
    CustomFieldType["Integer"] = "integer";
    CustomFieldType["String"] = "string";
    CustomFieldType["Array"] = "array";
    CustomFieldType["Date"] = "slack#/types/date";
    CustomFieldType["Timestamp"] = "slack#/types/timestamp";
    CustomFieldType["Image"] = "slack#/types/image";
    CustomFieldType["ChannelId"] = "slack#/types/channel_id";
    CustomFieldType["User"] = "slack#/types/user";
    CustomFieldType["EntityRef"] = "slack#/types/entity_ref";
    CustomFieldType["Boolean"] = "boolean";
    CustomFieldType["Link"] = "slack#/types/link";
    CustomFieldType["Email"] = "slack#/types/email";
})(CustomFieldType || (exports.CustomFieldType = CustomFieldType = {}));
//# sourceMappingURL=message-metadata.js.map