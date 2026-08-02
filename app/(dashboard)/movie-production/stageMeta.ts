import { ProductionStage } from '@/services/ai/orchestration/MovieProductionContracts'

/** Pipeline order — mirrors STAGE_COMPLETION in MovieProductionService.ts. */
export const STAGE_ORDER: ProductionStage[] = [
  ProductionStage.StoryAnalysis,
  ProductionStage.CharacterDevelopment,
  ProductionStage.EnvironmentDesign,
  ProductionStage.CameraPlanning,
  ProductionStage.EmotionPlanning,
  ProductionStage.ScenePlanning,
  ProductionStage.ReferenceImageGeneration,
  ProductionStage.PromptComposition,
  ProductionStage.VideoGeneration,
  ProductionStage.MovieAssembly,
  ProductionStage.FinalRendering,
]

export const STAGE_META: Record<ProductionStage, { label: string; description: string }> = {
  [ProductionStage.StoryAnalysis]: {
    label: 'Story Planning',
    description: 'Analyzing the idea into a structured story blueprint.',
  },
  [ProductionStage.CharacterDevelopment]: {
    label: 'Character Planning',
    description: 'Designing characters, appearance, and voice profiles.',
  },
  [ProductionStage.EnvironmentDesign]: {
    label: 'Environment Planning',
    description: 'Building out locations, atmosphere, and lighting.',
  },
  [ProductionStage.CameraPlanning]: {
    label: 'Camera Planning',
    description: 'Planning shots, angles, and camera movement per scene.',
  },
  [ProductionStage.EmotionPlanning]: {
    label: 'Emotion Planning',
    description: 'Mapping emotional tone and pacing across scenes.',
  },
  [ProductionStage.ScenePlanning]: {
    label: 'Scene Planning',
    description: 'Assembling scenes from the story, camera, and emotion plans.',
  },
  [ProductionStage.ReferenceImageGeneration]: {
    label: 'Character Images',
    description: 'Generating character reference images for visual consistency.',
  },
  [ProductionStage.PromptComposition]: {
    label: 'Prompt Composition',
    description: 'Composing the per-scene generation prompts.',
  },
  [ProductionStage.VideoGeneration]: {
    label: 'Video Generation',
    description: 'Rendering scene video clips.',
  },
  [ProductionStage.MovieAssembly]: {
    label: 'Movie Assembly',
    description: 'Assembling generated scenes into a single timeline.',
  },
  [ProductionStage.FinalRendering]: {
    label: 'Final Rendering',
    description: 'Encoding the final movie file.',
  },
}
