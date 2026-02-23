#![deny(clippy::all)]
use base64::{engine::general_purpose, Engine as _};
use clipboard_rs::{
  common::RustImage, Clipboard, ClipboardContext, ClipboardHandler, ClipboardWatcher,
  ClipboardWatcherContext, ContentFormat, RustImageData,
};
use napi::{
  bindgen_prelude::*,
  threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode},
  JsFunction,
};
use std::{thread, time::Duration};

#[macro_use]
extern crate napi_derive;

#[napi]
pub fn available_formats() -> Vec<String> {
  let ctx = ClipboardContext::new().unwrap();
  let types = ctx.available_formats().unwrap();
  types
}

#[napi]
pub async fn get_text() -> String {
  let ctx = ClipboardContext::new().unwrap();
  ctx.get_text().unwrap()
}

#[napi]
pub async fn set_text(text: String) {
  let ctx = ClipboardContext::new().unwrap();
  ctx.set_text(text).unwrap()
}

#[napi]
pub fn has_text() -> bool {
  let ctx = ClipboardContext::new().unwrap();
  ctx.has(ContentFormat::Text)
}

#[napi]
pub async fn get_image_binary() -> Vec<u8> {
  let ctx = ClipboardContext::new().unwrap();
  let image = ctx.get_image().unwrap();
  let image_bytes = image.to_png().unwrap().get_bytes().to_vec();
  image_bytes
}

#[napi]
pub async fn get_image_base64() -> String {
  let image_bytes = get_image_binary().await;
  let base64_str = general_purpose::STANDARD_NO_PAD.encode(&image_bytes);
  base64_str
}

#[napi]
pub async fn set_image_binary(image_bytes: Vec<u8>) {
  let ctx = ClipboardContext::new().unwrap();
  let img = RustImageData::from_bytes(&image_bytes).unwrap();
  ctx.set_image(img).unwrap()
}

#[napi]
pub async fn set_image_base64(base64_str: String) {
  let decoded: Vec<u8> = general_purpose::STANDARD_NO_PAD.decode(base64_str).unwrap();
  set_image_binary(decoded).await;
}

#[napi]
pub fn has_image() -> bool {
  let ctx = ClipboardContext::new().unwrap();
  ctx.has(ContentFormat::Image)
}

#[napi]
pub async fn get_html() -> String {
  let ctx = ClipboardContext::new().unwrap();
  ctx.get_html().unwrap()
}

#[napi]
pub async fn set_html(html: String) {
  let ctx = ClipboardContext::new().unwrap();
  ctx.set_html(html).unwrap()
}

#[napi]
fn has_html() -> bool {
  let ctx = ClipboardContext::new().unwrap();
  ctx.has(ContentFormat::Html)
}

#[napi]
pub async fn get_rtf() -> String {
  let ctx = ClipboardContext::new().unwrap();
  ctx.get_rich_text().unwrap()
}

#[napi]
pub async fn set_rtf(rtf: String) {
  let ctx = ClipboardContext::new().unwrap();
  ctx.set_rich_text(rtf).unwrap()
}

#[napi]
pub fn has_rtf() -> bool {
  let ctx = ClipboardContext::new().unwrap();
  ctx.has(ContentFormat::Rtf)
}

#[napi]
pub async fn clear() {
  let ctx = ClipboardContext::new().unwrap();
  ctx.clear().unwrap()
}

struct Manager {
  ctx: ClipboardContext,
}

impl Manager {
  pub fn new() -> Self {
    let ctx = ClipboardContext::new().unwrap();
    Manager { ctx }
  }
}

impl ClipboardHandler for Manager {
  fn on_clipboard_change(&mut self) {
    println!(
      "on_clipboard_change, txt = {}",
      self.ctx.get_text().unwrap()
    );
  }
}

#[napi]
pub fn watch() {
  let manager = Manager::new();

  let mut watcher = ClipboardWatcherContext::new().unwrap();

  let watcher_shutdown = watcher.add_handler(manager).get_shutdown_channel();

  thread::spawn(move || {
    thread::sleep(Duration::from_secs(5));
    println!("stop watch!");
    watcher_shutdown.stop();
  });

  println!("start watch!");
  watcher.start_watch();
}

#[napi]
pub fn call_threadsafe_function(callback: JsFunction) -> Result<()> {
  let tsfn: ThreadsafeFunction<u32, ErrorStrategy::CalleeHandled> = callback
    .create_threadsafe_function(0, |ctx| {
      ctx.env.create_uint32(ctx.value + 1).map(|v| vec![v])
    })?;
  for n in 0..10 {
    let tsfn = tsfn.clone();
    thread::spawn(move || {
      tsfn.call(Ok(n), ThreadsafeFunctionCallMode::Blocking);
    });
  }
  Ok(())
}

// #[js_function(1)]
// fn hello(ctx: CallContext) -> Result<JsString, String> {
//   let argument_one = ctx
//     .get::<JsString>(0)
//     .map_err(|err| err.to_string())?
//     .into_utf8()
//     .map_err(|err| err.to_string())?;
//   ctx
//     .env
//     .create_string_from_std(format!("{} world!", argument_one.as_str()?))
// }

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn it_works() {
    watch();
  }
}
