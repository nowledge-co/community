export function pushComment(newComment, comment = "") {
    if (comment.length) {
        return `${newComment}, ${comment}`;
    }
    return newComment;
}
//# sourceMappingURL=push-comment.js.map