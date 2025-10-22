# Changelog

All notable changes to the Nowledge Mem Claude Code plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-10-22

### Added

- **Agent Skills**: Three autonomous skills for memory and thread management
  - `search-memory`: Autonomously search personal memories when context is needed
  - `distill-memory`: Recognize and capture valuable insights from conversations
  - `save-thread`: Save complete conversation threads on user request
- **MCP Server Integration**: Automatic configuration of Nowledge Mem MCP server
  - `memory_search`: Semantic + BM25 hybrid search with confidence scoring
  - `memory_add`: Create memories with labels and importance
  - `memory_update`: Update existing memories by ID
  - `list_memory_labels`: Browse available labels
  - `thread_persist`: Save Claude Code sessions (current or all)
- **Optimized Descriptions**: Reduced MCP overhead by ~40% while maintaining clarity
- **Comprehensive Documentation**: Installation, usage, troubleshooting, and best practices

### Changed

- MCP tool descriptions optimized for token efficiency
- Skills compressed to minimal token cost while preserving guidance quality

### Fixed

- N/A (initial release)

## [Unreleased]

### Planned

- Support for additional Claude Code clients beyond Claude Code
- Enhanced memory graph exploration capabilities
- Community detection and clustering features
- Export/import functionality for memory backups
- Advanced filtering and search operators

---

## Version History

- **0.4.0** (2025-01-22): Initial release with Agent Skills and MCP integration
