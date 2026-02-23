export function enforceChoicesLimit(options) {
    if (!options)
        return options;
    return options.map((option) => {
        const newOption = { ...option };
        if (Array.isArray(newOption.choices) && newOption.choices.length > 25) {
            console.warn(`[Carbon] Command option '${newOption.name}' has ${newOption.choices.length} choices. Only the first 25 will be sent.`);
            newOption.choices = newOption.choices.slice(0, 25);
        }
        // Recursively handle sub-options for subcommands/groups
        if (Array.isArray(newOption.options)) {
            newOption.options = enforceChoicesLimit(newOption.options);
        }
        return newOption;
    });
}
//# sourceMappingURL=enforceChoicesLimit.js.map