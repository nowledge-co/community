import type { Chat, User } from "./manage.js";
import type { Message, MessageEntity, ParseMode } from "./message.js";
/** Describes a task in a checklist. */
export interface ChecklistTask {
    /** Unique identifier of the task */
    id: number;
    /** Text of the task */
    text: string;
    /** Special entities that appear in the task text */
    text_entities?: MessageEntity[];
    /** User that completed the task; omitted if the task wasn't completed by a user */
    completed_by_user?: User;
    /** Chat that completed the task; omitted if the task wasn't completed by a chat */
    completed_by_chat?: Chat;
    /** Point in time (Unix timestamp) when the task was completed; 0 if the task wasn't completed */
    completion_date?: number;
}
/** Describes a checklist. */
export interface Checklist {
    /** Title of the checklist */
    title: string;
    /** Special entities that appear in the checklist title */
    title_entities?: MessageEntity[];
    /** List of tasks in the checklist */
    tasks: ChecklistTask[];
    /** True, if users other than the creator of the list can add tasks to the list */
    others_can_add_tasks?: true;
    /** True, if users other than the creator of the list can mark tasks as done or not done */
    others_can_mark_tasks_as_done?: true;
}
/** Describes a task to add to a checklist. */
export interface InputChecklistTask {
    /** Unique identifier of the task; must be positive and unique among all task identifiers currently present in the checklist */
    id: number;
    /** Text of the task; 1-100 characters after entities parsing */
    text: string;
    /** Mode for parsing entities in the text. See formatting options for more details. */
    parse_mode?: ParseMode;
    /** List of special entities that appear in the text, which can be specified instead of parse_mode. Currently, only bold, italic, underline, strikethrough, spoiler, and custom_emoji entities are allowed. */
    text_entities?: MessageEntity[];
}
/** Describes a checklist to create. */
export interface InputChecklist {
    /** Title of the checklist; 1-255 characters after entities parsing */
    title: string;
    /** Mode for parsing entities in the title. See formatting options for more details. */
    parse_mode?: ParseMode;
    /** List of special entities that appear in the title, which can be specified instead of parse_mode. Currently, only bold, italic, underline, strikethrough, spoiler, and custom_emoji entities are allowed. */
    title_entities?: MessageEntity[];
    /** List of 1-30 tasks in the checklist */
    tasks: InputChecklistTask[];
    /** Pass True if other users can add tasks to the checklist */
    others_can_add_tasks?: boolean;
    /** Pass True if other users can mark tasks as done or not done in the checklist */
    others_can_mark_tasks_as_done?: true;
}
/** Describes a service message about checklist tasks marked as done or not done. */
export interface ChecklistTasksDone {
    /** Message containing the checklist whose tasks were marked as done or not done. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    checklist_message?: Message;
    /** Identifiers of the tasks that were marked as done */
    marked_as_done_task_ids?: number[];
    /** Identifiers of the tasks that were marked as not done */
    marked_as_not_done_task_ids?: number[];
}
/** Describes a service message about tasks added to a checklist. */
export interface ChecklistTasksAdded {
    /** Message containing the checklist to which the tasks were added. Note that the Message object in this field will not contain the reply_to_message field even if it itself is a reply. */
    checklist_message?: Message;
    /** List of tasks added to the checklist */
    tasks: ChecklistTask[];
}
