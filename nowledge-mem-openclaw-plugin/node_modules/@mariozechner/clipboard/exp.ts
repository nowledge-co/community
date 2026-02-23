import Clipboard from "./index.js";

console.log(await Clipboard.getText());

console.log(await Clipboard.getHtml());


if (await Clipboard.hasImage()) {
  console.log(await Clipboard.getImageBase64());
} else {
  console.log("No Image");
}
