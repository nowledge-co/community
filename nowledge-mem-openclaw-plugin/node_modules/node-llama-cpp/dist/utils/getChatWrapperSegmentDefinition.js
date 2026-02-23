export function getChatWrapperSegmentDefinition(chatWrapperSetting, segmentType) {
    if (segmentType === "thought")
        return chatWrapperSetting.segments?.thought;
    else if (segmentType === "comment")
        return chatWrapperSetting.segments?.comment;
    void segmentType;
    return undefined;
}
//# sourceMappingURL=getChatWrapperSegmentDefinition.js.map