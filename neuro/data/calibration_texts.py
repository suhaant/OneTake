"""100 calibration texts: 25 speaking prompts x 4 versions.

  engaging  - hook, concrete story, stakes, vivid detail (hand-written)
  flat      - same topic and length, generic and abstract (hand-written)
  filler    - the flat version with filler words inserted
  scrambled - the engaging version with word order shuffled (same words, no meaning)

Labels are the author's judgement, not audience data: treat results as a first pass.
"""

import random
import re

PAIRS = [  # (topic, engaging, flat)
    ("morning routine",
     "My alarm went off at five this morning and I threw my phone across the room. It hit the wall, cracked, and kept ringing. That is when I knew something had to change. So I tried one small thing. I put the phone in the kitchen. Now I have to walk to silence it, and by then I am awake.",
     "My morning routine is fairly standard. I usually wake up at a normal time and then I do a number of things to get ready for the day. These include some typical activities that most people do. Overall I think having a routine is generally a good thing and it can be helpful in various ways for many people."),
    ("pineapple on pizza",
     "Pineapple on pizza saved my first date. She ordered it, I laughed, and she said try one bite before you judge me. Sweet, salty, hot cheese, cold fruit. I was wrong and I knew it instantly. Great food is contrast, and nothing on a menu does contrast better. We have been married six years.",
     "There are different opinions about pineapple on pizza. Some people like it and other people do not like it. It is a topic that is often discussed. Personally I think it depends on individual preferences and tastes. There are arguments on both sides and in the end everyone can decide what they prefer."),
    ("a failure",
     "I froze on stage in front of four hundred people. Eleven seconds of silence. I counted every one. My hands shook so hard the paper rattled in the microphone. Then a stranger in the front row nodded at me, just once. I took a breath, dropped my notes, and told the story from memory.",
     "Failure is something that everyone experiences at some point. I have had some failures in the past and they were not pleasant at the time. However it is commonly said that failure can teach important lessons. In general I believe that it is useful to learn from mistakes and to continue to improve."),
    ("favorite teacher",
     "Mrs. Alvarez caught me cheating in ninth grade. She did not yell. She slid the test back and whispered, you are smarter than this, prove it. Then she stayed after school with me every Tuesday for a year. I became an engineer because one teacher refused to believe the worst thing I showed her.",
     "I had a teacher in school who was quite good. This teacher taught the subject well and was generally helpful to the students in the class. Good teachers are important for education. I think that teachers can have a positive influence and I appreciated the work that this teacher did during that year."),
    ("money advice",
     "At twenty two I had four hundred dollars and a maxed out credit card. My grandfather handed me a jar of coins and said, count it. Nine hundred dollars, saved a quarter at a time over thirty years. He told me, nobody gets rich fast, but anybody can get rich slow. I started that night.",
     "Managing money is an important skill. It is generally recommended to save some portion of income and to avoid unnecessary spending. There are many resources available about personal finance. I think people should consider making a budget and thinking about their financial goals because it can be beneficial in the long term."),
    ("travel",
     "I got lost in Tokyo at midnight with a dead phone and no cash. An old man selling noodles saw my face, closed his stall, and walked me forty minutes to my hotel. He would not take a cent. He bowed and left. I have never felt so small or so looked after in my life.",
     "Traveling is an activity that many people enjoy. I have visited several places and they were interesting in different ways. When you travel you can see new things and experience other cultures. It is often considered a valuable experience. I would say that travel is generally worthwhile if you have the opportunity."),
    ("exercise",
     "Two years ago I could not climb one flight of stairs without stopping. My doctor circled a number on a chart and said, this is the one that kills you. I walked ten minutes that night. Just ten. Last month I ran my first half marathon, and I cried at the finish line like a child.",
     "Exercise is considered to be good for health. Experts recommend that people do some physical activity on a regular basis. There are many types of exercise that people can choose from. I try to exercise sometimes when I have time. In general it is a positive habit that has a number of benefits."),
    ("technology",
     "My daughter asked the smart speaker if it loved her. It said, I am not sure I can love, but I am glad you are here. She is six. She hugged it. I stood in the doorway and realized the machines are not coming for our jobs first. They are coming for our kids' hearts.",
     "Technology has changed a lot in recent years. There are many new devices and applications that people use every day. Technology has advantages and also some disadvantages. It is important to use it in a balanced way. Overall technology continues to develop and it will probably keep affecting society in various ways."),
    ("a hard decision",
     "The job offer was double my salary. The catch was moving three thousand miles from my mother, who had just been diagnosed. I had until Friday. Thursday night she called and said, if you stay for me I will never forgive you. I took the job. I flew home every month until the end.",
     "Sometimes people have to make difficult decisions. I had to make a decision once that was not easy. I considered the different options and thought about the advantages and disadvantages of each. Eventually I made a choice. Making decisions can be challenging but it is a normal part of life for everyone."),
    ("cooking",
     "I set my kitchen on fire making toast. Toast. The fire department came, and one of them looked at the black square in my hand and said, sir, that is a crime. So I signed up for one cooking class out of shame. Now I host dinner for twelve every Sunday.",
     "Cooking is a useful skill to have. I cook some meals at home on a regular basis. There are many recipes that are available and they vary in difficulty. Cooking at home can be healthier and can also save money. I think that learning to cook some basic dishes is a reasonable idea."),
    ("climate",
     "The lake I learned to swim in is a parking lot now. Not polluted, not fenced off. Gone. I took my son to show him and we stood on cracked mud where the dock used to be. He asked where the water went. I did not have an answer that a seven year old could carry.",
     "Climate change is an issue that is frequently discussed. Scientists have said that temperatures are increasing and that this has effects on the environment. There are various proposals to address the problem. It is a complex topic with many factors. I think it is something that society should continue to pay attention to."),
    ("friendship",
     "At two in the morning my car died on the highway in the rain. I called six people. Five did not answer. Marcus picked up on the first ring and said, drop me a pin, I am already putting my shoes on. That is the whole test. Who is already putting their shoes on?",
     "Friendship is an important part of life. Friends are people that you spend time with and who can provide support. I have several friends that I have known for some time. It is generally good to maintain friendships. I think that having good friends contributes to wellbeing and is something people value."),
    ("first job",
     "My first boss fired me on day three. I had dropped an entire tray of wine glasses on a wedding party. The bride was crying. As I left, the dishwasher grabbed my arm and said, kid, everyone drops the tray once. Come back tomorrow and ask again. I did. I stayed four years.",
     "My first job was a typical entry level position. I had various responsibilities and I learned some things about working. The job was fine and it gave me some experience. First jobs are often not very exciting but they are useful. I think that it was a reasonable start to my working life."),
    ("reading",
     "I did not read a single book until I was nineteen. I faked every report in school. Then I was stuck in a hospital bed for a month and a nurse left a paperback on my tray. I finished it at four in the morning and asked her for another. That book was a door.",
     "Reading is a beneficial activity. Books can provide information and entertainment. I read sometimes when I have free time. There are many different genres available for readers to choose from. It is generally recommended that people read regularly. I think reading is a good habit and that it can improve knowledge."),
    ("social media",
     "I deleted every app on my phone for thirty days. On day two my thumb kept opening a blank screen, forty times, like a phantom limb. On day nine I noticed birds. On day thirty I reinstalled one app, scrolled for four minutes, and felt my chest tighten. I deleted it again that night.",
     "Social media is used by a large number of people. It allows users to share content and to communicate with others. There are positive aspects and negative aspects of social media. Some people think it is used too much. I believe that people should try to use social media in a moderate way."),
    ("leadership",
     "Our best engineer quit on a Monday. Her note said one line. Nobody here ever asked what I thought. I had run forty meetings with her in the room and never once stopped talking long enough to hear her. Leadership is not having the answer. It is being the last person to speak.",
     "Leadership is a quality that is valued in organizations. A good leader is someone who can guide a team and help them to achieve goals. There are different styles of leadership. I think that communication is an important part of being a leader. Leadership skills can be developed over time with experience."),
    ("sleep",
     "I fell asleep at a red light with my kids in the back seat. A horn woke me up. I had been bragging for years about running on four hours a night. That afternoon I sat in the driveway shaking. Sleep is not a luxury you earn. It is the thing keeping you alive.",
     "Sleep is important for health. Most adults are advised to get a certain number of hours of sleep each night. Lack of sleep can have negative effects. I try to go to bed at a reasonable time. In general getting enough sleep is recommended and it helps people to function during the day."),
    ("learning a language",
     "I ordered what I thought was chicken in Lisbon. The waiter froze. The whole table next to us went silent. Then an old woman burst out laughing so hard she had to hold the wall. I had asked, very politely, to eat his grandmother. I never forgot that word again.",
     "Learning a new language is a common goal. It requires practice over a period of time. There are many methods and tools that can be used for language learning. I have studied a language and made some progress. I think that knowing another language is useful and that it can provide opportunities."),
    ("pets",
     "The shelter told me the dog was unadoptable. Bit two families. Three days left. I sat on the floor of his cage for an hour and he would not look at me. Then, slowly, he put one paw on my shoe. Just one paw. He sleeps on my feet every night now.",
     "Many people have pets in their homes. Pets such as dogs and cats can provide companionship. Having a pet involves some responsibilities like feeding and care. I think pets can be a nice addition to a household. Overall owning a pet is a decision that depends on a person's situation and preferences."),
    ("starting a business",
     "I had eleven dollars in my account the day my first customer paid. I was sleeping in my car behind a gym. She handed me a check for two thousand and said, you look tired. I said, long week. I cashed it, bought a sandwich, and cried in the parking lot. That was day one.",
     "Starting a business is something that some people decide to do. It involves planning and a certain amount of risk. There are many factors that affect whether a business is successful. I have thought about business ideas. I think that entrepreneurship can be rewarding but it also requires a lot of effort."),
    ("fear",
     "I am terrified of water. I nearly drowned at seven and I can still taste the chlorine. Last summer my nephew slipped off a dock, and before I could think I was in the lake with him in my arms. I still cannot swim. But now I know fear is not the strongest thing in me.",
     "Fear is a normal human emotion. Everyone is afraid of something at certain times. There are different ways that people can deal with fear. I have some fears like most people do. I think that it is helpful to face fears gradually. In general fear is something that can be managed."),
    ("music",
     "My father had not spoken in eight months. The disease took his words first. I put on the record he played at his wedding, and he opened his eyes and sang every line. Every single line. Then the song ended and he was gone again. Music is where we keep people.",
     "Music is enjoyed by many people around the world. There are many different genres and artists. People listen to music for relaxation or entertainment. I listen to music fairly often during the day. I think music is a positive part of life and that most people have some type that they like."),
    ("volunteering",
     "I signed up to serve soup for one hour to impress a girl. A man in line handed me a folded drawing of the shelter with my face in it. He said, you looked at me when you said good morning. Nobody does. I never saw the girl again. I have been back every Saturday for nine years.",
     "Volunteering is an activity where people give their time to help others. There are many organizations that need volunteers. It can be a good way to contribute to the community. I have done some volunteering before. I think that it is a worthwhile thing to do if a person has time available."),
    ("patience",
     "My son took four minutes to tie one shoe. I was late, I was sighing, I reached down to do it myself. He looked up and said, Dad, I almost have it. I sat down on the floor. He got it. The look on his face was worth more than any meeting I have ever been on time for.",
     "Patience is generally considered a virtue. It means being able to wait without becoming upset. Some situations require more patience than others. I try to be patient when possible. I think that patience is a useful quality and that people can work on improving it in their daily lives over time."),
    ("your city",
     "There is a bench in my city where a man plays chess against anyone for a dollar. He has not lost in eleven years. Last week a nine year old girl beat him in twenty moves. He stood up, shook her hand, and gave her the board. The whole block clapped. That is my city.",
     "My city is a medium sized place with a number of features. There are some parks and restaurants and shops. The transportation is acceptable. Many people live and work here. It has some good aspects and some less good aspects. Overall I think it is a reasonable place to live for most people."),
]

FILLERS = ["um", "uh", "like", "you know", "so", "I mean", "basically", "kind of"]
WPM = 150
SENTENCE_PAUSE = 0.35


def add_fillers(text: str, rng: random.Random, every: int = 6) -> str:
    out = []
    for i, w in enumerate(text.split()):
        if i and i % every == 0:
            out.append(rng.choice(FILLERS))
        out.append(w)
    return " ".join(out)


def scramble(text: str, rng: random.Random) -> str:
    words = re.sub(r"[.,!?]", "", text).lower().split()
    rng.shuffle(words)
    out = []
    for i in range(0, len(words), 9):  # keep sentence-like chunks so timing stays comparable
        chunk = words[i:i + 9]
        out.append(" ".join(chunk).capitalize() + ".")
    return " ".join(out)


def to_words(text: str) -> list[dict]:
    """Even pacing at 150 wpm with a short pause after each sentence (removes delivery as a factor)."""
    t, out = 0.3, []
    for w in text.split():
        dur = 60 / WPM * (0.6 + 0.4 * min(len(w), 10) / 5)
        out.append({"text": w, "start": round(t, 2), "end": round(t + dur * 0.85, 2)})
        t += dur + (SENTENCE_PAUSE if re.search(r"[.!?]$", w) else 0)
    return out


def build() -> list[dict]:
    rng = random.Random(0)
    items = []
    for topic, engaging, flat in PAIRS:
        for kind, text in [("engaging", engaging), ("flat", flat),
                           ("filler", add_fillers(flat, rng)), ("scrambled", scramble(engaging, rng))]:
            items.append({"id": f"{topic}|{kind}", "topic": topic, "kind": kind,
                          "text": text, "words": to_words(text)})
    return items


if __name__ == "__main__":
    items = build()
    print(len(items), "texts;", "mean words:", sum(len(i["words"]) for i in items) // len(items),
          "; mean seconds:", round(sum(i["words"][-1]["end"] for i in items) / len(items), 1))
