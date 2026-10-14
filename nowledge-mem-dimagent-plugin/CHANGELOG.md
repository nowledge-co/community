# Changelog

## [0.1.1] - 2026-10-11

### Fixed

- Search first, inspect at most one small targeted thread range per question, and report evidence gaps rather than walking offsets.
- Preserve explicit target ranges, progressive graph exploration and existing session capture.

## 0.1.0

- Add the initial DimAgent durable-capture plugin.
- Resolve the hook runtime from the installed plugin directory under runpy.
- Exercise registered launchers and capture failures in three-platform CI.
- Isolate hook imports and automatic CLI lookup from the project directory.
