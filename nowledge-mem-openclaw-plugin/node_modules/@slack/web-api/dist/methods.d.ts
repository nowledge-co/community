import { EventEmitter } from 'eventemitter3';
import type { AdminAnalyticsGetFileArguments, AdminAppsActivitiesListArguments, AdminAppsApproveArguments, AdminAppsApprovedListArguments, AdminAppsClearResolutionArguments, AdminAppsConfigLookupArguments, AdminAppsConfigSetArguments, AdminAppsRequestsCancelArguments, AdminAppsRequestsListArguments, AdminAppsRestrictArguments, AdminAppsRestrictedListArguments, AdminAppsUninstallArguments, AdminAuthPolicyAssignEntitiesArguments, AdminAuthPolicyGetEntitiesArguments, AdminAuthPolicyRemoveEntitiesArguments, AdminBarriersCreateArguments, AdminBarriersDeleteArguments, AdminBarriersListArguments, AdminBarriersUpdateArguments, AdminConversationsArchiveArguments, AdminConversationsBulkArchiveArguments, AdminConversationsBulkDeleteArguments, AdminConversationsBulkMoveArguments, AdminConversationsConvertToPrivateArguments, AdminConversationsConvertToPublicArguments, AdminConversationsCreateArguments, AdminConversationsDeleteArguments, AdminConversationsDisconnectSharedArguments, AdminConversationsEKMListOriginalConnectedChannelInfoArguments, AdminConversationsGetConversationPrefsArguments, AdminConversationsGetCustomRetentionArguments, AdminConversationsGetTeamsArguments, AdminConversationsInviteArguments, AdminConversationsLookupArguments, AdminConversationsRemoveCustomRetentionArguments, AdminConversationsRenameArguments, AdminConversationsRestrictAccessAddGroupArguments, AdminConversationsRestrictAccessListGroupsArguments, AdminConversationsRestrictAccessRemoveGroupArguments, AdminConversationsSearchArguments, AdminConversationsSetConversationPrefsArguments, AdminConversationsSetCustomRetentionArguments, AdminConversationsSetTeamsArguments, AdminConversationsUnarchiveArguments, AdminEmojiAddAliasArguments, AdminEmojiAddArguments, AdminEmojiListArguments, AdminEmojiRemoveArguments, AdminEmojiRenameArguments, AdminFunctionsListArguments, AdminFunctionsPermissionsLookupArguments, AdminFunctionsPermissionsSetArguments, AdminInviteRequestsApproveArguments, AdminInviteRequestsApprovedListArguments, AdminInviteRequestsDeniedListArguments, AdminInviteRequestsDenyArguments, AdminInviteRequestsListArguments, AdminRolesAddAssignmentsArguments, AdminRolesListAssignmentsArguments, AdminRolesRemoveAssignmentsArguments, AdminTeamsAdminsListArguments, AdminTeamsCreateArguments, AdminTeamsListArguments, AdminTeamsOwnersListArguments, AdminTeamsSettingsInfoArguments, AdminTeamsSettingsSetDefaultChannelsArguments, AdminTeamsSettingsSetDescriptionArguments, AdminTeamsSettingsSetDiscoverabilityArguments, AdminTeamsSettingsSetIconArguments, AdminTeamsSettingsSetNameArguments, AdminUsergroupsAddChannelsArguments, AdminUsergroupsAddTeamsArguments, AdminUsergroupsListChannelsArguments, AdminUsergroupsRemoveChannelsArguments, AdminUsersAssignArguments, AdminUsersInviteArguments, AdminUsersListArguments, AdminUsersRemoveArguments, AdminUsersSessionClearSettingsArguments, AdminUsersSessionGetSettingsArguments, AdminUsersSessionInvalidateArguments, AdminUsersSessionListArguments, AdminUsersSessionResetArguments, AdminUsersSessionResetBulkArguments, AdminUsersSessionSetSettingsArguments, AdminUsersSetAdminArguments, AdminUsersSetExpirationArguments, AdminUsersSetOwnerArguments, AdminUsersSetRegularArguments, AdminUsersUnsupportedVersionsExportArguments, AdminWorkflowsCollaboratorsAddArguments, AdminWorkflowsCollaboratorsRemoveArguments, AdminWorkflowsPermissionsLookupArguments, AdminWorkflowsSearchArguments, AdminWorkflowsUnpublishArguments, APITestArguments, AppsConnectionsOpenArguments, AppsEventAuthorizationsListArguments, AppsManifestCreateArguments, AppsManifestDeleteArguments, AppsManifestExportArguments, AppsManifestUpdateArguments, AppsManifestValidateArguments, AppsUninstallArguments, AssistantThreadsSetStatusArguments, AssistantThreadsSetSuggestedPromptsArguments, AssistantThreadsSetTitleArguments, AuthRevokeArguments, AuthTeamsListArguments, AuthTestArguments, BookmarksAddArguments, BookmarksEditArguments, BookmarksListArguments, BookmarksRemoveArguments, BotsInfoArguments, CallsAddArguments, CallsEndArguments, CallsInfoArguments, CallsParticipantsAddArguments, CallsParticipantsRemoveArguments, CallsUpdateArguments, CanvasesAccessDeleteArguments, CanvasesAccessSetArguments, CanvasesCreateArguments, CanvasesDeleteArguments, CanvasesEditArguments, CanvasesSectionsLookupArguments, ChatAppendStreamArguments, ChatDeleteArguments, ChatDeleteScheduledMessageArguments, ChatGetPermalinkArguments, ChatMeMessageArguments, ChatPostEphemeralArguments, ChatPostMessageArguments, ChatScheduledMessagesListArguments, ChatScheduleMessageArguments, ChatStartStreamArguments, ChatStopStreamArguments, ChatUnfurlArguments, ChatUpdateArguments, ConversationsAcceptSharedInviteArguments, ConversationsApproveSharedInviteArguments, ConversationsArchiveArguments, ConversationsCanvasesCreateArguments, ConversationsCloseArguments, ConversationsCreateArguments, ConversationsDeclineSharedInviteArguments, ConversationsExternalInvitePermissionsSetArguments, ConversationsHistoryArguments, ConversationsInfoArguments, ConversationsInviteArguments, ConversationsInviteSharedArguments, ConversationsJoinArguments, ConversationsKickArguments, ConversationsLeaveArguments, ConversationsListArguments, ConversationsListConnectInvitesArguments, ConversationsMarkArguments, ConversationsMembersArguments, ConversationsOpenArguments, ConversationsRenameArguments, ConversationsRepliesArguments, ConversationsRequestSharedInviteApproveArguments, ConversationsRequestSharedInviteDenyArguments, ConversationsRequestSharedInviteListArguments, ConversationsSetPurposeArguments, ConversationsSetTopicArguments, ConversationsUnarchiveArguments, DialogOpenArguments, DndEndDndArguments, DndEndSnoozeArguments, DndInfoArguments, DndSetSnoozeArguments, DndTeamInfoArguments, EmojiListArguments, EntityPresentDetailsArguments, FilesCommentsDeleteArguments, FilesCompleteUploadExternalArguments, FilesDeleteArguments, FilesGetUploadURLExternalArguments, FilesInfoArguments, FilesListArguments, FilesRemoteAddArguments, FilesRemoteInfoArguments, FilesRemoteListArguments, FilesRemoteRemoveArguments, FilesRemoteShareArguments, FilesRemoteUpdateArguments, FilesRevokePublicURLArguments, FilesSharedPublicURLArguments, FilesUploadArguments, FilesUploadV2Arguments, FunctionsCompleteErrorArguments, FunctionsCompleteSuccessArguments, MigrationExchangeArguments, OAuthAccessArguments, OAuthV2AccessArguments, OAuthV2ExchangeArguments, OpenIDConnectTokenArguments, OpenIDConnectUserInfoArguments, PinsAddArguments, PinsListArguments, PinsRemoveArguments, ReactionsAddArguments, ReactionsGetArguments, ReactionsListArguments, ReactionsRemoveArguments, RemindersAddArguments, RemindersCompleteArguments, RemindersDeleteArguments, RemindersInfoArguments, RemindersListArguments, RTMConnectArguments, RTMStartArguments, SearchAllArguments, SearchFilesArguments, SearchMessagesArguments, SlackListsAccessDeleteArguments, SlackListsAccessSetArguments, SlackListsCreateArguments, SlackListsDownloadGetArguments, SlackListsDownloadStartArguments, SlackListsItemsCreateArguments, SlackListsItemsDeleteArguments, SlackListsItemsDeleteMultipleArguments, SlackListsItemsInfoArguments, SlackListsItemsListArguments, SlackListsItemsUpdateArguments, SlackListsUpdateArguments, StarsAddRemoveArguments, StarsListArguments, TeamAccessLogsArguments, TeamBillableInfoArguments, TeamBillingInfoArguments, TeamExternalTeamsDisconnectArguments, TeamExternalTeamsListArguments, TeamInfoArguments, TeamIntegrationLogsArguments, TeamPreferencesListArguments, TeamProfileGetArguments, ToolingTokensRotateArguments, UsergroupsCreateArguments, UsergroupsDisableArguments, UsergroupsEnableArguments, UsergroupsListArguments, UsergroupsUpdateArguments, UsergroupsUsersListArguments, UsergroupsUsersUpdateArguments, UsersConversationsArguments, UsersDeletePhotoArguments, UsersDiscoverableContactsLookupArguments, UsersGetPresenceArguments, UsersIdentityArguments, UsersInfoArguments, UsersListArguments, UsersLookupByEmailArguments, UsersProfileGetArguments, UsersProfileSetArguments, UsersSetPhotoArguments, UsersSetPresenceArguments, ViewsOpenArguments, ViewsPublishArguments, ViewsPushArguments, ViewsUpdateArguments, WorkflowsFeaturedAddArguments, WorkflowsFeaturedListArguments, WorkflowsFeaturedRemoveArguments, WorkflowsFeaturedSetArguments, WorkflowsStepCompletedArguments, WorkflowsStepFailedArguments, WorkflowsUpdateStepArguments } from './types/request/index';
import type { AdminAnalyticsGetFileResponse, AdminAppsActivitiesListResponse, AdminAppsApprovedListResponse, AdminAppsApproveResponse, AdminAppsClearResolutionResponse, AdminAppsConfigLookupResponse, AdminAppsConfigSetResponse, AdminAppsRequestsCancelResponse, AdminAppsRequestsListResponse, AdminAppsRestrictedListResponse, AdminAppsRestrictResponse, AdminAppsUninstallResponse, AdminAuthPolicyAssignEntitiesResponse, AdminAuthPolicyGetEntitiesResponse, AdminAuthPolicyRemoveEntitiesResponse, AdminBarriersCreateResponse, AdminBarriersDeleteResponse, AdminBarriersListResponse, AdminBarriersUpdateResponse, AdminConversationsArchiveResponse, AdminConversationsBulkArchiveResponse, AdminConversationsBulkDeleteResponse, AdminConversationsBulkMoveResponse, AdminConversationsConvertToPrivateResponse, AdminConversationsConvertToPublicResponse, AdminConversationsCreateResponse, AdminConversationsDeleteResponse, AdminConversationsDisconnectSharedResponse, AdminConversationsEkmListOriginalConnectedChannelInfoResponse, AdminConversationsGetConversationPrefsResponse, AdminConversationsGetCustomRetentionResponse, AdminConversationsGetTeamsResponse, AdminConversationsInviteResponse, AdminConversationsLookupResponse, AdminConversationsRemoveCustomRetentionResponse, AdminConversationsRenameResponse, AdminConversationsRestrictAccessAddGroupResponse, AdminConversationsRestrictAccessListGroupsResponse, AdminConversationsRestrictAccessRemoveGroupResponse, AdminConversationsSearchResponse, AdminConversationsSetConversationPrefsResponse, AdminConversationsSetCustomRetentionResponse, AdminConversationsSetTeamsResponse, AdminConversationsUnarchiveResponse, AdminEmojiAddAliasResponse, AdminEmojiAddResponse, AdminEmojiListResponse, AdminEmojiRemoveResponse, AdminEmojiRenameResponse, AdminFunctionsListResponse, AdminFunctionsPermissionsLookupResponse, AdminFunctionsPermissionsSetResponse, AdminInviteRequestsApprovedListResponse, AdminInviteRequestsApproveResponse, AdminInviteRequestsDeniedListResponse, AdminInviteRequestsDenyResponse, AdminInviteRequestsListResponse, AdminRolesAddAssignmentsResponse, AdminRolesListAssignmentsResponse, AdminRolesRemoveAssignmentsResponse, AdminTeamsAdminsListResponse, AdminTeamsCreateResponse, AdminTeamsListResponse, AdminTeamsOwnersListResponse, AdminTeamsSettingsInfoResponse, AdminTeamsSettingsSetDefaultChannelsResponse, AdminTeamsSettingsSetDescriptionResponse, AdminTeamsSettingsSetDiscoverabilityResponse, AdminTeamsSettingsSetIconResponse, AdminTeamsSettingsSetNameResponse, AdminUsergroupsAddChannelsResponse, AdminUsergroupsAddTeamsResponse, AdminUsergroupsListChannelsResponse, AdminUsergroupsRemoveChannelsResponse, AdminUsersAssignResponse, AdminUsersInviteResponse, AdminUsersListResponse, AdminUsersRemoveResponse, AdminUsersSessionClearSettingsResponse, AdminUsersSessionGetSettingsResponse, AdminUsersSessionInvalidateResponse, AdminUsersSessionListResponse, AdminUsersSessionResetBulkResponse, AdminUsersSessionResetResponse, AdminUsersSessionSetSettingsResponse, AdminUsersSetAdminResponse, AdminUsersSetExpirationResponse, AdminUsersSetOwnerResponse, AdminUsersSetRegularResponse, AdminUsersUnsupportedVersionsExportResponse, AdminWorkflowsCollaboratorsAddResponse, AdminWorkflowsCollaboratorsRemoveResponse, AdminWorkflowsPermissionsLookupResponse, AdminWorkflowsSearchResponse, AdminWorkflowsUnpublishResponse, ApiTestResponse, AppsConnectionsOpenResponse, AppsEventAuthorizationsListResponse, AppsManifestCreateResponse, AppsManifestDeleteResponse, AppsManifestExportResponse, AppsManifestUpdateResponse, AppsManifestValidateResponse, AppsUninstallResponse, AssistantThreadsSetStatusResponse, AssistantThreadsSetSuggestedPromptsResponse, AssistantThreadsSetTitleResponse, AuthRevokeResponse, AuthTeamsListResponse, AuthTestResponse, BookmarksAddResponse, BookmarksEditResponse, BookmarksListResponse, BookmarksRemoveResponse, BotsInfoResponse, CallsAddResponse, CallsEndResponse, CallsInfoResponse, CallsParticipantsAddResponse, CallsParticipantsRemoveResponse, CallsUpdateResponse, CanvasesAccessDeleteResponse, CanvasesAccessSetResponse, CanvasesCreateResponse, CanvasesDeleteResponse, CanvasesEditResponse, CanvasesSectionsLookupResponse, ChatAppendStreamResponse, ChatDeleteResponse, ChatDeleteScheduledMessageResponse, ChatGetPermalinkResponse, ChatMeMessageResponse, ChatPostEphemeralResponse, ChatPostMessageResponse, ChatScheduledMessagesListResponse, ChatScheduleMessageResponse, ChatStartStreamResponse, ChatStopStreamResponse, ChatUnfurlResponse, ChatUpdateResponse, ConversationsAcceptSharedInviteResponse, ConversationsApproveSharedInviteResponse, ConversationsArchiveResponse, ConversationsCanvasesCreateResponse, ConversationsCloseResponse, ConversationsCreateResponse, ConversationsDeclineSharedInviteResponse, ConversationsExternalInvitePermissionsSetResponse, ConversationsHistoryResponse, ConversationsInfoResponse, ConversationsInviteResponse, ConversationsInviteSharedResponse, ConversationsJoinResponse, ConversationsKickResponse, ConversationsLeaveResponse, ConversationsListConnectInvitesResponse, ConversationsListResponse, ConversationsMarkResponse, ConversationsMembersResponse, ConversationsOpenResponse, ConversationsRenameResponse, ConversationsRepliesResponse, ConversationsRequestSharedInviteApproveResponse, ConversationsRequestSharedInviteDenyResponse, ConversationsRequestSharedInviteListResponse, ConversationsSetPurposeResponse, ConversationsSetTopicResponse, ConversationsUnarchiveResponse, DialogOpenResponse, DndEndDndResponse, DndEndSnoozeResponse, DndInfoResponse, DndSetSnoozeResponse, DndTeamInfoResponse, EmojiListResponse, EntityPresentDetailsResponse, FilesCommentsDeleteResponse, FilesCompleteUploadExternalResponse, FilesDeleteResponse, FilesGetUploadURLExternalResponse, FilesInfoResponse, FilesListResponse, FilesRemoteAddResponse, FilesRemoteInfoResponse, FilesRemoteListResponse, FilesRemoteRemoveResponse, FilesRemoteShareResponse, FilesRemoteUpdateResponse, FilesRevokePublicURLResponse, FilesSharedPublicURLResponse, FilesUploadResponse, FunctionsCompleteErrorResponse, FunctionsCompleteSuccessResponse, MigrationExchangeResponse, OauthAccessResponse, OauthV2AccessResponse, OauthV2ExchangeResponse, OpenIDConnectTokenResponse, OpenIDConnectUserInfoResponse, PinsAddResponse, PinsListResponse, PinsRemoveResponse, ReactionsAddResponse, ReactionsGetResponse, ReactionsListResponse, ReactionsRemoveResponse, RemindersAddResponse, RemindersCompleteResponse, RemindersDeleteResponse, RemindersInfoResponse, RemindersListResponse, RtmConnectResponse, RtmStartResponse, SearchAllResponse, SearchFilesResponse, SearchMessagesResponse, SlackListsAccessDeleteResponse, SlackListsAccessSetResponse, SlackListsCreateResponse, SlackListsDownloadGetResponse, SlackListsDownloadStartResponse, SlackListsItemsCreateResponse, SlackListsItemsDeleteMultipleResponse, SlackListsItemsDeleteResponse, SlackListsItemsInfoResponse, SlackListsItemsListResponse, SlackListsItemsUpdateResponse, SlackListsUpdateResponse, StarsAddResponse, StarsListResponse, StarsRemoveResponse, TeamAccessLogsResponse, TeamBillableInfoResponse, TeamBillingInfoResponse, TeamExternalTeamsDisconnectResponse, TeamExternalTeamsListResponse, TeamInfoResponse, TeamIntegrationLogsResponse, TeamPreferencesListResponse, TeamProfileGetResponse, ToolingTokensRotateResponse, UsergroupsCreateResponse, UsergroupsDisableResponse, UsergroupsEnableResponse, UsergroupsListResponse, UsergroupsUpdateResponse, UsergroupsUsersListResponse, UsergroupsUsersUpdateResponse, UsersConversationsResponse, UsersDeletePhotoResponse, UsersDiscoverableContactsLookupResponse, UsersGetPresenceResponse, UsersIdentityResponse, UsersInfoResponse, UsersListResponse, UsersLookupByEmailResponse, UsersProfileGetResponse, UsersProfileSetResponse, UsersSetPhotoResponse, UsersSetPresenceResponse, ViewsOpenResponse, ViewsPublishResponse, ViewsPushResponse, ViewsUpdateResponse, WorkflowsFeaturedListResponse, WorkflowsStepCompletedResponse, WorkflowsStepFailedResponse, WorkflowsUpdateStepResponse } from './types/response/index';
import { type WebAPICallResult, type WebClientEvent } from './WebClient';
/**
 * Generic method definition
 */
type MethodWithRequiredArgument<MethodArguments, MethodResult extends WebAPICallResult = WebAPICallResult> = (options: MethodArguments) => Promise<MethodResult>;
type MethodWithOptionalArgument<MethodArguments, MethodResult extends WebAPICallResult = WebAPICallResult> = (options?: MethodArguments) => Promise<MethodResult>;
export default MethodWithOptionalArgument;
/**
 * A class that defines all Web API methods, their arguments type, their response type, and binds those methods to the
 * `apiCall` class method.
 */
export declare abstract class Methods extends EventEmitter<WebClientEvent> {
    protected constructor();
    abstract apiCall(method: string, options?: Record<string, unknown>): Promise<WebAPICallResult>;
    abstract filesUploadV2(options: FilesUploadV2Arguments): Promise<WebAPICallResult>;
    readonly admin: {
        analytics: {
            /**
             * @description Retrieve analytics data for a given date, presented as a compressed JSON file.
             * @see {@link https://docs.slack.dev/reference/methods/api.test `api.test` API reference}.
             */
            getFile: MethodWithRequiredArgument<AdminAnalyticsGetFileArguments, AdminAnalyticsGetFileResponse>;
        };
        apps: {
            activities: {
                /**
                 * @description Get logs for a specified team/org.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.activities.list `admin.apps.activities.list` API reference}.
                 */
                list: MethodWithOptionalArgument<AdminAppsActivitiesListArguments, AdminAppsActivitiesListResponse>;
            };
            /**
             * @description Approve an app for installation on a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.apps.approve `admin.apps.approve` API reference}.
             */
            approve: MethodWithRequiredArgument<AdminAppsApproveArguments, AdminAppsApproveResponse>;
            approved: {
                /**
                 * @description List approved apps for an org or workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.approved.list `admin.apps.approved.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminAppsApprovedListArguments, AdminAppsApprovedListResponse>;
            };
            /**
             * @description Clear an app resolution.
             * @see {@link https://docs.slack.dev/reference/methods/admin.apps.clearResolution `admin.apps.clearResolution` API reference}.
             */
            clearResolution: MethodWithRequiredArgument<AdminAppsClearResolutionArguments, AdminAppsClearResolutionResponse>;
            config: {
                /**
                 * @description Look up the app config for connectors by their IDs.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.config.lookup `admin.apps.config.lookup` API reference}.
                 */
                lookup: MethodWithRequiredArgument<AdminAppsConfigLookupArguments, AdminAppsConfigLookupResponse>;
                /**
                 * @description Set the app config for a connector.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.config.set `admin.apps.config.set` API reference}.
                 */
                set: MethodWithRequiredArgument<AdminAppsConfigSetArguments, AdminAppsConfigSetResponse>;
            };
            requests: {
                /**
                 * @description Cancel app request for team.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.requests.cancel `admin.apps.requests.cancel` API reference}.
                 */
                cancel: MethodWithRequiredArgument<AdminAppsRequestsCancelArguments, AdminAppsRequestsCancelResponse>;
                /**
                 * @description List app requests for a team/workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.requests.list `admin.apps.requests.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminAppsRequestsListArguments, AdminAppsRequestsListResponse>;
            };
            /**
             * @description Restrict an app for installation on a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.apps.restrict `admin.apps.restrict` API reference}.
             */
            restrict: MethodWithRequiredArgument<AdminAppsRestrictArguments, AdminAppsRestrictResponse>;
            restricted: {
                /**
                 * @description List restricted apps for an org or workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.apps.restricted.list `admin.apps.restricted.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminAppsRestrictedListArguments, AdminAppsRestrictedListResponse>;
            };
            /**
             * @description Uninstall an app from one or many workspaces, or an entire enterprise organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.apps.uninstall `admin.apps.uninstall` API reference}.
             */
            uninstall: MethodWithRequiredArgument<AdminAppsUninstallArguments, AdminAppsUninstallResponse>;
        };
        auth: {
            policy: {
                /**
                 * @description Assign entities to a particular authentication policy.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.auth.policy.assignEntities `admin.auth.policy.assignEntities` API reference}.
                 */
                assignEntities: MethodWithRequiredArgument<AdminAuthPolicyAssignEntitiesArguments, AdminAuthPolicyAssignEntitiesResponse>;
                /**
                 * @description Fetch all the entities assigned to a particular authentication policy by name.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.auth.policy.getEntities `admin.auth.policy.getEntities` API reference}.
                 */
                getEntities: MethodWithRequiredArgument<AdminAuthPolicyGetEntitiesArguments, AdminAuthPolicyGetEntitiesResponse>;
                /**
                 * @description Remove specified entities from a specified authentication policy.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.auth.policy.removeEntities `admin.auth.policy.removeEntities` API reference}.
                 */
                removeEntities: MethodWithRequiredArgument<AdminAuthPolicyRemoveEntitiesArguments, AdminAuthPolicyRemoveEntitiesResponse>;
            };
        };
        barriers: {
            /**
             * @description Create an Information Barrier.
             * @see {@link https://docs.slack.dev/reference/methods/admin.barriers.create `admin.barriers.create` API reference}.
             */
            create: MethodWithRequiredArgument<AdminBarriersCreateArguments, AdminBarriersCreateResponse>;
            /**
             * @description Delete an existing Information Barrier.
             * @see {@link https://docs.slack.dev/reference/methods/admin.barriers.delete `admin.barriers.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<AdminBarriersDeleteArguments, AdminBarriersDeleteResponse>;
            /**
             * @description Get all Information Barriers for your organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.barriers.list `admin.barriers.list` API reference}.
             */
            list: MethodWithOptionalArgument<AdminBarriersListArguments, AdminBarriersListResponse>;
            /**
             * @description Update an existing Information Barrier.
             * @see {@link https://docs.slack.dev/reference/methods/admin.barriers.update `admin.barriers.update` API reference}.
             */
            update: MethodWithRequiredArgument<AdminBarriersUpdateArguments, AdminBarriersUpdateResponse>;
        };
        conversations: {
            /**
             * @description Archive a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.archive `admin.conversations.archive` API reference}.
             */
            archive: MethodWithRequiredArgument<AdminConversationsArchiveArguments, AdminConversationsArchiveResponse>;
            /**
             * @description Archive public or private channels in bulk.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.bulkArchive `admin.conversations.bulkArchive` API reference}.
             */
            bulkArchive: MethodWithRequiredArgument<AdminConversationsBulkArchiveArguments, AdminConversationsBulkArchiveResponse>;
            /**
             * @description Delete public or private channels in bulk.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.bulkDelete `admin.conversations.bulkDelete` API reference}.
             */
            bulkDelete: MethodWithRequiredArgument<AdminConversationsBulkDeleteArguments, AdminConversationsBulkDeleteResponse>;
            /**
             * @description Move public or private channels in bulk.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.bulkMove `admin.conversations.bulkMove` API reference}.
             */
            bulkMove: MethodWithRequiredArgument<AdminConversationsBulkMoveArguments, AdminConversationsBulkMoveResponse>;
            /**
             * @description Convert a public channel to a private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.convertToPrivate `admin.conversations.convertToPrivate` API reference}.
             */
            convertToPrivate: MethodWithRequiredArgument<AdminConversationsConvertToPrivateArguments, AdminConversationsConvertToPrivateResponse>;
            /**
             * @description Convert a private channel to a public channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.convertToPublic `admin.conversations.convertToPublic` API reference}.
             */
            convertToPublic: MethodWithRequiredArgument<AdminConversationsConvertToPublicArguments, AdminConversationsConvertToPublicResponse>;
            /**
             * @description Create a public or private channel-based conversation.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.create `admin.conversations.create` API reference}.
             */
            create: MethodWithRequiredArgument<AdminConversationsCreateArguments, AdminConversationsCreateResponse>;
            /**
             * @description Delete a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.delete `admin.conversations.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<AdminConversationsDeleteArguments, AdminConversationsDeleteResponse>;
            /**
             * @description Disconnect a connected channel from one or more workspaces.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.disconnectShared `admin.conversations.disconnectShared` API reference}.
             */
            disconnectShared: MethodWithRequiredArgument<AdminConversationsDisconnectSharedArguments, AdminConversationsDisconnectSharedResponse>;
            ekm: {
                /**
                 * @description List all disconnected channels — i.e., channels that were once connected to other workspaces
                 * and then disconnected — and the corresponding original channel IDs for key revocation with EKM.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.ekm.listOriginalConnectedChannelInfo `admin.conversations.ekm.listOriginalConnectedChannelInfo` API reference}.
                 */
                listOriginalConnectedChannelInfo: MethodWithOptionalArgument<AdminConversationsEKMListOriginalConnectedChannelInfoArguments, AdminConversationsEkmListOriginalConnectedChannelInfoResponse>;
            };
            /**
             * @description Get conversation preferences for a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.getConversationPrefs `admin.conversations.getConversationPrefs` API reference}.
             */
            getConversationPrefs: MethodWithRequiredArgument<AdminConversationsGetConversationPrefsArguments, AdminConversationsGetConversationPrefsResponse>;
            /**
             * @description Get a conversation's retention policy.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.getCustomRetention `admin.conversations.getCustomRetention` API reference}.
             */
            getCustomRetention: MethodWithRequiredArgument<AdminConversationsGetCustomRetentionArguments, AdminConversationsGetCustomRetentionResponse>;
            /**
             * @description Get all the workspaces a given public or private channel is connected to within
             * this Enterprise org.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.getTeams `admin.conversations.getTeams` API reference}.
             */
            getTeams: MethodWithRequiredArgument<AdminConversationsGetTeamsArguments, AdminConversationsGetTeamsResponse>;
            /**
             * @description Invite a user to a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.invite `admin.conversations.invite` API reference}.
             */
            invite: MethodWithRequiredArgument<AdminConversationsInviteArguments, AdminConversationsInviteResponse>;
            /**
             * @description Returns channels on the given team using the filters.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.lookup `admin.conversations.lookup` API reference}.
             */
            lookup: MethodWithRequiredArgument<AdminConversationsLookupArguments, AdminConversationsLookupResponse>;
            /**
             * @description Remove a conversation's retention policy.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.removeCustomRetention `admin.conversations.removeCustomRetention` API reference}.
             */
            removeCustomRetention: MethodWithRequiredArgument<AdminConversationsRemoveCustomRetentionArguments, AdminConversationsRemoveCustomRetentionResponse>;
            /**
             * @description Rename a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.rename `admin.conversations.rename` API reference}.
             */
            rename: MethodWithRequiredArgument<AdminConversationsRenameArguments, AdminConversationsRenameResponse>;
            restrictAccess: {
                /**
                 * @description Add an allowlist of IDP groups for accessing a channel.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.restrictAccess.addGroup `admin.conversations.restrictAccess.addGroup` API reference}.
                 */
                addGroup: MethodWithRequiredArgument<AdminConversationsRestrictAccessAddGroupArguments, AdminConversationsRestrictAccessAddGroupResponse>;
                /**
                 * @description List all IDP Groups linked to a channel.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.restrictAccess.listGroups `admin.conversations.restrictAccess.listGroups` API reference}.
                 */
                listGroups: MethodWithRequiredArgument<AdminConversationsRestrictAccessListGroupsArguments, AdminConversationsRestrictAccessListGroupsResponse>;
                /**
                 * @description Remove a linked IDP group linked from a private channel.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.restrictAccess.removeGroup `admin.conversations.restrictAccess.removeGroup` API reference}.
                 */
                removeGroup: MethodWithRequiredArgument<AdminConversationsRestrictAccessRemoveGroupArguments, AdminConversationsRestrictAccessRemoveGroupResponse>;
            };
            /**
             * @description Search for public or private channels in an Enterprise organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.search `admin.conversations.search` API reference}.
             */
            search: MethodWithOptionalArgument<AdminConversationsSearchArguments, AdminConversationsSearchResponse>;
            /**
             * @description Set the posting permissions for a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.setConversationPrefs `admin.conversations.setConversationPrefs` API reference}.
             */
            setConversationPrefs: MethodWithRequiredArgument<AdminConversationsSetConversationPrefsArguments, AdminConversationsSetConversationPrefsResponse>;
            /**
             * @description Set a conversation's retention policy.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.setCustomRetention `admin.conversations.setCustomRetention` API reference}.
             */
            setCustomRetention: MethodWithRequiredArgument<AdminConversationsSetCustomRetentionArguments, AdminConversationsSetCustomRetentionResponse>;
            /**
             * @description Set the workspaces in an Enterprise grid org that connect to a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.setTeams `admin.conversations.setTeams` API reference}.
             */
            setTeams: MethodWithRequiredArgument<AdminConversationsSetTeamsArguments, AdminConversationsSetTeamsResponse>;
            /**
             * @description Unarchive a public or private channel.
             * @see {@link https://docs.slack.dev/reference/methods/admin.conversations.unarchive `admin.conversations.unarchive` API reference}.
             */
            unarchive: MethodWithRequiredArgument<AdminConversationsUnarchiveArguments, AdminConversationsUnarchiveResponse>;
        };
        emoji: {
            /**
             * @description Add an emoji.
             * @see {@link https://docs.slack.dev/reference/methods/admin.emoji.add `admin.emoji.add` API reference}.
             */
            add: MethodWithRequiredArgument<AdminEmojiAddArguments, AdminEmojiAddResponse>;
            /**
             * @description Add an emoji alias.
             * @see {@link https://docs.slack.dev/reference/methods/admin.emoji.addAlias `admin.emoji.addAlias` API reference}.
             */
            addAlias: MethodWithRequiredArgument<AdminEmojiAddAliasArguments, AdminEmojiAddAliasResponse>;
            /**
             * @description List emoji for an Enterprise Grid organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.emoji.list `admin.emoji.list` API reference}.
             */
            list: MethodWithOptionalArgument<AdminEmojiListArguments, AdminEmojiListResponse>;
            /**
             * @description Remove an emoji across an Enterprise Grid organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.emoji.remove `admin.emoji.remove` API reference}.
             */
            remove: MethodWithRequiredArgument<AdminEmojiRemoveArguments, AdminEmojiRemoveResponse>;
            /**
             * @description Rename an emoji.
             * @see {@link https://docs.slack.dev/reference/methods/admin.emoji.rename `admin.emoji.rename` API reference}.
             */
            rename: MethodWithRequiredArgument<AdminEmojiRenameArguments, AdminEmojiRenameResponse>;
        };
        functions: {
            /**
             * @description Look up functions by a set of apps.
             * @see {@link https://docs.slack.dev/reference/methods/admin.functions.list `admin.functions.list` API reference}.
             */
            list: MethodWithRequiredArgument<AdminFunctionsListArguments, AdminFunctionsListResponse>;
            permissions: {
                /**
                 * @description Lookup the visibility of multiple Slack functions and include the users if
                 * it is limited to particular named entities.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.functions.permissions.lookup `admin.functions.permissions.lookup` API reference}.
                 */
                lookup: MethodWithRequiredArgument<AdminFunctionsPermissionsLookupArguments, AdminFunctionsPermissionsLookupResponse>;
                /**
                 * @description Set the visibility of a Slack function and define the users or workspaces if
                 * it is set to named_entities.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.functions.permissions.set `admin.functions.permissions.set` API reference}.
                 */
                set: MethodWithRequiredArgument<AdminFunctionsPermissionsSetArguments, AdminFunctionsPermissionsSetResponse>;
            };
        };
        inviteRequests: {
            /**
             * @description Approve a workspace invite request.
             * @see {@link https://docs.slack.dev/reference/methods/admin.inviteRequests.approve `admin.inviteRequests.approve` API reference}.
             */
            approve: MethodWithRequiredArgument<AdminInviteRequestsApproveArguments, AdminInviteRequestsApproveResponse>;
            approved: {
                /**
                 * @description List all approved workspace invite requests.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.inviteRequests.approved.list `admin.inviteRequests.approved.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminInviteRequestsApprovedListArguments, AdminInviteRequestsApprovedListResponse>;
            };
            denied: {
                /**
                 * @description List all denied workspace invite requests.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.inviteRequests.denied.list `admin.inviteRequests.denied.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminInviteRequestsDeniedListArguments, AdminInviteRequestsDeniedListResponse>;
            };
            /**
             * @description Deny a workspace invite request.
             * @see {@link https://docs.slack.dev/reference/methods/admin.inviteRequests.deny `admin.inviteRequests.deny` API reference}.
             */
            deny: MethodWithRequiredArgument<AdminInviteRequestsDenyArguments, AdminInviteRequestsDenyResponse>;
            /**
             * @description List all pending workspace invite requests.
             * @see {@link https://docs.slack.dev/reference/methods/admin.inviteRequests.list `admin.inviteRequests.list` API reference}.
             */
            list: MethodWithRequiredArgument<AdminInviteRequestsListArguments, AdminInviteRequestsListResponse>;
        };
        roles: {
            /**
             * @description Adds members to the specified role with the specified scopes.
             * @see {@link https://docs.slack.dev/reference/methods/admin.roles.addAssignments `admin.roles.addAssignments` API reference}.
             */
            addAssignments: MethodWithRequiredArgument<AdminRolesAddAssignmentsArguments, AdminRolesAddAssignmentsResponse>;
            /**
             * @description Lists assignments for all roles across entities.
             * Options to scope results by any combination of roles or entities.
             * @see {@link https://docs.slack.dev/reference/methods/admin.roles.listAssignments `admin.roles.listAssignments` API reference}.
             */
            listAssignments: MethodWithOptionalArgument<AdminRolesListAssignmentsArguments, AdminRolesListAssignmentsResponse>;
            /**
             * @description Removes a set of users from a role for the given scopes and entities.
             * @see {@link https://docs.slack.dev/reference/methods/admin.roles.removeAssignments `admin.roles.removeAssignments` API reference}.
             */
            removeAssignments: MethodWithRequiredArgument<AdminRolesRemoveAssignmentsArguments, AdminRolesRemoveAssignmentsResponse>;
        };
        teams: {
            admins: {
                /**
                 * @description List all of the admins on a given workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.admins.list `admin.teams.admins.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminTeamsAdminsListArguments, AdminTeamsAdminsListResponse>;
            };
            /**
             * @description Create an Enterprise team.
             * @see {@link https://docs.slack.dev/reference/methods/admin.teams.create `admin.teams.create` API reference}.
             */
            create: MethodWithRequiredArgument<AdminTeamsCreateArguments, AdminTeamsCreateResponse>;
            /**
             * @description List all teams on an Enterprise organization.
             * @see {@link https://docs.slack.dev/reference/methods/admin.teams.list `admin.teams.list` API reference}.
             */
            list: MethodWithOptionalArgument<AdminTeamsListArguments, AdminTeamsListResponse>;
            owners: {
                /**
                 * @description List all of the owners on a given workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.owners.list `admin.teams.owners.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AdminTeamsOwnersListArguments, AdminTeamsOwnersListResponse>;
            };
            settings: {
                /**
                 * @description Fetch information about settings in a workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.info `admin.teams.settings.info` API reference}.
                 */
                info: MethodWithRequiredArgument<AdminTeamsSettingsInfoArguments, AdminTeamsSettingsInfoResponse>;
                /**
                 * @description Set the default channels of a workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.setDefaultChannels `admin.teams.settings.setDefaultChannels` API reference}.
                 */
                setDefaultChannels: MethodWithRequiredArgument<AdminTeamsSettingsSetDefaultChannelsArguments, AdminTeamsSettingsSetDefaultChannelsResponse>;
                /**
                 * @description Set the description of a given workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.setDescription `admin.teams.settings.setDescription` API reference}.
                 */
                setDescription: MethodWithRequiredArgument<AdminTeamsSettingsSetDescriptionArguments, AdminTeamsSettingsSetDescriptionResponse>;
                /**
                 * @description Set the discoverability of a given workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.setDiscoverability `admin.teams.settings.setDiscoverability` API reference}.
                 */
                setDiscoverability: MethodWithRequiredArgument<AdminTeamsSettingsSetDiscoverabilityArguments, AdminTeamsSettingsSetDiscoverabilityResponse>;
                /**
                 * @description Sets the icon of a workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.setIcon `admin.teams.settings.setIcon` API reference}.
                 */
                setIcon: MethodWithRequiredArgument<AdminTeamsSettingsSetIconArguments, AdminTeamsSettingsSetIconResponse>;
                /**
                 * @description Set the name of a given workspace.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.teams.settings.setName `admin.teams.settings.setName` API reference}.
                 */
                setName: MethodWithRequiredArgument<AdminTeamsSettingsSetNameArguments, AdminTeamsSettingsSetNameResponse>;
            };
        };
        usergroups: {
            /**
             * @description Add up to one hundred default channels to an IDP group.
             * @see {@link https://docs.slack.dev/reference/methods/admin.usergroups.addChannels `admin.teams.usergroups.addChannels` API reference}.
             */
            addChannels: MethodWithRequiredArgument<AdminUsergroupsAddChannelsArguments, AdminUsergroupsAddChannelsResponse>;
            /**
             * @description Associate one or more default workspaces with an organization-wide IDP group.
             * @see {@link https://docs.slack.dev/reference/methods/admin.usergroups.addTeams `admin.teams.usergroups.addTeams` API reference}.
             */
            addTeams: MethodWithRequiredArgument<AdminUsergroupsAddTeamsArguments, AdminUsergroupsAddTeamsResponse>;
            /**
             * @description List the channels linked to an org-level IDP group (user group).
             * @see {@link https://docs.slack.dev/reference/methods/admin.usergroups.listChannels `admin.teams.usergroups.listChannels` API reference}.
             */
            listChannels: MethodWithRequiredArgument<AdminUsergroupsListChannelsArguments, AdminUsergroupsListChannelsResponse>;
            /**
             * @description Remove one or more default channels from an org-level IDP group (user group).
             * @see {@link https://docs.slack.dev/reference/methods/admin.usergroups.removeChannels `admin.teams.usergroups.removeChannels` API reference}.
             */
            removeChannels: MethodWithRequiredArgument<AdminUsergroupsRemoveChannelsArguments, AdminUsergroupsRemoveChannelsResponse>;
        };
        users: {
            /**
             * @description Add an Enterprise user to a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.assign `admin.users.assign` API reference}.
             */
            assign: MethodWithRequiredArgument<AdminUsersAssignArguments, AdminUsersAssignResponse>;
            /**
             * @description Invite a user to a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.invite `admin.users.invite` API reference}.
             */
            invite: MethodWithRequiredArgument<AdminUsersInviteArguments, AdminUsersInviteResponse>;
            /**
             * @description List users on a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.list `admin.users.list` API reference}.
             */
            list: MethodWithOptionalArgument<AdminUsersListArguments, AdminUsersListResponse>;
            /**
             * @description Remove a user from a workspace.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.remove `admin.users.remove` API reference}.
             */
            remove: MethodWithRequiredArgument<AdminUsersRemoveArguments, AdminUsersRemoveResponse>;
            session: {
                /**
                 * @description Clear user-specific session settings—the session duration and what happens when the client
                 * closes—for a list of users.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.clearSettings `admin.users.session.clearSettings` API reference}.
                 */
                clearSettings: MethodWithRequiredArgument<AdminUsersSessionClearSettingsArguments, AdminUsersSessionClearSettingsResponse>;
                /**
                 * @description Get user-specific session settings—the session duration and what happens when the client
                 * closes—given a list of users.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.getSettings `admin.users.session.getSettings` API reference}.
                 */
                getSettings: MethodWithRequiredArgument<AdminUsersSessionGetSettingsArguments, AdminUsersSessionGetSettingsResponse>;
                /**
                 * @description Revoke a single session for a user. The user will be forced to login to Slack.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.invalidate `admin.users.session.invalidate` API reference}.
                 */
                invalidate: MethodWithRequiredArgument<AdminUsersSessionInvalidateArguments, AdminUsersSessionInvalidateResponse>;
                /**
                 * @description List active user sessions for an organization.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.list `admin.users.session.list` API reference}.
                 */
                list: MethodWithOptionalArgument<AdminUsersSessionListArguments, AdminUsersSessionListResponse>;
                /**
                 * @description Wipes all valid sessions on all devices for a given user.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.reset `admin.users.session.reset` API reference}.
                 */
                reset: MethodWithRequiredArgument<AdminUsersSessionResetArguments, AdminUsersSessionResetResponse>;
                /**
                 * @description Enqueues an asynchronous job to wipe all valid sessions on all devices for a given user list.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.resetBulk `admin.users.session.resetBulk` API reference}.
                 */
                resetBulk: MethodWithRequiredArgument<AdminUsersSessionResetBulkArguments, AdminUsersSessionResetBulkResponse>;
                /**
                 * @description Configure the user-level session settings—the session duration and what happens when the client
                 * closes—for one or more users.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.session.setSettings `admin.users.session.setSettings` API reference}.
                 */
                setSettings: MethodWithRequiredArgument<AdminUsersSessionSetSettingsArguments, AdminUsersSessionSetSettingsResponse>;
            };
            /**
             * @description Set an existing guest, regular user, or owner to be an admin user.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.setAdmin `admin.users.setAdmin` API reference}.
             */
            setAdmin: MethodWithRequiredArgument<AdminUsersSetAdminArguments, AdminUsersSetAdminResponse>;
            /**
             * @description Set an expiration for a guest user.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.setExpiration `admin.users.setExpiration` API reference}.
             */
            setExpiration: MethodWithRequiredArgument<AdminUsersSetExpirationArguments, AdminUsersSetExpirationResponse>;
            /**
             * @description Set an existing guest, regular user, or admin user to be a workspace owner.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.setOwner `admin.users.setOwner` API reference}.
             */
            setOwner: MethodWithRequiredArgument<AdminUsersSetOwnerArguments, AdminUsersSetOwnerResponse>;
            /**
             * @description Set an existing guest user, admin user, or owner to be a regular user.
             * @see {@link https://docs.slack.dev/reference/methods/admin.users.setRegular `admin.users.setRegular` API reference}.
             */
            setRegular: MethodWithRequiredArgument<AdminUsersSetRegularArguments, AdminUsersSetRegularResponse>;
            unsupportedVersions: {
                /**
                 * @description Ask Slackbot to send you an export listing all workspace members using unsupported software,
                 * presented as a zipped CSV file.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.users.unsupportedVersions.export `admin.users.unsupportedVersions.export` API reference}.
                 */
                export: MethodWithRequiredArgument<AdminUsersUnsupportedVersionsExportArguments, AdminUsersUnsupportedVersionsExportResponse>;
            };
        };
        workflows: {
            collaborators: {
                /**
                 * @description Add collaborators to workflows within the team or enterprise.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.workflows.collaborators.add `admin.workflows.collaborators.add` API reference}.
                 */
                add: MethodWithRequiredArgument<AdminWorkflowsCollaboratorsAddArguments, AdminWorkflowsCollaboratorsAddResponse>;
                /**
                 * @description Remove collaborators from workflows within the team or enterprise.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.workflows.collaborators.remove `admin.workflows.collaborators.remove` API reference}.
                 */
                remove: MethodWithRequiredArgument<AdminWorkflowsCollaboratorsRemoveArguments, AdminWorkflowsCollaboratorsRemoveResponse>;
            };
            permissions: {
                /**
                 * @description Look up the permissions for a set of workflows.
                 * @see {@link https://docs.slack.dev/reference/methods/admin.workflows.permissions.lookup `admin.workflows.permissions.lookup` API reference}.
                 */
                lookup: MethodWithRequiredArgument<AdminWorkflowsPermissionsLookupArguments, AdminWorkflowsPermissionsLookupResponse>;
            };
            /**
             * @description Search workflows within the team or enterprise.
             * @see {@link https://docs.slack.dev/reference/methods/admin.workflows.search `admin.workflows.search` API reference}.
             */
            search: MethodWithOptionalArgument<AdminWorkflowsSearchArguments, AdminWorkflowsSearchResponse>;
            /**
             * @description Unpublish workflows within the team or enterprise.
             * @see {@link https://docs.slack.dev/reference/methods/admin.workflows.unpublish `admin.workflows.unpublish` API reference}.
             */
            unpublish: MethodWithRequiredArgument<AdminWorkflowsUnpublishArguments, AdminWorkflowsUnpublishResponse>;
        };
    };
    readonly api: {
        /**
         * @description Checks API calling code.
         * @see {@link https://docs.slack.dev/reference/methods/api.test `api.test` API reference}.
         */
        test: MethodWithOptionalArgument<APITestArguments, ApiTestResponse>;
    };
    readonly assistant: {
        threads: {
            /**
             * @description Set loading status to indicate that the app is building a response.
             * @see {@link https://docs.slack.dev/reference/methods/assistant.threads.setStatus `assistant.threads.setStatus` API reference}.
             */
            setStatus: MethodWithRequiredArgument<AssistantThreadsSetStatusArguments, AssistantThreadsSetStatusResponse>;
            /**
             * @description Set suggested prompts for the user. Can suggest up to four prompts.
             * @see {@link https://docs.slack.dev/reference/methods/assistant.threads.setSuggestedPrompts `assistant.threads.setSuggestedPrompts` API reference}.
             */
            setSuggestedPrompts: MethodWithRequiredArgument<AssistantThreadsSetSuggestedPromptsArguments, AssistantThreadsSetSuggestedPromptsResponse>;
            /**
             * @description Set the title of the thread. This is shown when a user views the app's chat history.
             * @see {@link https://docs.slack.dev/reference/methods/assistant.threads.setTitle `assistant.threads.setTitle` API reference}.
             */
            setTitle: MethodWithRequiredArgument<AssistantThreadsSetTitleArguments, AssistantThreadsSetTitleResponse>;
        };
    };
    readonly apps: {
        connections: {
            /**
             * @description Generate a temporary Socket Mode WebSocket URL that your app can connect to in order to receive
             * events and interactive payloads over.
             * @see {@link https://docs.slack.dev/reference/methods/apps.connections.open `apps.connections.open` API reference}.
             */
            open: MethodWithOptionalArgument<AppsConnectionsOpenArguments, AppsConnectionsOpenResponse>;
        };
        event: {
            authorizations: {
                /**
                 * @description Get a list of authorizations for the given event context.
                 * Each authorization represents an app installation that the event is visible to.
                 * @see {@link https://docs.slack.dev/reference/methods/apps.event.authorizations.list `apps.event.authorizations.list` API reference}.
                 */
                list: MethodWithRequiredArgument<AppsEventAuthorizationsListArguments, AppsEventAuthorizationsListResponse>;
            };
        };
        manifest: {
            /**
             * @description Create an app from an app manifest.
             * @see {@link https://docs.slack.dev/reference/methods/apps.manifest.create `apps.manifest.create` API reference}.
             */
            create: MethodWithRequiredArgument<AppsManifestCreateArguments, AppsManifestCreateResponse>;
            /**
             * @description Permanently deletes an app created through app manifests.
             * @see {@link https://docs.slack.dev/reference/methods/apps.manifest.delete `apps.manifest.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<AppsManifestDeleteArguments, AppsManifestDeleteResponse>;
            /**
             * @description Export an app manifest from an existing app.
             * @see {@link https://docs.slack.dev/reference/methods/apps.manifest.export `apps.manifest.export` API reference}.
             */
            export: MethodWithRequiredArgument<AppsManifestExportArguments, AppsManifestExportResponse>;
            /**
             * @description Update an app from an app manifest.
             * @see {@link https://docs.slack.dev/reference/methods/apps.manifest.update `apps.manifest.update` API reference}.
             */
            update: MethodWithRequiredArgument<AppsManifestUpdateArguments, AppsManifestUpdateResponse>;
            /**
             * @description Validate an app manifest.
             * @see {@link https://docs.slack.dev/reference/methods/apps.manifest.validate `apps.manifest.validate` API reference}.
             */
            validate: MethodWithRequiredArgument<AppsManifestValidateArguments, AppsManifestValidateResponse>;
        };
        /**
         * @description Uninstalls your app from a workspace.
         * @see {@link https://docs.slack.dev/reference/methods/apps.uninstall `apps.uninstall` API reference}.
         */
        uninstall: MethodWithRequiredArgument<AppsUninstallArguments, AppsUninstallResponse>;
    };
    readonly auth: {
        /**
         * @description Revokes a token.
         * @see {@link https://docs.slack.dev/reference/methods/auth.revoke `auth.revoke` API reference}.
         */
        revoke: MethodWithOptionalArgument<AuthRevokeArguments, AuthRevokeResponse>;
        teams: {
            /**
             * @description Obtain a full list of workspaces your org-wide app has been approved for.
             * @see {@link https://docs.slack.dev/reference/methods/auth.teams.list `auth.teams.list` API reference}.
             */
            list: MethodWithOptionalArgument<AuthTeamsListArguments, AuthTeamsListResponse>;
        };
        test: MethodWithOptionalArgument<AuthTestArguments, AuthTestResponse>;
    };
    readonly bookmarks: {
        /**
         * @description Add bookmark to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/bookmarks.add `bookmarks.add` API reference}.
         */
        add: MethodWithRequiredArgument<BookmarksAddArguments, BookmarksAddResponse>;
        /**
         * @description Edit bookmark.
         * @see {@link https://docs.slack.dev/reference/methods/bookmarks.edit `bookmarks.edit` API reference}.
         */
        edit: MethodWithRequiredArgument<BookmarksEditArguments, BookmarksEditResponse>;
        /**
         * @description List bookmarks for a channel.
         * @see {@link https://docs.slack.dev/reference/methods/bookmarks.list `bookmarks.list` API reference}.
         */
        list: MethodWithRequiredArgument<BookmarksListArguments, BookmarksListResponse>;
        /**
         * @description Remove bookmark from a channel.
         * @see {@link https://docs.slack.dev/reference/methods/bookmarks.remove `bookmarks.remove` API reference}.
         */
        remove: MethodWithRequiredArgument<BookmarksRemoveArguments, BookmarksRemoveResponse>;
    };
    readonly bots: {
        /**
         * @description Gets information about a bot user.
         * @see {@link https://docs.slack.dev/reference/methods/bots.info `bots.info` API reference}.
         */
        info: MethodWithOptionalArgument<BotsInfoArguments, BotsInfoResponse>;
    };
    readonly calls: {
        /**
         * @description Registers a new Call.
         * @see {@link https://docs.slack.dev/reference/methods/calls.add `calls.add` API reference}.
         */
        add: MethodWithRequiredArgument<CallsAddArguments, CallsAddResponse>;
        /**
         * @description Ends a Call.
         * @see {@link https://docs.slack.dev/reference/methods/calls.end `calls.end` API reference}.
         */
        end: MethodWithRequiredArgument<CallsEndArguments, CallsEndResponse>;
        /**
         * @description Returns information about a Call.
         * @see {@link https://docs.slack.dev/reference/methods/calls.info `calls.info` API reference}.
         */
        info: MethodWithRequiredArgument<CallsInfoArguments, CallsInfoResponse>;
        /**
         * @description Updates information about a Call.
         * @see {@link https://docs.slack.dev/reference/methods/calls.update `calls.update` API reference}.
         */
        update: MethodWithRequiredArgument<CallsUpdateArguments, CallsUpdateResponse>;
        participants: {
            /**
             * @description Registers new participants added to a Call.
             * @see {@link https://docs.slack.dev/reference/methods/calls.participants.add `calls.participants.add` API reference}.
             */
            add: MethodWithRequiredArgument<CallsParticipantsAddArguments, CallsParticipantsAddResponse>;
            remove: MethodWithRequiredArgument<CallsParticipantsRemoveArguments, CallsParticipantsRemoveResponse>;
        };
    };
    readonly canvases: {
        access: {
            /**
             * @description Remove access to a canvas for specified entities.
             * @see {@link https://docs.slack.dev/reference/methods/canvases.access.delete `canvases.access.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<CanvasesAccessDeleteArguments, CanvasesAccessDeleteResponse>;
            /**
             * @description Sets the access level to a canvas for specified entities.
             * @see {@link https://docs.slack.dev/reference/methods/canvases.access.set `canvases.access.set` API reference}.
             */
            set: MethodWithRequiredArgument<CanvasesAccessSetArguments, CanvasesAccessSetResponse>;
        };
        /**
         * @description Create Canvas for a user.
         * @see {@link https://docs.slack.dev/reference/methods/canvases.create `canvases.create` API reference}.
         */
        create: MethodWithOptionalArgument<CanvasesCreateArguments, CanvasesCreateResponse>;
        /**
         * @description Deletes a canvas.
         * @see {@link https://docs.slack.dev/reference/methods/canvases.delete `canvases.delete` API reference}.
         */
        delete: MethodWithRequiredArgument<CanvasesDeleteArguments, CanvasesDeleteResponse>;
        /**
         * @description Update an existing canvas.
         * @see {@link https://docs.slack.dev/reference/methods/canvases.edit `canvases.edit` API reference}.
         */
        edit: MethodWithRequiredArgument<CanvasesEditArguments, CanvasesEditResponse>;
        sections: {
            /**
             * @description Find sections matching the provided criteria.
             * @see {@link https://docs.slack.dev/reference/methods/canvases.sections.lookup `canvases.sections.lookup` API reference}.
             */
            lookup: MethodWithRequiredArgument<CanvasesSectionsLookupArguments, CanvasesSectionsLookupResponse>;
        };
    };
    readonly chat: {
        /**
         * @description Appends text to an existing streaming conversation.
         * @see {@link https://docs.slack.dev/reference/methods/chat.appendStream `chat.appendStream` API reference}.
         */
        appendStream: MethodWithRequiredArgument<ChatAppendStreamArguments, ChatAppendStreamResponse>;
        /**
         * @description Deletes a message.
         * @see {@link https://docs.slack.dev/reference/methods/chat.delete `chat.delete` API reference}.
         */
        delete: MethodWithRequiredArgument<ChatDeleteArguments, ChatDeleteResponse>;
        /**
         * @description Deletes a pending scheduled message from the queue.
         * @see {@link https://docs.slack.dev/reference/methods/chat.deleteScheduledMessage `chat.deleteScheduledMessage` API reference}.
         */
        deleteScheduledMessage: MethodWithRequiredArgument<ChatDeleteScheduledMessageArguments, ChatDeleteScheduledMessageResponse>;
        /**
         * @description Retrieve a permalink URL for a specific extant message.
         * @see {@link https://docs.slack.dev/reference/methods/chat.getPermalink `chat.getPermalink` API reference}.
         */
        getPermalink: MethodWithRequiredArgument<ChatGetPermalinkArguments, ChatGetPermalinkResponse>;
        /**
         * @description Share a me message into a channel.
         * @see {@link https://docs.slack.dev/reference/methods/chat.meMessage `chat.meMessage` API reference}.
         */
        meMessage: MethodWithRequiredArgument<ChatMeMessageArguments, ChatMeMessageResponse>;
        /**
         * @description Sends an ephemeral message to a user in a channel.
         * @see {@link https://docs.slack.dev/reference/methods/chat.postEphemeral `chat.postEphemeral` API reference}.
         */
        postEphemeral: MethodWithRequiredArgument<ChatPostEphemeralArguments, ChatPostEphemeralResponse>;
        /**
         * @description Sends a message to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/chat.postMessage `chat.postMessage` API reference}.
         */
        postMessage: MethodWithRequiredArgument<ChatPostMessageArguments, ChatPostMessageResponse>;
        /**
         * @description Schedules a message to be sent to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/chat.scheduleMessage `chat.scheduleMessage` API reference}.
         */
        scheduleMessage: MethodWithRequiredArgument<ChatScheduleMessageArguments, ChatScheduleMessageResponse>;
        scheduledMessages: {
            /**
             * @description Returns a list of scheduled messages.
             * @see {@link https://docs.slack.dev/reference/methods/chat.scheduledMessages.list `chat.scheduledMessages.list` API reference}.
             */
            list: MethodWithOptionalArgument<ChatScheduledMessagesListArguments, ChatScheduledMessagesListResponse>;
        };
        /**
         * @description Starts a new streaming conversation.
         * @see {@link https://docs.slack.dev/reference/methods/chat.startStream `chat.startStream` API reference}.
         */
        startStream: MethodWithRequiredArgument<ChatStartStreamArguments, ChatStartStreamResponse>;
        /**
         * @description Stops a streaming conversation.
         * @see {@link https://docs.slack.dev/reference/methods/chat.stopStream `chat.stopStream` API reference}.
         */
        stopStream: MethodWithRequiredArgument<ChatStopStreamArguments, ChatStopStreamResponse>;
        /**
         * @description Provide custom unfurl behavior for user-posted URLs.
         * @see {@link https://docs.slack.dev/reference/methods/chat.unfurl `chat.unfurl` API reference}.
         */
        unfurl: MethodWithRequiredArgument<ChatUnfurlArguments, ChatUnfurlResponse>;
        /**
         * @description Updates a message.
         * @see {@link https://docs.slack.dev/reference/methods/chat.update `chat.update` API reference}.
         */
        update: MethodWithRequiredArgument<ChatUpdateArguments, ChatUpdateResponse>;
    };
    readonly conversations: {
        /**
         * @description Accepts an invitation to a Slack Connect channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.acceptSharedInvite `conversations.acceptSharedInvite` API reference}.
         */
        acceptSharedInvite: MethodWithRequiredArgument<ConversationsAcceptSharedInviteArguments, ConversationsAcceptSharedInviteResponse>;
        /**
         * @description Approves an invitation to a Slack Connect channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.approveSharedInvite `conversations.approveSharedInvite` API reference}.
         */
        approveSharedInvite: MethodWithRequiredArgument<ConversationsApproveSharedInviteArguments, ConversationsApproveSharedInviteResponse>;
        /**
         * @description Archives a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.archive `conversations.archive` API reference}.
         */
        archive: MethodWithRequiredArgument<ConversationsArchiveArguments, ConversationsArchiveResponse>;
        canvases: {
            /**
             * @description Create a Channel Canvas for a channel.
             * @see {@link https://docs.slack.dev/reference/methods/conversations.canvases.create `conversations.canvases.create` API reference}.
             */
            create: MethodWithRequiredArgument<ConversationsCanvasesCreateArguments, ConversationsCanvasesCreateResponse>;
        };
        /**
         * @description Closes a direct message or multi-person direct message.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.close `conversations.close` API reference}.
         */
        close: MethodWithRequiredArgument<ConversationsCloseArguments, ConversationsCloseResponse>;
        /**
         * @description Initiates a public or private channel-based conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.create `conversations.create` API reference}.
         */
        create: MethodWithRequiredArgument<ConversationsCreateArguments, ConversationsCreateResponse>;
        /**
         * @description Declines an invitation to a Slack Connect channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.declineSharedInvite `conversations.declineSharedInvite` API reference}.
         */
        declineSharedInvite: MethodWithRequiredArgument<ConversationsDeclineSharedInviteArguments, ConversationsDeclineSharedInviteResponse>;
        externalInvitePermissions: {
            /**
             * @description Convert a team in a shared channel from an External Limited channel to a fully shared Slack
             * Connect channel or vice versa.
             * @see {@link https://docs.slack.dev/reference/methods/conversations.externalInvitePermissions.set `conversations.externalInvitePermissions.set` API reference}.
             */
            set: MethodWithRequiredArgument<ConversationsExternalInvitePermissionsSetArguments, ConversationsExternalInvitePermissionsSetResponse>;
        };
        /**
         * @description Fetches a conversation's history of messages and events.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.history `conversations.history` API reference}.
         */
        history: MethodWithRequiredArgument<ConversationsHistoryArguments, ConversationsHistoryResponse>;
        /**
         * @description Retrieve information about a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.info `conversations.info` API reference}.
         */
        info: MethodWithRequiredArgument<ConversationsInfoArguments, ConversationsInfoResponse>;
        /**
         * @description Invites users to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.invite `conversations.invite` API reference}.
         */
        invite: MethodWithRequiredArgument<ConversationsInviteArguments, ConversationsInviteResponse>;
        /**
         * @description Sends an invitation to a Slack Connect channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.inviteShared `conversations.inviteShared` API reference}.
         */
        inviteShared: MethodWithRequiredArgument<ConversationsInviteSharedArguments, ConversationsInviteSharedResponse>;
        /**
         * @description Joins an existing conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.join `conversations.join` API reference}.
         */
        join: MethodWithRequiredArgument<ConversationsJoinArguments, ConversationsJoinResponse>;
        /**
         * @description Removes a user from a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.kick `conversations.kick` API reference}.
         */
        kick: MethodWithRequiredArgument<ConversationsKickArguments, ConversationsKickResponse>;
        /**
         * @description Leaves a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.leave `conversations.leave` API reference}.
         */
        leave: MethodWithRequiredArgument<ConversationsLeaveArguments, ConversationsLeaveResponse>;
        /**
         * @description List all channels in a Slack team.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.list `conversations.list` API reference}.
         */
        list: MethodWithOptionalArgument<ConversationsListArguments, ConversationsListResponse>;
        /**
         * @description Lists shared channel invites that have been generated or received but have not been approved by
         * all parties.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.listConnectInvites `conversations.listConnectInvites` API reference}.
         */
        listConnectInvites: MethodWithOptionalArgument<ConversationsListConnectInvitesArguments, ConversationsListConnectInvitesResponse>;
        /**
         * @description Sets the read cursor in a channel.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.mark `conversations.mark` API reference}.
         */
        mark: MethodWithRequiredArgument<ConversationsMarkArguments, ConversationsMarkResponse>;
        /**
         * @description Retrieve members of a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.members `conversations.members` API reference}.
         */
        members: MethodWithRequiredArgument<ConversationsMembersArguments, ConversationsMembersResponse>;
        /**
         * @description Opens or resumes a direct message or multi-person direct message.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.open `conversations.open` API reference}.
         */
        open: MethodWithRequiredArgument<ConversationsOpenArguments, ConversationsOpenResponse>;
        /**
         * @description Renames a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.rename `conversations.rename` API reference}.
         */
        rename: MethodWithRequiredArgument<ConversationsRenameArguments, ConversationsRenameResponse>;
        /**
         * @description Retrieve a thread of messages posted to a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.replies `conversations.replies` API reference}.
         */
        replies: MethodWithRequiredArgument<ConversationsRepliesArguments, ConversationsRepliesResponse>;
        requestSharedInvite: {
            /**
             * @description Approves a request to add an external user to a channel and sends them a Slack Connect invite.
             * @see {@link https://docs.slack.dev/reference/methods/conversations.requestSharedInvite.approve `conversations.requestSharedInvite.approve` API reference}.
             */
            approve: MethodWithRequiredArgument<ConversationsRequestSharedInviteApproveArguments, ConversationsRequestSharedInviteApproveResponse>;
            /**
             * @description Denies a request to invite an external user to a channel.
             * @see {@link https://docs.slack.dev/reference/methods/conversations.requestSharedInvite.deny `conversations.requestSharedInvite.deny` API reference}.
             */
            deny: MethodWithRequiredArgument<ConversationsRequestSharedInviteDenyArguments, ConversationsRequestSharedInviteDenyResponse>;
            /**
             * @description Lists requests to add external users to channels with ability to filter.
             * @see {@link https://docs.slack.dev/reference/methods/conversations.requestSharedInvite.list `conversations.requestSharedInvite.list` API reference}.
             */
            list: MethodWithOptionalArgument<ConversationsRequestSharedInviteListArguments, ConversationsRequestSharedInviteListResponse>;
        };
        /**
         * @description Sets the purpose for a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.setPurpose `conversations.setPurpose` API reference}.
         */
        setPurpose: MethodWithRequiredArgument<ConversationsSetPurposeArguments, ConversationsSetPurposeResponse>;
        /**
         * @description Sets the topic for a conversation.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.setTopic `conversations.setTopic` API reference}.
         */
        setTopic: MethodWithRequiredArgument<ConversationsSetTopicArguments, ConversationsSetTopicResponse>;
        /**
         * @description Reverses conversation archival.
         * @see {@link https://docs.slack.dev/reference/methods/conversations.unarchive `conversations.unarchive` API reference}.
         */
        unarchive: MethodWithRequiredArgument<ConversationsUnarchiveArguments, ConversationsUnarchiveResponse>;
    };
    readonly dialog: {
        /**
         * @description Open a dialog with a user.
         * @see {@link https://docs.slack.dev/reference/methods/dialog.open `dialog.open` API reference}.
         */
        open: MethodWithRequiredArgument<DialogOpenArguments, DialogOpenResponse>;
    };
    readonly dnd: {
        /**
         * @description Ends the current user's Do Not Disturb session immediately.
         * @see {@link https://docs.slack.dev/reference/methods/dnd.endDnd `dnd.endDnd` API reference}.
         */
        endDnd: MethodWithOptionalArgument<DndEndDndArguments, DndEndDndResponse>;
        /**
         * @description Ends the current user's snooze mode immediately.
         * @see {@link https://docs.slack.dev/reference/methods/dnd.endSnooze `dnd.endSnooze` API reference}.
         */
        endSnooze: MethodWithOptionalArgument<DndEndSnoozeArguments, DndEndSnoozeResponse>;
        /**
         * @description Retrieves a user's current Do Not Disturb status.
         * @see {@link https://docs.slack.dev/reference/methods/dnd.info `dnd.info` API reference}.
         */
        info: MethodWithOptionalArgument<DndInfoArguments, DndInfoResponse>;
        /**
         * @description Turns on Do Not Disturb mode for the current user, or changes its duration.
         * @see {@link https://docs.slack.dev/reference/methods/dnd.setSnooze `dnd.setSnooze` API reference}.
         */
        setSnooze: MethodWithRequiredArgument<DndSetSnoozeArguments, DndSetSnoozeResponse>;
        /**
         * @description Retrieves the Do Not Disturb status for up to 50 users on a team.
         * @see {@link https://docs.slack.dev/reference/methods/dnd.teamInfo `dnd.teamInfo` API reference}.
         */
        teamInfo: MethodWithRequiredArgument<DndTeamInfoArguments, DndTeamInfoResponse>;
    };
    readonly emoji: {
        /**
         * @description Lists custom emoji for a team.
         * @see {@link https://docs.slack.dev/reference/methods/emoji.list `emoji.list` API reference}.
         */
        list: MethodWithOptionalArgument<EmojiListArguments, EmojiListResponse>;
    };
    readonly entity: {
        /**
         * @description Provide information about the entity to be displayed in the flexpane.
         * @see {@link https://docs.slack.dev/reference/methods/entity.presentDetails}
         */
        presentDetails: MethodWithRequiredArgument<EntityPresentDetailsArguments, EntityPresentDetailsResponse>;
    };
    readonly files: {
        /**
         * @description Finishes an upload started with {@link https://docs.slack.dev/reference/methods/files.getUploadURLExternal `files.getUploadURLExternal`}.
         * @see {@link https://docs.slack.dev/reference/methods/files.completeUploadExternal `files.completeUploadExternal` API reference}.
         */
        completeUploadExternal: MethodWithRequiredArgument<FilesCompleteUploadExternalArguments, FilesCompleteUploadExternalResponse>;
        /**
         * @description Deletes a file.
         * @see {@link https://docs.slack.dev/reference/methods/files.delete `files.delete` API reference}.
         */
        delete: MethodWithRequiredArgument<FilesDeleteArguments, FilesDeleteResponse>;
        /**
         * @description Gets a URL for an edge external file upload.
         * @see {@link https://docs.slack.dev/reference/methods/files.getUploadURLExternal `files.getUploadURLExternal` API reference}.
         */
        getUploadURLExternal: MethodWithRequiredArgument<FilesGetUploadURLExternalArguments, FilesGetUploadURLExternalResponse>;
        /**
         * @description Gets information about a file.
         * @see {@link https://docs.slack.dev/reference/methods/files.info `files.info` API reference}.
         */
        info: MethodWithRequiredArgument<FilesInfoArguments, FilesInfoResponse>;
        /**
         * @description List files for a team, in a channel, or from a user with applied filters.
         * @see {@link https://docs.slack.dev/reference/methods/files.list `files.list` API reference}.
         */
        list: MethodWithRequiredArgument<FilesListArguments, FilesListResponse>;
        /**
         * @description Revokes public/external sharing access for a file.
         * @see {@link https://docs.slack.dev/reference/methods/files.revokePublicURL `files.revokePublicURL` API reference}.
         */
        revokePublicURL: MethodWithRequiredArgument<FilesRevokePublicURLArguments, FilesRevokePublicURLResponse>;
        /**
         * @description Enables a file for public/external sharing.
         * @see {@link https://docs.slack.dev/reference/methods/files.sharedPublicURL `files.sharedPublicURL` API reference}.
         */
        sharedPublicURL: MethodWithRequiredArgument<FilesSharedPublicURLArguments, FilesSharedPublicURLResponse>;
        /**
         * @description Uploads or creates a file.
         * @deprecated Use `uploadV2` instead. See {@link https://docs.slack.dev/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay our post on retiring `files.upload`}.
         * @see {@link https://docs.slack.dev/reference/methods/files.upload `files.upload` API reference}.
         */
        upload: MethodWithRequiredArgument<FilesUploadArguments, FilesUploadResponse>;
        /**
         * @description Custom method to support a new way of uploading files to Slack.
         * Supports a single file upload
         * Supply:
         * - (required) single file or content
         * - (optional) channel, alt_text, snippet_type,
         * Supports multiple file uploads
         * Supply:
         * - multiple upload_files
         * Will try to honor both single file or content data supplied as well
         * as multiple file uploads property.
         * @see {@link https://docs.slack.dev/tools/node-slack-sdk/web-api/#upload-a-file `@slack/web-api` Upload a file documentation}.
         */
        uploadV2: MethodWithRequiredArgument<FilesUploadV2Arguments, WebAPICallResult>;
        comments: {
            /**
             * @description Deletes an existing comment on a file.
             * @see {@link https://docs.slack.dev/reference/methods/files.comments.delete `files.comments.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<FilesCommentsDeleteArguments, FilesCommentsDeleteResponse>;
        };
        remote: {
            /**
             * @description Adds a file from a remote service.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.add `files.remote.add` API reference}.
             */
            add: MethodWithRequiredArgument<FilesRemoteAddArguments, FilesRemoteAddResponse>;
            /**
             * @description Retrieve information about a remote file added to Slack.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.info `files.remote.info` API reference}.
             */
            info: MethodWithRequiredArgument<FilesRemoteInfoArguments, FilesRemoteInfoResponse>;
            /**
             * @description List remote files added to Slack.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.list `files.remote.list` API reference}.
             */
            list: MethodWithRequiredArgument<FilesRemoteListArguments, FilesRemoteListResponse>;
            /**
             * @description Remove a remote file.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.remove `files.remote.remove` API reference}.
             */
            remove: MethodWithRequiredArgument<FilesRemoteRemoveArguments, FilesRemoteRemoveResponse>;
            /**
             * @description Share a remote file into a channel.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.share `files.remote.share` API reference}.
             */
            share: MethodWithRequiredArgument<FilesRemoteShareArguments, FilesRemoteShareResponse>;
            /**
             * @description Updates an existing remote file.
             * @see {@link https://docs.slack.dev/reference/methods/files.remote.update `files.remote.update` API reference}.
             */
            update: MethodWithRequiredArgument<FilesRemoteUpdateArguments, FilesRemoteUpdateResponse>;
        };
    };
    readonly functions: {
        /**
         * @description Signal the failure to execute a Custom Function.
         * @see {@link https://docs.slack.dev/reference/methods/functions.completeError `functions.completeError` API reference}.
         */
        completeError: MethodWithRequiredArgument<FunctionsCompleteErrorArguments, FunctionsCompleteErrorResponse>;
        /**
         * @description Signal the successful completion of a Custom Function.
         * @see {@link https://docs.slack.dev/reference/methods/functions.completeSuccess `functions.completeSuccess` API reference}.
         */
        completeSuccess: MethodWithRequiredArgument<FunctionsCompleteSuccessArguments, FunctionsCompleteSuccessResponse>;
    };
    readonly migration: {
        /**
         * @description For Enterprise Grid workspaces, map local user IDs to global user IDs.
         * @see {@link https://docs.slack.dev/reference/methods/migration.exchange `migration.exchange` API reference}.
         */
        exchange: MethodWithRequiredArgument<MigrationExchangeArguments, MigrationExchangeResponse>;
    };
    readonly oauth: {
        /**
         * @description Exchanges a temporary OAuth verifier code for an access token.
         * @deprecated This is a legacy method only used by classic Slack apps. Use `oauth.v2.access` for new Slack apps.
         * @see {@link https://docs.slack.dev/reference/methods/oauth.access `oauth.access` API reference}.
         */
        access: MethodWithRequiredArgument<OAuthAccessArguments, OauthAccessResponse>;
        v2: {
            /**
             * @description Exchanges a temporary OAuth verifier code for an access token.
             * @see {@link https://docs.slack.dev/reference/methods/oauth.v2.access `oauth.v2.access` API reference}.
             */
            access: MethodWithRequiredArgument<OAuthV2AccessArguments, OauthV2AccessResponse>;
            /**
             * @description Exchanges a legacy access token for a new expiring access token and refresh token.
             * @see {@link https://docs.slack.dev/reference/methods/oauth.v2.exchange `oauth.v2.exchange` API reference}.
             */
            exchange: MethodWithRequiredArgument<OAuthV2ExchangeArguments, OauthV2ExchangeResponse>;
        };
    };
    readonly openid: {
        connect: {
            /**
             * @description Exchanges a temporary OAuth verifier code for an access token for {@link https://docs.slack.dev/authentication/sign-in-with-slack Sign in with Slack}.
             * @see {@link https://docs.slack.dev/reference/methods/openid.connect.token `openid.connect.token` API reference}.
             */
            token: MethodWithRequiredArgument<OpenIDConnectTokenArguments, OpenIDConnectTokenResponse>;
            /**
             * @description Get the identity of a user who has authorized {@link https://docs.slack.dev/authentication/sign-in-with-slack Sign in with Slack}.
             * @see {@link https://docs.slack.dev/reference/methods/openid.connect.userInfo `openid.connect.userInfo` API reference}.
             */
            userInfo: MethodWithOptionalArgument<OpenIDConnectUserInfoArguments, OpenIDConnectUserInfoResponse>;
        };
    };
    readonly pins: {
        /**
         * @description Pins an item to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/pins.add `pins.add` API reference}.
         */
        add: MethodWithRequiredArgument<PinsAddArguments, PinsAddResponse>;
        /**
         * @description Lists items pinned to a channel.
         * @see {@link https://docs.slack.dev/reference/methods/pins.list `pins.list` API reference}.
         */
        list: MethodWithRequiredArgument<PinsListArguments, PinsListResponse>;
        /**
         * @description Un-pins an item from a channel.
         * @see {@link https://docs.slack.dev/reference/methods/pins.remove `pins.remove` API reference}.
         */
        remove: MethodWithRequiredArgument<PinsRemoveArguments, PinsRemoveResponse>;
    };
    readonly reactions: {
        /**
         * @description Adds a reaction to an item.
         * @see {@link https://docs.slack.dev/reference/methods/reactions.add `reactions.add` API reference}.
         */
        add: MethodWithRequiredArgument<ReactionsAddArguments, ReactionsAddResponse>;
        /**
         * @description Gets reactions for an item.
         * @see {@link https://docs.slack.dev/reference/methods/reactions.get `reactions.get` API reference}.
         */
        get: MethodWithRequiredArgument<ReactionsGetArguments, ReactionsGetResponse>;
        /**
         * @description List reactions made by a user.
         * @see {@link https://docs.slack.dev/reference/methods/reactions.list `reactions.list` API reference}.
         */
        list: MethodWithOptionalArgument<ReactionsListArguments, ReactionsListResponse>;
        /**
         * @description Removes a reaction from an item.
         * @see {@link https://docs.slack.dev/reference/methods/reactions.remove `reactions.remove` API reference}.
         */
        remove: MethodWithRequiredArgument<ReactionsRemoveArguments, ReactionsRemoveResponse>;
    };
    readonly reminders: {
        /**
         * @description Creates a reminder.
         * @see {@link https://docs.slack.dev/reference/methods/reminders.add `reminders.add` API reference}.
         */
        add: MethodWithRequiredArgument<RemindersAddArguments, RemindersAddResponse>;
        /**
         * @description Marks a reminder as complete.
         * @see {@link https://docs.slack.dev/reference/methods/reminders.complete `reminders.complete` API reference}.
         */
        complete: MethodWithRequiredArgument<RemindersCompleteArguments, RemindersCompleteResponse>;
        /**
         * @description Deletes a reminder.
         * @see {@link https://docs.slack.dev/reference/methods/reminders.delete `reminders.delete` API reference}.
         */
        delete: MethodWithRequiredArgument<RemindersDeleteArguments, RemindersDeleteResponse>;
        /**
         * @description Gets information about a reminder.
         * @see {@link https://docs.slack.dev/reference/methods/reminders.info `reminders.info` API reference}.
         */
        info: MethodWithRequiredArgument<RemindersInfoArguments, RemindersInfoResponse>;
        /**
         * @description Lists all reminders created by or for a given user.
         * @see {@link https://docs.slack.dev/reference/methods/reminders.list `reminders.list` API reference}.
         */
        list: MethodWithOptionalArgument<RemindersListArguments, RemindersListResponse>;
    };
    readonly rtm: {
        /**
         * @description Starts a Real Time Messaging session.
         * @see {@link https://docs.slack.dev/reference/methods/rtm.connect `rtm.connect` API reference}.
         */
        connect: MethodWithOptionalArgument<RTMConnectArguments, RtmConnectResponse>;
        /**
         * @description Starts a Real Time Messaging session.
         * @deprecated Use `rtm.connect` instead. See {@link https://docs.slack.dev/changelog/2021-10-rtm-start-to-stop our post on retiring `rtm.start`}.
         * @see {@link https://docs.slack.dev/reference/methods/rtm.start `rtm.start` API reference}.
         */
        start: MethodWithOptionalArgument<RTMStartArguments, RtmStartResponse>;
    };
    readonly search: {
        /**
         * @description Searches for messages and files matching a query.
         * @see {@link https://docs.slack.dev/reference/methods/search.all search.all` API reference}.
         */
        all: MethodWithRequiredArgument<SearchAllArguments, SearchAllResponse>;
        /**
         * @description Searches for files matching a query.
         * @see {@link https://docs.slack.dev/reference/methods/search.files search.files` API reference}.
         */
        files: MethodWithRequiredArgument<SearchFilesArguments, SearchFilesResponse>;
        /**
         * @description Searches for messages matching a query.
         * @see {@link https://docs.slack.dev/reference/methods/search.messages search.messages` API reference}.
         */
        messages: MethodWithRequiredArgument<SearchMessagesArguments, SearchMessagesResponse>;
    };
    readonly slackLists: {
        access: {
            /**
             * @description Delete access for specified entities.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.access.delete `slackLists.access.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<SlackListsAccessDeleteArguments, SlackListsAccessDeleteResponse>;
            /**
             * @description Set access level for specified entities.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.access.set `slackLists.access.set` API reference}.
             */
            set: MethodWithRequiredArgument<SlackListsAccessSetArguments, SlackListsAccessSetResponse>;
        };
        /**
         * @description Create a List.
         * @see {@link https://docs.slack.dev/reference/methods/slackLists.create `slackLists.create` API reference}.
         */
        create: MethodWithRequiredArgument<SlackListsCreateArguments, SlackListsCreateResponse>;
        download: {
            /**
             * @description Get download job status.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.download.get `slackLists.download.get` API reference}.
             */
            get: MethodWithRequiredArgument<SlackListsDownloadGetArguments, SlackListsDownloadGetResponse>;
            /**
             * @description Start a download job for a list.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.download.start `slackLists.download.start` API reference}.
             */
            start: MethodWithRequiredArgument<SlackListsDownloadStartArguments, SlackListsDownloadStartResponse>;
        };
        items: {
            /**
             * @description Create a list item.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.create `slackLists.items.create` API reference}.
             */
            create: MethodWithRequiredArgument<SlackListsItemsCreateArguments, SlackListsItemsCreateResponse>;
            /**
             * @description Delete a list item.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.delete `slackLists.items.delete` API reference}.
             */
            delete: MethodWithRequiredArgument<SlackListsItemsDeleteArguments, SlackListsItemsDeleteResponse>;
            /**
             * @description Delete multiple list items.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.deleteMultiple `slackLists.items.deleteMultiple` API reference}.
             */
            deleteMultiple: MethodWithRequiredArgument<SlackListsItemsDeleteMultipleArguments, SlackListsItemsDeleteMultipleResponse>;
            /**
             * @description Get info about a list item.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.info `slackLists.items.info` API reference}.
             */
            info: MethodWithRequiredArgument<SlackListsItemsInfoArguments, SlackListsItemsInfoResponse>;
            /**
             * @description Get records from a List.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.list `slackLists.items.list` API reference}.
             */
            list: MethodWithRequiredArgument<SlackListsItemsListArguments, SlackListsItemsListResponse>;
            /**
             * @description Update a list item.
             * @see {@link https://docs.slack.dev/reference/methods/slackLists.items.update `slackLists.items.update` API reference}.
             */
            update: MethodWithRequiredArgument<SlackListsItemsUpdateArguments, SlackListsItemsUpdateResponse>;
        };
        /**
         * @description Update a list.
         * @see {@link https://docs.slack.dev/reference/methods/slackLists.update `slackLists.update` API reference}.
         */
        update: MethodWithRequiredArgument<SlackListsUpdateArguments, SlackListsUpdateResponse>;
    };
    readonly team: {
        /**
         * @description Gets the access logs for the current team.
         * @see {@link https://docs.slack.dev/reference/methods/team.accessLogs `team.accessLogs` API reference}.
         */
        accessLogs: MethodWithOptionalArgument<TeamAccessLogsArguments, TeamAccessLogsResponse>;
        /**
         * @description Gets billable users information for the current team.
         * @see {@link https://docs.slack.dev/reference/methods/team.billableInfo `team.billableInfo` API reference}.
         */
        billableInfo: MethodWithOptionalArgument<TeamBillableInfoArguments, TeamBillableInfoResponse>;
        billing: {
            /**
             * @description Reads a workspace's billing plan information.
             * @see {@link https://docs.slack.dev/reference/methods/team.billing.info `team.billing.info` API reference}.
             */
            info: MethodWithRequiredArgument<TeamBillingInfoArguments, TeamBillingInfoResponse>;
        };
        externalTeams: {
            /**
             * @description Disconnect an external organization.
             * @see {@link https://docs.slack.dev/reference/methods/team.externalTeams.disconnect `team.externalTeams.disconnect` API reference}.
             */
            disconnect: MethodWithRequiredArgument<TeamExternalTeamsDisconnectArguments, TeamExternalTeamsDisconnectResponse>;
            /**
             * @description Returns a list of all the external teams connected and details about the connection.
             * @see {@link https://docs.slack.dev/reference/methods/team.externalTeams.list `team.externalTeams.list` API reference}.
             */
            list: MethodWithRequiredArgument<TeamExternalTeamsListArguments, TeamExternalTeamsListResponse>;
        };
        /**
         * @description Gets information about the current team.
         * @see {@link https://docs.slack.dev/reference/methods/team.info `team.info` API reference}.
         */
        info: MethodWithOptionalArgument<TeamInfoArguments, TeamInfoResponse>;
        /**
         * @description Gets the integration logs for the current team.
         * @see {@link https://docs.slack.dev/reference/methods/team.integrationLogs `team.integrationLogs` API reference}.
         */
        integrationLogs: MethodWithOptionalArgument<TeamIntegrationLogsArguments, TeamIntegrationLogsResponse>;
        preferences: {
            /**
             * @description Retrieve a list of a workspace's team preferences.
             * @see {@link https://docs.slack.dev/reference/methods/team.preferences.list `team.preferences.list` API reference}.
             */
            list: MethodWithOptionalArgument<TeamPreferencesListArguments, TeamPreferencesListResponse>;
        };
        profile: {
            /**
             * @description Retrieve a team's profile.
             * @see {@link https://docs.slack.dev/reference/methods/team.profile.get `team.profile.get` API reference}.
             */
            get: MethodWithOptionalArgument<TeamProfileGetArguments, TeamProfileGetResponse>;
        };
    };
    readonly tooling: {
        tokens: {
            /**
             * @description Exchanges a refresh token for a new app configuration token.
             * @see {@link https://docs.slack.dev/reference/methods/tooling.tokens.rotate `tooling.tokens.rotate` API reference}.
             */
            rotate: MethodWithRequiredArgument<ToolingTokensRotateArguments, ToolingTokensRotateResponse>;
        };
    };
    readonly usergroups: {
        /**
         * @description Create a User Group.
         * @see {@link https://docs.slack.dev/reference/methods/usergroups.create `usergroups.create` API reference}.
         */
        create: MethodWithRequiredArgument<UsergroupsCreateArguments, UsergroupsCreateResponse>;
        /**
         * @description Disable an existing User Group.
         * @see {@link https://docs.slack.dev/reference/methods/usergroups.disable `usergroups.disable` API reference}.
         */
        disable: MethodWithRequiredArgument<UsergroupsDisableArguments, UsergroupsDisableResponse>;
        /**
         * @description Enable an existing User Group.
         * @see {@link https://docs.slack.dev/reference/methods/usergroups.enable `usergroups.enable` API reference}.
         */
        enable: MethodWithRequiredArgument<UsergroupsEnableArguments, UsergroupsEnableResponse>;
        /**
         * @description List all User Groups for a team.
         * @see {@link https://docs.slack.dev/reference/methods/usergroups.list `usergroups.list` API reference}.
         */
        list: MethodWithOptionalArgument<UsergroupsListArguments, UsergroupsListResponse>;
        /**
         * @description Update an existing User Group.
         * @see {@link https://docs.slack.dev/reference/methods/usergroups.update `usergroups.update` API reference}.
         */
        update: MethodWithRequiredArgument<UsergroupsUpdateArguments, UsergroupsUpdateResponse>;
        users: {
            /**
             * @description List all users in a User Group.
             * @see {@link https://docs.slack.dev/reference/methods/usergroups.users.list `usergroups.users.list` API reference}.
             */
            list: MethodWithRequiredArgument<UsergroupsUsersListArguments, UsergroupsUsersListResponse>;
            /**
             * @description Update the list of users in a User Group.
             * @see {@link https://docs.slack.dev/reference/methods/usergroups.users.update `usergroups.users.update` API reference}.
             */
            update: MethodWithRequiredArgument<UsergroupsUsersUpdateArguments, UsergroupsUsersUpdateResponse>;
        };
    };
    readonly users: {
        /**
         * @description List conversations the calling user may access.
         * @see {@link https://docs.slack.dev/reference/methods/users.conversations `users.conversations` API reference}.
         */
        conversations: MethodWithRequiredArgument<UsersConversationsArguments, UsersConversationsResponse>;
        /**
         * @description Delete the user profile photo.
         * @see {@link https://docs.slack.dev/reference/methods/users.deletePhoto `users.deletePhoto` API reference}.
         */
        deletePhoto: MethodWithRequiredArgument<UsersDeletePhotoArguments, UsersDeletePhotoResponse>;
        discoverableContacts: {
            /**
             * @description Lookup an email address to see if someone is on Slack.
             * @see {@link https://docs.slack.dev/reference/methods/users.discoverableContacts.lookup `users.discoverableContacts.lookup` API reference}.
             */
            lookup: MethodWithRequiredArgument<UsersDiscoverableContactsLookupArguments, UsersDiscoverableContactsLookupResponse>;
        };
        /**
         * @description Gets user presence information.
         * @see {@link https://docs.slack.dev/reference/methods/users.getPresence `users.getPresence` API reference}.
         */
        getPresence: MethodWithRequiredArgument<UsersGetPresenceArguments, UsersGetPresenceResponse>;
        /**
         * @description Get a user's identity.
         * @see {@link https://docs.slack.dev/reference/methods/users.identity `users.identity` API reference}.
         */
        identity: MethodWithRequiredArgument<UsersIdentityArguments, UsersIdentityResponse>;
        /**
         * @description Gets information about a user.
         * @see {@link https://docs.slack.dev/reference/methods/users.info `users.info` API reference}.
         */
        info: MethodWithRequiredArgument<UsersInfoArguments, UsersInfoResponse>;
        /**
         * @description Lists all users in a Slack team.
         * @see {@link https://docs.slack.dev/reference/methods/users.list `users.list` API reference}.
         */
        list: MethodWithRequiredArgument<UsersListArguments, UsersListResponse>;
        /**
         * @description Find a user with an email address.
         * @see {@link https://docs.slack.dev/reference/methods/users.lookupByEmail `users.lookupByEmail` API reference}.
         */
        lookupByEmail: MethodWithRequiredArgument<UsersLookupByEmailArguments, UsersLookupByEmailResponse>;
        /**
         * @description Set the user profile photo.
         * @see {@link https://docs.slack.dev/reference/methods/users.setPhoto `users.setPhoto` API reference}.
         */
        setPhoto: MethodWithRequiredArgument<UsersSetPhotoArguments, UsersSetPhotoResponse>;
        /**
         * @description Manually sets user presence.
         * @see {@link https://docs.slack.dev/reference/methods/users.setPresence `users.setPresence` API reference}.
         */
        setPresence: MethodWithRequiredArgument<UsersSetPresenceArguments, UsersSetPresenceResponse>;
        profile: {
            /**
             * @description Retrieve a user's profile information, including their custom status.
             * @see {@link https://docs.slack.dev/reference/methods/users.profile.get `users.profile.get` API reference}.
             */
            get: MethodWithRequiredArgument<UsersProfileGetArguments, UsersProfileGetResponse>;
            /**
             * @description Set a user's profile information, including custom status.
             * @see {@link https://docs.slack.dev/reference/methods/users.profile.set `users.profile.set` API reference}.
             */
            set: MethodWithRequiredArgument<UsersProfileSetArguments, UsersProfileSetResponse>;
        };
    };
    readonly views: {
        /**
         * @description Open a view for a user.
         * @see {@link https://docs.slack.dev/reference/methods/views.open `views.open` API reference}.
         */
        open: MethodWithRequiredArgument<ViewsOpenArguments, ViewsOpenResponse>;
        /**
         * @description Publish a static view for a user.
         * @see {@link https://docs.slack.dev/reference/methods/views.publish `views.publish` API reference}.
         */
        publish: MethodWithRequiredArgument<ViewsPublishArguments, ViewsPublishResponse>;
        /**
         * @description Push a view onto the stack of a root view.
         * @see {@link https://docs.slack.dev/reference/methods/views.push `views.push` API reference}.
         */
        push: MethodWithRequiredArgument<ViewsPushArguments, ViewsPushResponse>;
        /**
         * @description Update an existing view.
         * @see {@link https://docs.slack.dev/reference/methods/views.update `views.update` API reference}.
         */
        update: MethodWithRequiredArgument<ViewsUpdateArguments, ViewsUpdateResponse>;
    };
    readonly stars: {
        /**
         * @description Save an item for later. Formerly known as adding a star.
         * @deprecated Stars can still be added but they can no longer be viewed or interacted with by end-users.
         * See {@link https://docs.slack.dev/changelog/2023-07-its-later-already-for-stars-and-reminders our post on stars and the Later list}.
         * @see {@link https://docs.slack.dev/reference/methods/stars.add `stars.add` API reference}.
         */
        add: MethodWithRequiredArgument<StarsAddRemoveArguments, StarsAddResponse>;
        /**
         * @description List a user's saved items, formerly known as stars.
         * @deprecated Stars can still be listed but they can no longer be viewed or interacted with by end-users.
         * See {@link https://docs.slack.dev/changelog/2023-07-its-later-already-for-stars-and-reminders our post on stars and the Later list}.
         * @see {@link https://docs.slack.dev/reference/methods/stars.list `stars.list` API reference}.
         */
        list: MethodWithRequiredArgument<StarsListArguments, StarsListResponse>;
        /**
         * @description Remove a saved item from a user's saved items, formerly known as stars.
         * @deprecated Stars can still be removed but they can no longer be viewed or interacted with by end-users.
         * See {@link https://docs.slack.dev/changelog/2023-07-its-later-already-for-stars-and-reminders our post on stars and the Later list}.
         * @see {@link https://docs.slack.dev/reference/methods/stars.remove `stars.remove` API reference}.
         */
        remove: MethodWithRequiredArgument<StarsAddRemoveArguments, StarsRemoveResponse>;
    };
    readonly workflows: {
        featured: {
            /**
             * @description Add featured workflows to a channel.
             * @see {@link https://docs.slack.dev/reference/methods/workflows.featured.add `workflows.featured.add` API reference}.
             */
            add: MethodWithRequiredArgument<WorkflowsFeaturedAddArguments, WebAPICallResult>;
            /**
             * @description List the featured workflows for specified channels.
             * @see {@link https://docs.slack.dev/reference/methods/workflows.featured.list `workflows.featured.list` API reference}.
             */
            list: MethodWithRequiredArgument<WorkflowsFeaturedListArguments, WorkflowsFeaturedListResponse>;
            /**
             * @description Remove featured workflows from a channel.
             * @see {@link https://docs.slack.dev/reference/methods/workflows.featured.remove `workflows.featured.remove` API reference}.
             */
            remove: MethodWithRequiredArgument<WorkflowsFeaturedRemoveArguments, WebAPICallResult>;
            /**
             * @description Set featured workflows for a channel.
             * @see {@link https://docs.slack.dev/reference/methods/workflows.featured.set `workflows.featured.set` API reference}.
             */
            set: MethodWithRequiredArgument<WorkflowsFeaturedSetArguments, WebAPICallResult>;
        };
        /**
         * @description Indicate that an app's step in a workflow completed execution.
         * @deprecated Steps from Apps is deprecated.
         * We're retiring all Slack app functionality around Steps from Apps in September 2024.
         * See {@link https://docs.slack.dev/changelog/2023-08-workflow-steps-from-apps-step-back our post on deprecating Steps from Apps}.
         * @see {@link https://docs.slack.dev/legacy/legacy-steps-from-apps/legacy-steps-from-apps-workflow_step-object `workflows.stepCompleted` API reference}.
         */
        stepCompleted: MethodWithRequiredArgument<WorkflowsStepCompletedArguments, WorkflowsStepCompletedResponse>;
        /**
         * @description Indicate that an app's step in a workflow failed to execute.
         * @deprecated Steps from Apps is deprecated.
         * We're retiring all Slack app functionality around Steps from Apps in September 2024.
         * See {@link https://docs.slack.dev/changelog/2023-08-workflow-steps-from-apps-step-back our post on deprecating Steps from Apps}.
         * @see {@link https://docs.slack.dev/legacy/legacy-steps-from-apps/legacy-steps-from-apps-workflow_step-object `workflows.stepFailed` API reference}.
         */
        stepFailed: MethodWithRequiredArgument<WorkflowsStepFailedArguments, WorkflowsStepFailedResponse>;
        /**
         * @description Update the configuration for a workflow step.
         * @deprecated Steps from Apps is deprecated.
         * We're retiring all Slack app functionality around Steps from Apps in September 2024.
         * See {@link https://docs.slack.dev/changelog/2023-08-workflow-steps-from-apps-step-back our post on deprecating Steps from Apps}.
         * @see {@link https://docs.slack.dev/legacy/legacy-steps-from-apps/legacy-steps-from-apps-workflow_step-object `workflows.updateStep` API reference}.
         */
        updateStep: MethodWithRequiredArgument<WorkflowsUpdateStepArguments, WorkflowsUpdateStepResponse>;
    };
}
export * from '@slack/types';
//# sourceMappingURL=methods.d.ts.map