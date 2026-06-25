# Cartoon Background Music (Phase 2.8)

Drop **royalty-free / CC0** music tracks here to enable cinematic background
music for Standard and Dialogue movie modes. No audio is committed to the repo —
when a track is missing the renderer simply continues with no music.

## Expected filenames

The renderer resolves a track by **mood**, derived from the story genre. Provide
one file per mood (first matching extension wins: `.mp3`, `.m4a`, `.wav`, `.ogg`):

| File            | Used for genres                  |
|-----------------|----------------------------------|
| `fantasy.mp3`   | fantasy                          |
| `adventure.mp3` | adventure, sci_fi, *(fallback)*  |
| `comedy.mp3`    | comedy                           |
| `drama.mp3`     | drama, romance, mystery          |
| `horror.mp3`    | horror, thriller                 |
| `motivational.mp3` | *(available for future use)*  |

You may also drop a file named after the raw genre (e.g. `romance.mp3`) to
override the mood mapping for that genre.

## Location override

Set `CARTOON_MUSIC_DIR` to point at a different directory (e.g. a mounted
volume on Railway) instead of this folder.

## How it's mixed

- Volume: `0.12` (~12%) under the dialogue/voice — dialogue stays clearly audible.
- Fade in over the first 2s, fade out over the last 2s.
- Looped and trimmed to the exact movie length.

## Suggested royalty-free sources

- Pixabay Music (CC0)
- Kevin MacLeod / incompetech.com (CC-BY — attribute per license)
- YouTube Audio Library (royalty-free)

Confirm each track's license permits commercial use before shipping.
