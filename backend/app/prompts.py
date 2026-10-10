"""Daily prompts: everyone gets the same one each (UTC) day, so daily ranks compare like with like."""
from __future__ import annotations

import random
from datetime import UTC, date, datetime

# (prompt, tip) pairs sized for a 30-second answer.
PROMPTS: list[tuple[str, str]] = [
    ("Convince a stranger to try your favorite food.", "Open with the taste, not the name."),
    ("Explain one change that would improve your community and why.", "Name the change in your first sentence."),
    ("Describe the best advice you've ever received.", "Say who gave it before what it was."),
    ("Pitch your hometown as a vacation spot.", "Lead with one thing visitors can't get anywhere else."),
    ("Argue for or against homework.", "Pick a side in the first five seconds."),
    ("Teach us something you know a lot about.", "One idea, one example, done."),
    ("Describe a moment you were proud of yourself.", "Set the scene in one sentence, then get to the moment."),
    ("Convince us to read your favorite book.", "Sell the feeling, not the plot."),
    ("Explain why sleep matters to someone who stays up late.", "Talk to them, not about them."),
    ("What's a skill everyone should learn, and why?", "Give one concrete situation where it helps."),
    ("Pitch a new holiday and how we'd celebrate it.", "Name it first, then make us want it."),
    ("Describe your perfect weekend.", "Paint it hour by hour, briefly."),
    ("Argue that your favorite season is the best one.", "Use senses: what does it smell and sound like?"),
    ("Explain a hobby to someone who's never tried it.", "Start with why it's fun, not how it works."),
    ("Tell us about a time you changed your mind.", "Before, the trigger, after. Three beats."),
    ("Convince us to put down our phones for a day.", "Promise one specific payoff."),
    ("What would you do with an extra hour every day?", "Be specific: say what, where, and with whom."),
    ("Describe a person who inspires you.", "Show one thing they did, not a list of traits."),
    ("Pitch an app that would make your life easier.", "Start with the annoying problem it solves."),
    ("Argue for a four-day school or work week.", "Lead with your strongest reason, not all of them."),
    ("Explain how to make your favorite meal.", "Three steps max; make it sound delicious."),
    ("What's an underrated movie everyone should watch?", "Hook us with one scene."),
    ("Convince someone to start exercising.", "Make the first step sound tiny."),
    ("Describe a place that feels like home.", "One detail beats ten adjectives."),
    ("If you could master any instrument, which and why?", "Answer in your first sentence."),
    ("Explain why failure can be a good thing.", "Use one real example, ideally yours."),
    ("Pitch your dream job to a hiring manager.", "Say what you'd do on day one."),
    ("Argue that cats or dogs make better pets.", "Commit. No 'both are great'."),
    ("Describe the best meal you've ever had.", "Where you were matters as much as what you ate."),
    ("What's one thing you'd change about school?", "Problem, fix, result."),
    ("Convince us to visit a museum.", "Pick one exhibit and sell it."),
    ("Tell us about a small act of kindness you remember.", "Keep it small and specific."),
    ("Explain a current trend to your grandparents.", "Compare it to something they already know."),
    ("Pitch a superhero with a useless power.", "Make the power vivid, then make it funny."),
    ("Argue for or against school uniforms.", "State your side, then give your best reason."),
    ("What would you tell your younger self?", "Speak to them directly: 'You…'"),
    ("Describe your morning routine and one way to improve it.", "Spend most of your time on the improvement."),
    ("Convince someone to learn a second language.", "Give one moment where it'd change their day."),
    ("Explain why your favorite song is great.", "Point to one moment in the song."),
    ("Pitch a road trip to your friends.", "Destination, one stop, one reason to go now."),
    ("Describe a challenge you overcame.", "Spend more time on how than on what."),
    ("Argue that breakfast is or isn't the most important meal.", "Pick a side and own it."),
    ("What's a tradition in your family you love?", "Walk us through it like we're there."),
    ("Convince us to volunteer for one afternoon.", "Make the ask specific and easy."),
    ("Explain how you'd spend a million dollars responsibly.", "Give three buckets, one line each."),
    ("Describe the view from your favorite spot.", "Near, middle, far: build the picture."),
    ("Pitch a new flavor of ice cream.", "Name it and make us taste it."),
    ("Argue that video games can be good for you.", "Lead with your most surprising point."),
    ("Tell us about the best gift you've given someone.", "Their reaction is the ending."),
    ("Explain what makes a good friend.", "One quality, one example."),
    ("Convince us that mornings are better than nights, or the reverse.", "Commit to one side in your opening line."),
    ("Describe a goal you're working toward right now.", "Say where you are and what's next."),
    ("What invention would you un-invent, and why?", "Name it fast, then justify it."),
    ("Pitch your favorite local restaurant.", "Order for us: what should we get?"),
    ("Argue for more green space in cities.", "Paint the before and after."),
    ("Explain why you love a sport or game.", "Describe the best moment of playing it."),
    ("Describe a time you laughed so hard you cried.", "Set it up quickly, then deliver the moment."),
    ("Convince us to try something new this week.", "Suggest one thing and when to do it."),
    ("What's the most useful thing you learned this year?", "Show us where you used it."),
    ("Pitch a class that every school should offer.", "Name it, then describe one lesson."),
]
EPOCH = date(2026, 1, 1)
_ORDER = list(range(len(PROMPTS)))
random.Random("onetake-prompts-v1").shuffle(_ORDER)  # fixed seed: a stable "random" order with no repeats per cycle


def prompt_for(day: date | None = None) -> dict[str, str]:
    day = day or datetime.now(UTC).date()
    text, tip = PROMPTS[_ORDER[(day - EPOCH).days % len(PROMPTS)]]
    return {"date": day.isoformat(), "prompt": text, "tip": tip}
