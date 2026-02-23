export type DataPart = {
    type: "status" | "name" | "nameComment" | "progressBar" | "percentage" | "transferred" | "speed" | "timeLeft" | "spacer" | "description";
    fullText: string;
    size: number;
    addEndPadding?: number;
    flex?: number;
    maxSize?: number;
    cropper?: (text: string, size: number) => string;
    formatter?(text: string, size: number): string;
};
export type DataLine = DataPart[];
export declare function renderDataLine(dataLine: DataLine, lineLength?: number): string;
export declare function renderDataPart(dataPart: DataPart): string;
export declare function resizeDataLine(dataLine: DataLine, lineLength: number): {
    type: "status" | "name" | "nameComment" | "progressBar" | "percentage" | "transferred" | "speed" | "timeLeft" | "spacer" | "description";
    fullText: string;
    size: number;
    addEndPadding?: number;
    flex?: number;
    maxSize?: number;
    cropper?: (text: string, size: number) => string;
    formatter?(text: string, size: number): string;
}[];
