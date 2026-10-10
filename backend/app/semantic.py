from __future__ import annotations

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import get_gemini_client


class RatedSkill(BaseModel):
    # Field order matters: Gemini writes evidence before committing to a rating.
    evidence: str = Field(description="Quote or cite the specific words/moments that justify the rating")
    rating: int = Field(ge=1, le=5)
    suggestion: str = Field(description="One actionable sentence that fixes the main issue in the evidence")


class ContextualFiller(BaseModel):
    word: str = Field(description='The filler exactly as spoken, e.g. "like" or "you know"')
    context: str = Field(description="The 3–6 surrounding words, quoted from the transcript")


class SemanticEvaluation(BaseModel):
    vocabulary: RatedSkill
    sentence_structure: RatedSkill
    contextual_fillers: list[ContextualFiller]
    filler_suggestion: str
    strengths: list[str] = Field(min_length=1)
    weaknesses: list[str] = Field(min_length=1)


def evaluate_speech(transcript: str, daily_prompt: str) -> SemanticEvaluation:
    prompt = f"""You are a strict, evidence-based public-speaking coach. Evaluate the words only, never identity, accent, or personality. Do not invent details.
Prompt the speaker answered: {daily_prompt}
Verbatim transcript (30-second take): {transcript}

For each skill, first write the evidence (quote the transcript), then rate 1–5 against these anchors, then give one actionable sentence.
vocabulary: 1 vague or repeated basic words throughout ("good", "very", "stuff"); 2 mostly basic with heavy repetition; 3 adequate everyday words, some repetition; 4 mostly precise and varied; 5 precise, vivid, varied word choice suited to the topic.
sentence_structure: 1 mostly run-ons, fragments, or abandoned sentences; 2 frequent breakdowns; 3 mostly complete but simple and same-shaped sentences; 4 complete, varied sentences with transitions; 5 varied sentences forming a clear opening, point, and conclusion.
Rate what is there, not what was intended. Most casual takes are a 2 or 3; reserve 5 for polished speech.

contextual_fillers: list every filler use of "like", "you know", "I mean", "basically", "actually", "literally", "kind of", "sort of", "so" (as a sentence opener with no meaning), and tag questions like "right?". Quote each one with context. Only include filler uses; "I like pizza" is not a filler.
Do NOT list um/uh/er/ah/hmm or immediately repeated words and restarted phrases; those are counted separately by software.
filler_suggestion: one actionable sentence on reducing fillers and extra words.
Write evidence and suggestions addressed to the speaker as "you"; never use he, she, his, or her."""
    response = get_gemini_client().models.generate_content(
        model=settings.semantic_model, contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=SemanticEvaluation),
    )
    return SemanticEvaluation.model_validate_json(response.text)
