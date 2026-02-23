import path from "path";
import fs from "fs-extra";
export var ProjectTemplateParameter;
(function (ProjectTemplateParameter) {
    ProjectTemplateParameter["ProjectName"] = "projectName";
    ProjectTemplateParameter["CurrentModuleVersion"] = "currentNodeLlamaCppModuleVersion";
    ProjectTemplateParameter["ModelUriOrUrl"] = "modelUriOrUrl";
    ProjectTemplateParameter["ModelUriOrFilename"] = "modelUriOrFilename";
})(ProjectTemplateParameter || (ProjectTemplateParameter = {}));
export function getProjectTemplateParameterText(parameter, escapeText = true) {
    let escapes = "";
    if (escapeText === true || escapeText === 1)
        escapes = "|escape";
    else if (escapeText === 2)
        escapes = "|escape|escape";
    return "{{" + parameter + escapes + "}}";
}
function applyProjectTemplateParameters(template, parameters) {
    for (const [parameter, value] of Object.entries(parameters)) {
        template = template.split(getProjectTemplateParameterText(parameter, 0)).join(String(value));
        template = template.split(getProjectTemplateParameterText(parameter, 1)).join(JSON.stringify(String(value)).slice(1, -1));
        template = template.split(getProjectTemplateParameterText(parameter, 2)).join(JSON.stringify(JSON.stringify(String(value)).slice(1, -1)).slice(1, -1));
    }
    return template;
}
export async function scaffoldProjectTemplate({ template, parameters, directoryPath }) {
    for (const file of template.files) {
        const filePath = path.join(directoryPath, ...file.path);
        const fileContent = transformFileContent({
            content: applyProjectTemplateParameters(file.content, parameters),
            originalPath: file.path,
            parameters
        });
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, fileContent, "utf8");
    }
}
function transformFileContent({ content, originalPath, parameters }) {
    if (originalPath.length === 1 && originalPath[0] === "package.json") {
        const packageJson = JSON.parse(content);
        if (parameters[ProjectTemplateParameter.ProjectName] != null)
            packageJson.name = parameters[ProjectTemplateParameter.ProjectName];
        return JSON.stringify(packageJson, null, 2);
    }
    return content;
}
//# sourceMappingURL=projectTemplates.js.map