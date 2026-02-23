"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnrecoverableSocketModeStartError = void 0;
// NOTE: there may be a better way to add metadata to an error about being "unrecoverable" than to keep an
// independent enum, probably a Set (this isn't used as a type).
var UnrecoverableSocketModeStartError;
(function (UnrecoverableSocketModeStartError) {
    UnrecoverableSocketModeStartError["NotAuthed"] = "not_authed";
    UnrecoverableSocketModeStartError["InvalidAuth"] = "invalid_auth";
    UnrecoverableSocketModeStartError["AccountInactive"] = "account_inactive";
    UnrecoverableSocketModeStartError["UserRemovedFromTeam"] = "user_removed_from_team";
    UnrecoverableSocketModeStartError["TeamDisabled"] = "team_disabled";
})(UnrecoverableSocketModeStartError || (exports.UnrecoverableSocketModeStartError = UnrecoverableSocketModeStartError = {}));
//# sourceMappingURL=UnrecoverableSocketModeStartError.js.map