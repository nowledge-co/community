export declare const enum ProjectTemplateParameter {
    ProjectName = "projectName",
    CurrentModuleVersion = "currentNodeLlamaCppModuleVersion",
    ModelUriOrUrl = "modelUriOrUrl",
    ModelUriOrFilename = "modelUriOrFilename"
}
export type PackagedFileEntry = {
    path: string[];
    content: string;
};
export type ProjectTemplate = {
    files: PackagedFileEntry[];
};
export declare function getProjectTemplateParameterText(parameter: ProjectTemplateParameter, escapeText?: boolean | 0 | 1 | 2): string;
export declare function scaffoldProjectTemplate({ template, parameters, directoryPath }: {
    template: ProjectTemplate;
    parameters: Record<ProjectTemplateParameter, string>;
    directoryPath: string;
}): Promise<void>;
