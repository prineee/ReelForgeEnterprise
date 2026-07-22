/**
 * OutputSchema.ts (v2)
 *
 * Framework-independent, strongly typed contract for the AI Director pipeline's
 * output. Describes the shape of a generated Movie — its cast, environments,
 * scenes, camera/emotion direction, and the render pipeline that turns a Scene
 * into finished video output.
 *
 * v2 replaces the v1 pattern of stashing extra production detail inside
 * freeform description/notes strings (or module-local extension interfaces)
 * with real typed fields on the core entities, so every module can consume
 * these interfaces directly without extending them.
 *
 * Deprecated fields are kept, where reasonable, for backward compatibility
 * with v1 consumers; new code should prefer the fields that replace them.
 *
 * Final revision note: EmotionPlan was redesigned from modeling a single
 * character's emotion to modeling the emotional plan for an entire Scene
 * (dominant emotion, intensity, transition, audience target, pacing notes,
 * and per-character emotional states). Scene's deprecated per-character
 * `emotionPlans` array was removed as part of this change, since it no
 * longer has a coherent v1 meaning to preserve; `emotionPlanId` remains the
 * only way to reference a Scene's EmotionPlan.
 *
 * This file contains type declarations only. No business logic, no
 * project-specific imports, no runtime behavior.
 */

/**
 * Opaque identifier used to reference an entity (Character, Environment,
 * Scene, Movie, CameraPlan, EmotionPlan, RenderTask, etc.) without
 * duplicating its data.
 */
export type EntityId = string;

/**
 * ISO 8601 timestamp string (e.g. "2026-07-17T12:00:00.000Z").
 */
export type ISODateTimeString = string;

/**
 * Narrative genre classification for a Movie.
 */
export enum Genre {
  Action = "ACTION",
  Adventure = "ADVENTURE",
  Comedy = "COMEDY",
  Documentary = "DOCUMENTARY",
  Drama = "DRAMA",
  Fantasy = "FANTASY",
  Horror = "HORROR",
  Musical = "MUSICAL",
  Mystery = "MYSTERY",
  Noir = "NOIR",
  Romance = "ROMANCE",
  SciFi = "SCI_FI",
  Thriller = "THRILLER",
}

/**
 * Camera framing/shot type used for a Scene's CameraPlan.
 */
export enum CameraShot {
  EstablishingShot = "ESTABLISHING_SHOT",
  WideShot = "WIDE_SHOT",
  MediumShot = "MEDIUM_SHOT",
  CloseUp = "CLOSE_UP",
  ExtremeCloseUp = "EXTREME_CLOSE_UP",
  OverTheShoulder = "OVER_THE_SHOULDER",
  LowAngle = "LOW_ANGLE",
  HighAngle = "HIGH_ANGLE",
  DutchAngle = "DUTCH_ANGLE",
  PointOfView = "POINT_OF_VIEW",
  DroneShot = "DRONE_SHOT",
  TrackingShot = "TRACKING_SHOT",
  DollyZoom = "DOLLY_ZOOM",
}

/**
 * Physical camera movement applied during a shot.
 */
export enum CameraMovement {
  Static = "STATIC",
  PanLeft = "PAN_LEFT",
  PanRight = "PAN_RIGHT",
  TiltUp = "TILT_UP",
  TiltDown = "TILT_DOWN",
  ZoomIn = "ZOOM_IN",
  ZoomOut = "ZOOM_OUT",
  DollyIn = "DOLLY_IN",
  DollyOut = "DOLLY_OUT",
  Orbit = "ORBIT",
  Handheld = "HANDHELD",
  CraneUp = "CRANE_UP",
  CraneDown = "CRANE_DOWN",
}

/**
 * Camera height relative to the subject.
 */
export enum CameraHeight {
  GroundLevel = "GROUND_LEVEL",
  Low = "LOW",
  EyeLevel = "EYE_LEVEL",
  High = "HIGH",
  Overhead = "OVERHEAD",
  Aerial = "AERIAL",
}

/**
 * How a Scene's CameraPlan transitions into the next scene.
 */
export enum SceneTransition {
  Cut = "CUT",
  FadeIn = "FADE_IN",
  FadeOut = "FADE_OUT",
  Dissolve = "DISSOLVE",
  Wipe = "WIPE",
  MatchCut = "MATCH_CUT",
  JumpCut = "JUMP_CUT",
  None = "NONE",
}

/**
 * Emotional tone conveyed by a Character, or by a Scene as a whole.
 */
export enum Emotion {
  Joy = "JOY",
  Sadness = "SADNESS",
  Anger = "ANGER",
  Fear = "FEAR",
  Surprise = "SURPRISE",
  Disgust = "DISGUST",
  Love = "LOVE",
  Tension = "TENSION",
  Calm = "CALM",
  Excitement = "EXCITEMENT",
  Melancholy = "MELANCHOLY",
  Determination = "DETERMINATION",
}

/**
 * How a Scene's emotional tone shifts across its EmotionPlan.
 */
export enum EmotionTransition {
  Rising = "RISING",
  Falling = "FALLING",
  Sudden = "SUDDEN",
  Gradual = "GRADUAL",
  Steady = "STEADY",
  Reversal = "REVERSAL",
  Cathartic = "CATHARTIC",
}

/**
 * Ambient weather condition for an Environment.
 */
export enum Weather {
  Clear = "CLEAR",
  Cloudy = "CLOUDY",
  Overcast = "OVERCAST",
  Rain = "RAIN",
  Storm = "STORM",
  Snow = "SNOW",
  Fog = "FOG",
  Windy = "WINDY",
}

/**
 * Lighting condition/style for an Environment or Scene.
 */
export enum Lighting {
  Daylight = "DAYLIGHT",
  GoldenHour = "GOLDEN_HOUR",
  BlueHour = "BLUE_HOUR",
  Overcast = "OVERCAST",
  Night = "NIGHT",
  Moonlight = "MOONLIGHT",
  Neon = "NEON",
  Candlelight = "CANDLELIGHT",
  Studio = "STUDIO",
  HighKey = "HIGH_KEY",
  LowKey = "LOW_KEY",
}

/**
 * Time of day for an Environment or Scene.
 */
export enum TimeOfDay {
  Dawn = "DAWN",
  Morning = "MORNING",
  Noon = "NOON",
  Afternoon = "AFTERNOON",
  GoldenHour = "GOLDEN_HOUR",
  Dusk = "DUSK",
  Night = "NIGHT",
  Midnight = "MIDNIGHT",
}

/**
 * Content/audience rating for a finished Movie.
 */
export enum ContentRating {
  General = "G",
  ParentalGuidance = "PG",
  Teen = "PG13",
  Mature = "R",
  AdultsOnly = "NC17",
  Unrated = "UNRATED",
}

/**
 * File format a Movie can be exported to.
 */
export enum ExportFormat {
  MP4 = "MP4",
  MOV = "MOV",
  WebM = "WEBM",
  ProRes = "PRORES",
  GIF = "GIF",
}

/**
 * Platform/channel a finished Movie is intended to be distributed to.
 */
export enum DistributionTarget {
  YouTube = "YOUTUBE",
  YouTubeShorts = "YOUTUBE_SHORTS",
  InstagramReels = "INSTAGRAM_REELS",
  TikTok = "TIKTOK",
  Facebook = "FACEBOOK",
  Twitter = "TWITTER",
  Theatrical = "THEATRICAL",
  Streaming = "STREAMING",
  PrivateShare = "PRIVATE_SHARE",
}

/**
 * Lifecycle status of a render job.
 */
export enum RenderStatus {
  Pending = "PENDING",
  Queued = "QUEUED",
  Rendering = "RENDERING",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

/**
 * Physical/visual traits that must stay consistent for a Character across
 * every Scene and every generated frame.
 */
export interface AppearanceProfile {
  age?: number;
  gender?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  /** @deprecated Use Character.physicalTraits instead. */
  distinguishingFeatures?: string[];
  /** @deprecated Use Character.wardrobe instead. */
  wardrobe?: string[];
  /**
   * Generation seed, embedding ID, or model fingerprint used to keep the
   * character's rendered appearance consistent across scenes.
   */
  consistencySeed?: string;
}

/**
 * A persistent identifier for synthesized speech/narration, decoupled from
 * any specific text-to-speech vendor.
 */
export interface VoiceProfile {
  id: EntityId;
  voiceName?: string;
  tone?: string;
  /** ISO 639-1 language code, e.g. "en". */
  language?: string;
  pitch?: number;
  speed?: number;
}

/**
 * A persistent reference image used to anchor generated visuals for a
 * Character or Environment.
 */
export interface ReferenceImage {
  id: EntityId;
  url?: string;
  /** e.g. "front", "profile", "three-quarter", "wide", "detail". */
  angle?: string;
  description?: string;
}

/**
 * A persistent, reusable cast member. Referenced by ID from Scene rather
 * than duplicated, so appearance stays consistent across the Movie.
 */
export interface Character {
  /** Stable, persistent identifier referenced by Scene.characterIds. */
  id: EntityId;
  name: string;
  description: string;
  appearance: AppearanceProfile;
  /** Ordered list of defining personality traits. */
  personality: string[];
  /** Default emotional state the character returns to between scenes. */
  emotionalBaseline: Emotion;
  /** Signature wardrobe items, kept consistent across scenes. */
  wardrobe: string[];
  /** Notable physical traits distinct from AppearanceProfile's base fields. */
  physicalTraits: string[];
  voiceProfile: VoiceProfile;
  referenceImages: ReferenceImage[];
  /** @deprecated Use voiceProfile.id instead. */
  voiceProfileId?: EntityId;
  /** @deprecated Use referenceImages instead. */
  referenceImageIds?: EntityId[];
}

/**
 * A persistent, reusable location/setting. Referenced by ID from Scene
 * rather than duplicated, so continuity (weather, lighting, layout) stays
 * consistent across the Movie.
 */
export interface Environment {
  /** Stable, persistent identifier referenced by Scene.environmentId. */
  id: EntityId;
  name: string;
  description: string;
  location: string;
  /** Structural/architectural style of the setting. */
  architecture: string;
  /** Mood/ambience of the setting. */
  atmosphere: string;
  /** Notable set pieces/objects present in the setting. */
  props: string[];
  /** Background/ambient sound characteristic of the setting. */
  ambientSound: string;
  /** Dominant color palette, e.g. ["#1a1a2e", "#e94560"] or named colors. */
  dominantColors: string[];
  timeOfDay: TimeOfDay;
  weather?: Weather;
  lighting?: Lighting;
  /** Freeform notes ensuring visual/spatial continuity across scenes. */
  continuityNotes?: string;
  referenceImages?: ReferenceImage[];
  /** @deprecated Use referenceImages instead. */
  referenceImageIds?: EntityId[];
}

/**
 * What the camera is focused on for a given CameraPlan.
 */
export interface FocusSubject {
  /** References Character.id, when the subject is a character. */
  characterId?: EntityId;
  description: string;
}

/**
 * Persistent camera direction for a single Scene. Referenced by ID from
 * Scene.cameraPlanId rather than duplicated.
 */
export interface CameraPlan {
  /** Stable, persistent identifier referenced by Scene.cameraPlanId. */
  id: EntityId;
  sceneNumber: number;
  shot: CameraShot;
  movement?: CameraMovement;
  /** Camera angle, in degrees, relative to eye level. */
  angle: number;
  lens: string;
  /** Compositional framing, e.g. "rule of thirds, subject left". */
  framing: string;
  lighting: Lighting;
  cameraHeight: CameraHeight;
  focusSubject: FocusSubject;
  transitionToNext: SceneTransition;
  /** Why this shot serves the story at this moment. */
  cinematicPurpose: string;
  focalLength?: number;
  durationSeconds?: number;
  /** @deprecated Use `angle` instead. */
  angleDegrees?: number;
}

/**
 * A single Character's emotional state within a Scene's EmotionPlan.
 */
export interface CharacterEmotionState {
  /** References Character.id. */
  characterId: EntityId;
  emotion: Emotion;
  /** Intensity from 1 (subtle) to 10 (extreme). */
  intensity: number;
  notes?: string;
}

/**
 * Persistent emotional direction for an entire Scene. Referenced by ID from
 * Scene.emotionPlanId rather than duplicated.
 *
 * Models the scene's overall emotional throughline — its dominant emotion,
 * intensity, and transition — plus the individual emotional state of every
 * character present, rather than a single character's emotion in isolation.
 */
export interface EmotionPlan {
  /** Stable, persistent identifier referenced by Scene.emotionPlanId. */
  id: EntityId;
  /** References Scene.sceneNumber — the scene this plan governs. */
  sceneNumber: number;
  /** The scene's overall emotional tone. */
  dominantEmotion: Emotion;
  /** Intensity from 1 (subtle) to 10 (extreme). */
  intensity: number;
  /** How the emotional tone shifts across the scene. */
  transition: EmotionTransition;
  /** The emotional response this scene is meant to evoke in the audience. */
  audienceTarget: string;
  /** Guidance on rhythm/timing to support the intended emotional beat. */
  pacingNotes: string;
  /** Per-character emotional states for every character present in the scene. */
  characterStates: CharacterEmotionState[];
}

/**
 * A single line of spoken dialogue attributed to a Character.
 */
export interface DialogueLine {
  /** References Character.id — the speaker. */
  characterId: EntityId;
  text: string;
  startTimeSeconds?: number;
  durationSeconds?: number;
}

/**
 * Assigns a persistent VoiceProfile to a Character for a given Scene.
 */
export interface VoiceActorAssignment {
  /** References Character.id. */
  characterId: EntityId;
  /** References VoiceProfile.id. */
  voiceProfileId: EntityId;
}

/**
 * Background music direction for a Scene.
 */
export interface MusicCue {
  /** References a persisted audio track, if one has been generated/sourced. */
  trackId?: EntityId;
  style?: string;
  moodTags?: string[];
  /** Normalized playback volume from 0 (silent) to 1 (full). */
  volume?: number;
}

/**
 * A single sound effect placed within a Scene's timeline.
 */
export interface SoundEffectCue {
  name: string;
  timestampSeconds?: number;
  /** Normalized playback volume from 0 (silent) to 1 (full). */
  volume?: number;
}

/**
 * A single shot/beat within a Movie. References Characters, the
 * Environment, the CameraPlan, and the EmotionPlan by ID rather than
 * duplicating their data, so any update to a referenced entity
 * automatically propagates to every Scene that uses it.
 */
export interface Scene {
  id: EntityId;
  sceneNumber: number;
  title?: string;
  description: string;
  /** References Environment.id. */
  environmentId: EntityId;
  /** References Character.id for every character present in the scene. */
  characterIds: EntityId[];
  /** References CameraPlan.id. */
  cameraPlanId: EntityId;
  /** References EmotionPlan.id — the scene's primary emotional throughline. */
  emotionPlanId: EntityId;
  dialogue?: DialogueLine[];
  voiceActors?: VoiceActorAssignment[];
  backgroundMusic?: MusicCue;
  soundEffects?: SoundEffectCue[];
  /** Estimated cost, in platform credits, to render this scene. */
  estimatedRenderCost?: number;
  /** Estimated wall-clock render time, in seconds. */
  estimatedRenderTime?: number;
  durationSeconds?: number;
  timeOfDay?: TimeOfDay;
  /** @deprecated Use cameraPlanId to reference a persisted CameraPlan. */
  cameraPlan?: CameraPlan;
}

/**
 * The complete narrative and production blueprint for a generated movie,
 * composed of persistent Characters, Environments, CameraPlans, and
 * EmotionPlans, plus an ordered list of Scenes that reference them.
 */
export interface Movie {
  id: EntityId;
  title: string;
  logline: string;
  genres: Genre[];
  synopsis: string;
  characters: Character[];
  environments: Environment[];
  cameraPlans: CameraPlan[];
  emotionPlans: EmotionPlan[];
  scenes: Scene[];
  /** Prompt used to generate the movie's poster artwork. */
  posterPrompt: string;
  /** Prompt used to generate the movie's thumbnail artwork. */
  thumbnailPrompt: string;
  /** ISO 639-1 language code of the primary audio track, e.g. "en". */
  language: string;
  /** ISO 639-1 language codes available as subtitle tracks. */
  subtitleLanguage: string[];
  contentRating: ContentRating;
  exportFormats: ExportFormat[];
  distributionTargets: DistributionTarget[];
  /** Overall musical style/genre for the score, e.g. "orchestral, tense". */
  musicStyle: string;
  estimatedDurationSeconds?: number;
  createdAt: ISODateTimeString;
}

/**
 * A unit of render work for a single Scene, tracked through the render
 * pipeline's lifecycle.
 */
export interface RenderTask {
  id: EntityId;
  /** References Scene.id. */
  sceneId: EntityId;
  status: RenderStatus;
  /** Completion percentage, 0-100. */
  progress?: number;
  outputUrl?: string;
  errorMessage?: string;
  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
  retryCount?: number;
}

/**
 * The final aggregated output of rendering an entire Movie: the set of
 * per-scene RenderTasks plus the assembled final video, if completed.
 */
export interface MovieOutput {
  /** References Movie.id. */
  movieId: EntityId;
  renderTasks: RenderTask[];
  finalVideoUrl?: string;
  status: RenderStatus;
  totalDurationSeconds?: number;
  generatedAt: ISODateTimeString;
}
