export type Dosha = "vata" | "pitta" | "kapha";

export type Gender = "female" | "male" | "other";

export type SkinType = "dry" | "sensitive" | "oily";

export interface QuizOption {
  id: string;
  label: string;
  doshaWeights: Partial<Record<Dosha, number>>;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export interface QuizAnswers {
  gender: Gender;
  responses: Record<string, string>;
}

export interface ScoringResult {
  dominantDosha: Dosha;
  skinType: SkinType;
  scores: Record<Dosha, number>;
}
