export interface ScreenplayScene {
  scene_number: number;
  title: string;
  location: string;
  characters_present: string[];
  camera_angle: string;
  voiceover: string;
  dialogue?: string;
  visual_prompt: string;
  negative_prompt?: string;
  image_prompt?: string;
  video_prompt?: string;
  duration_seconds: number;
}

export interface ScreenplayResult {
  title: string;
  logline: string;
  scenes: ScreenplayScene[];
}

export class ScreenplayBuilder {
  static build(movieBible: any): ScreenplayResult {
    const scenes: ScreenplayScene[] = [];

    const rawScenes =
      movieBible?.scene_bible ??
      movieBible?.scenes ??
      [];

    for (const scene of rawScenes) {
      scenes.push({
        scene_number:
          Number(scene.scene_number) || scenes.length + 1,

        title:
          scene.title ?? `Scene ${scenes.length + 1}`,

        location:
          scene.location ?? "Unknown",

        characters_present:
          scene.characters_present ?? [],

        camera_angle:
          scene.camera_angle ?? "Medium Shot",

        voiceover:
          scene.voiceover ?? "",

        dialogue:
          scene.dialogue ?? "",

        visual_prompt:
          scene.visual_prompt ??
          scene.video_prompt ??
          "",

        negative_prompt:
          scene.negative_prompt ?? "",

        image_prompt:
          scene.image_prompt ??
          scene.visual_prompt ??
          "",

        video_prompt:
          scene.video_prompt ??
          scene.visual_prompt ??
          "",

        duration_seconds:
          Number(scene.duration_seconds) || 8,
      });
    }

    return {
      title:
        movieBible.movie_bible?.title ??
        movieBible.title ??
        "Untitled Movie",

      logline:
        movieBible.movie_bible?.theme ??
        movieBible.logline ??
        "",

      scenes,
    };
  }
}