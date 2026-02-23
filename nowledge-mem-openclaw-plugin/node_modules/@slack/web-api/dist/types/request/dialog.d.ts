import type { Dialog } from '@slack/types';
import type { TokenOverridable } from './common';
export interface DialogOpenArguments extends TokenOverridable {
    /** @description Exchange a trigger to post to the user. */
    trigger_id: string;
    /** @description The dialog definition. */
    dialog: Dialog;
}
//# sourceMappingURL=dialog.d.ts.map