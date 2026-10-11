from __future__ import annotations

from typing import Literal

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import generate

VocabularyLevel = Literal["basic", "everyday", "varied", "precise"]


class SemanticEvaluation(BaseModel):
    vocabulary: float = Field(ge=1, le=5)
    sentence_structure: float = Field(ge=1, le=5)
    contextual_fillers: int = Field(ge=0)
    strengths: list[str] = Field(min_length=1)
    weaknesses: list[str] = Field(min_length=1)
    # Detailed breakdown (v2.1). Defaults keep older stored results loadable.
    vocabulary_level: VocabularyLevel = "everyday"
    strong_words: list[str] = Field(default_factory=list, max_length=5)
    weak_words: list[str] = Field(default_factory=list, max_length=5)
    filler_examples: list[str] = Field(default_factory=list, max_length=8)
    opening: int = Field(default=3, ge=1, le=5)
    support: int = Field(default=3, ge=1, le=5)
    closing: int = Field(default=3, ge=1, le=5)
    suggestions: list[str] = Field(default_factory=list, max_length=4)


def evaluate_speech(transcript: str, daily_prompt: str) -> SemanticEvaluation:
    prompt = f"""You are an evidence-based public-speaking evaluator. Evaluate content only, never identity, accent, or personality. Do not invent details; quote the transcript when you refer to it.
Prompt: {daily_prompt}\nTranscript: {transcript}\n
Ratings are decimals from 1.0 to 5.0 with one decimal place (e.g. 2.3, 3.7, 4.1), not whole numbers. The anchors below describe 1, 3 and 5; place the take precisely between them based on the evidence. Two takes should rarely get the same rating, so avoid defaulting to .0 or .5. Return concise lists alongside the ratings. strengths and weaknesses: one or two items each, one short sentence of at most 12 words, no preamble.
vocabulary: 1 vague, repetitive words, 3 adequate everyday words, 5 precise, varied word choice suited to the topic.
vocabulary_level: "basic" (simple, repeated, filler-heavy words), "everyday" (plain conversational words), "varied" (some specific, well-chosen words), "precise" (consistently specific, topic-appropriate vocabulary).
strong_words: up to 5 words or short phrases from the transcript that were specific, vivid, or well chosen. Empty if none.
weak_words: up to 5 vague, overused, or hedging words or phrases from the transcript (e.g. "stuff", "things", "very good", "kind of"). Empty if none.
sentence_structure: 1 run-ons, fragments, or abandoned sentences, 3 mostly complete sentences with little variety, 5 complete, varied sentences linked by clear transitions into an opening, point, and conclusion.
opening: 1 no clear start or a filler-heavy wind-up, 3 states the topic, 5 a direct first sentence that answers the prompt or hooks the listener.
support: 1 no reason or example for the main point, 3 one general reason, 5 a specific reason or example that makes the point convincing.
closing: 1 trails off, abandoned sentence, or "yeah so that's it", 3 restates the point, 5 a deliberate final sentence that lands the point.
contextual_fillers: count only filler uses of "like", "you know", "I mean", "basically", "actually", "literally", "kind of", "sort of", and "right?" plus immediately repeated words or restarted phrases (e.g. "because because"). Do not count um, uh, er, ah, or hmm; those are counted separately.
filler_examples: the contextual filler phrases you counted, verbatim and short (e.g. "like", "you know", "because because"). Empty if none.
suggestions: 2 or 3 concrete rewrites the speaker can apply next time, at most 18 words each. Each one quotes the exact phrase from the transcript and gives the better version, e.g. 'Replace "stuff like that" with "protected bike lanes and lower speed limits".' Prioritize the changes that would raise the ratings above the most. No generic advice."""
    response = generate(
        settings.semantic_model, prompt,
        types.GenerateContentConfig(response_mime_type="application/json", response_schema=SemanticEvaluation),
        what="content evaluation",
    )
    return SemanticEvaluation.model_validate_json(response.text)
