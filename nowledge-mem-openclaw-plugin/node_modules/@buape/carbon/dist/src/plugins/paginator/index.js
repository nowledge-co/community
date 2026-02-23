import { Client } from "../../classes/Client.js";
import { GoToPageModal } from "./GoToPageModal.js";
import { Paginator } from "./Paginator.js";
Object.assign(Client.prototype, {
    Paginator,
    paginators: []
});
export { Paginator, GoToPageModal };
export * from "./GoToPageModal.js";
export * from "./Paginator.js";
//# sourceMappingURL=index.js.map