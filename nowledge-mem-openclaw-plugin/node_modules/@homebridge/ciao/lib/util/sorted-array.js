"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortedInsert = sortedInsert;
/**
 * Insert into sorted array using binary search.
 *
 * @param array - An already sorted array.
 * @param element - The element to be inserted.
 * @param comparator - Comparator to determine the order for the elements.
 */
function sortedInsert(array, element, comparator) {
    let low = 0;
    let high = array.length - 1;
    let destination = -1; // if it doesn't change, we insert at position 0 (array is empty)
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const comparison = comparator(element, array[mid]);
        if (comparison === 0) {
            destination = mid + 1; // we currently don't care in which order items are sorted which have the same "order key"
            break;
        }
        if (comparison < 0) { // meaning element < array[mid]
            high = mid - 1;
        }
        else { // meaning element > array[mid]
            low = mid + 1;
        }
    }
    if (array.length === 0) {
        destination = 0;
    }
    else if (destination < 0) {
        if (comparator(element, array[low]) > 0) {
            destination = low + 1;
        }
        else {
            destination = low;
        }
    }
    // abuse splice method to insert at destination
    array.splice(destination, 0, element);
}
//# sourceMappingURL=sorted-array.js.map