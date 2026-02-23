export type ProjectTemplateOption = {
    title: string;
    name: string;
    titleFormat?(title: string): string;
    description?: string;
};
export declare const projectTemplates: ProjectTemplateOption[];
