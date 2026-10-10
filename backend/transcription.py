"""Compatibility entrypoint for Gemini verbatim transcription."""

from app.transcription import Transcript, WordTimestamp, transcribe

__all__ = ["Transcript", "WordTimestamp", "transcribe"]
