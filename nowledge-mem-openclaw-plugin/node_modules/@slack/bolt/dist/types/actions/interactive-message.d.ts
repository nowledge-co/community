/**
 * All actions which Slack delivers from legacy interactive messages. The full body of these actions are represented
 * as [[InteractiveMessage]].
 */
export type InteractiveAction = ButtonClick | MenuSelect;
/**
 * A button click action from a legacy interactive message.
 */
export interface ButtonClick {
    type: 'button';
    name: string;
    value: string;
}
/**
 * A menu selection action from a legacy interactive message.
 */
export interface MenuSelect {
    type: 'select';
    name: string;
    selected_options: {
        value: string;
    }[];
}
/**
 * A Slack legacy interactive message action wrapped in the standard metadata.
 *
 * This describes the entire JSON-encoded body of a request from Slack's legacy interactive messages.
 */
export interface InteractiveMessage<Action extends InteractiveAction = InteractiveAction> {
    type: 'interactive_message';
    callback_id: string;
    actions: Action[];
    team: {
        id: string;
        domain: string;
        enterprise_id?: string;
        enterprise_name?: string;
    } | null;
    user: {
        id: string;
        name: string;
        team_id?: string;
    };
    channel: {
        id: string;
        name: string;
    };
    action_ts: string;
    attachment_id?: string;
    token: string;
    response_url: string;
    trigger_id: string;
    is_app_unfurl?: boolean;
    message_ts?: string;
    original_message?: {
        [key: string]: string;
    };
    is_enterprise_install?: boolean;
    enterprise?: {
        id: string;
        name: string;
    };
}
export type InteractiveButtonClick = InteractiveMessage<ButtonClick>;
export type InteractiveMenuSelect = InteractiveMessage<MenuSelect>;
//# sourceMappingURL=interactive-message.d.ts.map