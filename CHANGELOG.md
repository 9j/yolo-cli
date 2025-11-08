# Changelog

All notable changes to YOLO CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Slash Commands System**: New command-line interface for session management
  - `/clear` (alias: `/reset`) - Clear conversation history with confirmation prompt
  - `/version` - Display YOLO CLI version information
  - `/new` - Start a new session in the current directory
  - `/compact` - Reduce conversation context size using AI summarization
  - `/help` (aliases: `/h`, `/?`) - Show available commands
  - `/exit` (alias: `/quit`) - Exit YOLO CLI

- **Multi-Session Support**:
  - UUID-based session file naming (`.yolo/history-{uuid}.jsonl`)
  - Session metadata tracking in `.yolo/session-metadata.json`
  - Support for multiple independent conversations in the same directory
  - Automatic migration from legacy single-file format

- **Conversation Compaction**:
  - AI-powered summarization of older messages (20+ message threshold)
  - Preserves recent 12 messages for context continuity
  - Reduces token usage while maintaining conversation quality
  - OpenRouter API integration for summary generation
  - Displays before/after metrics (message count, token estimates, reduction percentage)

- **Confirmation Prompts**:
  - Interactive confirmation for destructive operations (`/clear`, `/compact`)
  - Visual feedback with colored borders and keyboard shortcuts
  - Clear metric displays for informed decision-making

### Changed

- Storage system now supports session-specific history files
- Session management enhanced with metadata tracking
- History loading/saving functions accept optional `sessionId` parameter

### Technical

- New type definitions: `SlashCommand`, `CommandContext`, `SessionMetadataFile`, `SessionInfo`, `CompactionResult`, `CompactionConfig`
- Session constants: `SESSION_METADATA_VERSION`, `COMPACTION_CONFIG`
- New components: `ConfirmClearPrompt`, `ConfirmCompactPrompt`
- Enhanced session service with `createNewSession()`, `loadCurrentSession()`, `registerSession()`, `clearConversationHistory()`, `compactConversation()`
- Storage utilities: `getHistoryPath()`, `loadSessionMetadata()`, `saveSessionMetadata()`
