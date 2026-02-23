import { JSONFilePreset } from "lowdb/node";
import { DB_PATH } from "../const.js";
import { Low } from "lowdb";
const AppDB = await JSONFilePreset(DB_PATH, {});
export { AppDB, Low };
//# sourceMappingURL=settings.js.map