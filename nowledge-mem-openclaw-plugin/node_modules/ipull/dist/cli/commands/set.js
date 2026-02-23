import { Command } from "commander";
import { AppDB } from "../../settings/settings.js";
const HELP_TEXT = `
You can set that file extensions will be download to specific path.
For example all zip files will be download to ~/Downloads/zip/:
pull set .zip ~/Downloads/zip/

You can set default download path:
pull set default ~/Downloads/
 `;
export const setCommand = new Command("set");
setCommand.description("Set download locations")
    .argument("[path]", "Path to the settings")
    .argument("<value>", "Value to set")
    .option("-d delete", "Delete the setting")
    .addHelpText("afterAll", HELP_TEXT)
    .action(async (path, value, { delete: deleteSetting }) => {
    if (deleteSetting) {
        await AppDB.update(data => {
            delete data[path];
        });
        console.log(`Deleted ${path}`);
        return;
    }
    await AppDB.update(data => {
        data[path] = value;
    });
    console.log(`${value} set to ${path}`);
});
//# sourceMappingURL=set.js.map