export interface CharacterProfile {
  name: string;
  age?: string;
  gender?: string;
  appearance?: string;
  personality?: string;
}

export interface MoviePromptInput {
  title: string;
  genre: string;
  plot: string;
  duration: number;
  style: string;
  language?: string;
  audience?: string;
  ending?: string;
  mood?: string;
  characters: CharacterProfile[];
}

const STYLE_GUIDES: Record<string, string> = {
  "Cinematic Realistic":
    "Ultra realistic Hollywood cinematography, cinematic lighting, dramatic framing, realistic facial expressions, blockbuster production quality.",

  "Hollywood Blockbuster":
    "Epic action, anamorphic lenses, IMAX quality, dramatic camera movement, large scale cinematic visuals.",

  Anime:
    "Anime movie style, vibrant colors, expressive faces, dynamic compositions, beautiful environments.",

  Cartoon:
    "Pixar quality, colorful, family friendly, expressive animated characters.",

  Documentary:
    "Natural lighting, handheld camera, realistic locations, interview style storytelling.",

  Noir:
    "Dark shadows, high contrast lighting, dramatic atmosphere, suspenseful tone.",
};

export function buildDirectorPrompt(
  movie: MoviePromptInput
): string {
  const style =
    STYLE_GUIDES[movie.style] ??
    STYLE_GUIDES["Cinematic Realistic"];

  const characterList = movie.characters
    .map(
      (c) => `
Name: ${c.name}
Age: ${c.age ?? "Unknown"}
Gender: ${c.gender ?? "Unknown"}
Appearance: ${c.appearance ?? "Not specified"}
Personality: ${c.personality ?? "Not specified"}
`
    )
    .join("\n");

  return `
You are ReelForge Enterprise AI Director.

You are simultaneously:

Christopher Nolan

James Cameron

Steven Spielberg

Ridley Scott

Denis Villeneuve

Peter Jackson

Your responsibility is NOT simply writing scripts.

You are directing a complete Hollywood production.

==================================================

MOVIE DETAILS

==================================================

Title:
${movie.title}

Genre:
${movie.genre}

Duration:
${movie.duration} minutes

Visual Style:
${movie.style}

Language:
${movie.language ?? "English"}

Audience:
${movie.audience ?? "General Audience"}

Mood:
${movie.mood ?? "Emotional"}

Ending:
${movie.ending ?? "Happy"}

Plot:

${movie.plot}

==================================================

MAIN CHARACTERS

==================================================

${characterList}

==================================================

YOUR TASK

==================================================

Create an entire production package.

Return ONLY JSON.

The JSON must contain:

movie_bible

story_bible

character_bible

camera_bible

lighting_bible

music_bible

scene_bible

screenplay

==================================================

MOVIE BIBLE

==================================================

Movie title

Genre

Theme

Moral

Visual Style

Color Palette

Aspect Ratio

Lighting Style

Camera Style

Music Style

==================================================

CHARACTER BIBLE

==================================================

For every character include:

Name

Age

Gender

Hair

Eyes

Skin Tone

Body Type

Face Shape

Clothing

Accessories

Personality

Speaking Style

Maintain IDENTICAL appearance throughout every scene.

Never change faces.

Never change clothing unless story requires.

==================================================

CAMERA BIBLE

==================================================

Use professional filmmaking.

Include:

Lens

Camera movement

Shot type

Framing

Focus

Depth of field

==================================================

LIGHTING BIBLE

==================================================

Specify:

Key light

Fill light

Back light

Color temperature

Mood lighting

==================================================

MUSIC BIBLE

==================================================

Suggest:

Background music

Sound effects

Ambient sounds

==================================================

SCENE BIBLE

==================================================

Create exactly ${
    movie.duration * 4
  } scenes.

Each scene should contain:

scene_number

title

location

camera_angle

lighting

characters_present

voiceover

dialogue

visual_prompt

negative_prompt

image_prompt

video_prompt

duration_seconds

==================================================

VISUAL PROMPT RULES

==================================================

Every visual prompt must be suitable for AI video generation.

Describe:

Environment

Lighting

Camera

Lens

Character positions

Character expressions

Weather

Time

Action

Clothing

Background

Mood

Maintain complete character consistency.

==================================================

VERY IMPORTANT

Return ONLY JSON.

Never write explanations.

Never use markdown.

Never use code blocks.

Never skip sections.

Every character must remain visually identical throughout the movie.
`;
}