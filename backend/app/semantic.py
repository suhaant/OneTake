from __future__ import annotations

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import get_gemini_client


class SemanticEvaluation(BaseModel):
    vocabulary: int = Field(ge=1, le=5)
    sentence_structure: int = Field(ge=1, le=5)
    contextual_fillers: int = Field(ge=0)
    strengths: list[str] = Field(min_length=1)
    weaknesses: list[str] = Field(min_length=1)


def evaluate_speech(transcript: str, daily_prompt: str) -> SemanticEvaluation:
    prompt = f"""You are an evidence-based public-speaking evaluator. Evaluate content only, never identity, accent, or personality. Do not invent details.
Prompt: {daily_prompt}\nTranscript: {transcript}\n
Return 1–5 integer ratings and concise lists.
Vocabulary: 1 vague, repetitive words, 3 adequate everyday words, 5 precise, varied word choice suited to the topic.
Sentence structure: 1 run-ons, fragments, or abandoned sentences, 3 mostly complete sentences with little variety, 5 complete, varied sentences linked by clear transitions into an opening, point, and conclusion.
contextual_fillers: count only filler uses of "like", "you know", "I mean", "basically", "actually", "literally", "kind of", "sort of", and "right?" plus immediately repeated words or restarted phrases (e.g. "because because"). Do not count um, uh, er, ah, or hmm; those are counted separately."""
    response = get_gemini_client().models.generate_content(
        model=settings.semantic_model, contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=SemanticEvaluation),
    )
    return SemanticEvaluation.model_validate_json(response.text)
