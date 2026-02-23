import { InteractionCreateListener } from "../../classes/Listener.js";
import { ListenerEvent } from "../../types/listeners.js";
export class InteractionEventListener extends InteractionCreateListener {
    type = ListenerEvent.InteractionCreate;
    async handle(data, client) {
        await client.handleInteraction(data, {});
    }
}
//# sourceMappingURL=InteractionEventListener.js.map