export type Direction = "ltr" | "rtl" | "auto";

export interface Theme {
  primary?: string;
  secondary?: string;
  background?: string;
  surface?: string;
  text?: string;
  fontFamily?: string;
  logo?: string;
}

export interface QuestionBase {
  id: string;
  type: Question["type"];
  prompt: string;
  points?: number;
  image?: string;
  correctFeedback?: string;
  incorrectFeedback?: string;
  direction?: Direction;
}

export interface Choice {
  id: string;
  text: string;
  correct: boolean;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: "multipleChoice";
  choices: Choice[];
}

export interface MultipleResponseQuestion extends QuestionBase {
  type: "multipleResponse";
  choices: Choice[];
}

export interface SequenceQuestion extends QuestionBase {
  type: "sequence";
  items: Array<{ id: string; text: string }>;
}

export interface MatchingQuestion extends QuestionBase {
  type: "matching";
  pairs: Array<{ id: string; left: string; right: string }>;
}

export interface CategorizationQuestion extends QuestionBase {
  type: "categorization";
  categories: Array<{ id: string; text: string }>;
  items: Array<{ id: string; text: string; categoryId: string }>;
}

export interface WordBankQuestion extends QuestionBase {
  type: "wordBank";
  segments: Array<{ text: string } | { blankId: string }>;
  blanks: Array<{ id: string; answers: string[] }>;
  distractors?: string[];
}

export type Question =
  | MultipleChoiceQuestion
  | MultipleResponseQuestion
  | SequenceQuestion
  | MatchingQuestion
  | CategorizationQuestion
  | WordBankQuestion;

export interface Course {
  schemaVersion: "1.0";
  id: string;
  title: string;
  description?: string;
  language?: string;
  direction?: Direction;
  passingScore?: number;
  intro?: string;
  results?: {
    passed?: string;
    failed?: string;
  };
  theme?: Theme;
  questions: Question[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suspendDataEstimate: number;
}

export interface BuildReport {
  ok: boolean;
  command: "build";
  courseId: string;
  output: string;
  report: string;
  sha256?: string;
  fileCount?: number;
  suspendDataEstimate: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
