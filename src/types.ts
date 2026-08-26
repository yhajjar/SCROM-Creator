export type Direction = "ltr" | "rtl" | "auto";

export interface QuizAssets {
  review_button_text?: string;
  review_button_color?: string;
  review_button_text_color?: string;
  primary_button_color?: string;
  primary_button_text_color?: string;
  correct_feedback_color?: string;
  incorrect_feedback_color?: string;
  [key: string]: string | undefined;
}

export interface ChoiceItem {
  order?: number;
  text: string;
  correct?: boolean;
}

export interface SequenceItem {
  order?: number;
  text: string;
}

export interface MatchingItem {
  order?: number;
  text: string;
  target: string;
  target_order?: number;
}

export interface CategorizationCategory {
  order?: number;
  title: string;
}

export interface CategorizationItem {
  order?: number;
  text: string;
  category: string;
}

export interface MultipleChoiceQuizQuestion {
  id: string;
  type: "multiple_choice";
  order?: number;
  prompt: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  items: ChoiceItem[];
}

export interface MultipleResponseQuizQuestion {
  id: string;
  type: "multiple_response";
  order?: number;
  prompt: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  items: ChoiceItem[];
}

export interface SequenceQuizQuestion {
  id: string;
  type: "sequence";
  order?: number;
  prompt: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  items: SequenceItem[];
}

export interface MatchingQuizQuestion {
  id: string;
  type: "matching";
  order?: number;
  prompt: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  items: MatchingItem[];
}

export interface WordBankQuizQuestion {
  id: string;
  type: "word_bank";
  order?: number;
  prompt: string;
  body: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  distractors?: string[];
}

export interface CategorizationQuizQuestion {
  id: string;
  type: "categorization";
  order?: number;
  prompt: string;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
  categories?: CategorizationCategory[];
  items?: CategorizationItem[];
}

export interface TrueFalseQuizQuestion {
  id: string;
  type: "true_false";
  order?: number;
  prompt: string;
  correct_answer: boolean;
  points?: number;
  attempts?: number;
  shuffle?: boolean;
  show_feedback?: boolean;
  correct_feedback?: string;
  incorrect_feedback?: string;
}

export type QuizQuestion =
  | MultipleChoiceQuizQuestion
  | MultipleResponseQuizQuestion
  | SequenceQuizQuestion
  | MatchingQuizQuestion
  | WordBankQuizQuestion
  | CategorizationQuizQuestion
  | TrueFalseQuizQuestion;

export interface ResultsPageConfig {
  show: boolean;
  show_grade: boolean;
  message_mode: "completion" | "pass_fail" | "none" | "score_based";
  completion_message: string;
  success_message: string;
  failure_message: string;
  show_result_icon: boolean;
  show_review_button: boolean;
}

export const DEFAULT_RESULTS_PAGE: ResultsPageConfig = {
  show: true,
  show_grade: false,
  message_mode: "completion",
  completion_message: "Thanks for attending the quiz.",
  success_message: "Well done! You passed with {{points}} out of {{max_points}} points ({{percent}}%).",
  failure_message: "You scored {{percent}}%. You need {{passing_percent}}% to pass.",
  show_result_icon: false,
  show_review_button: true
};

export interface Quiz {
  id: string;
  title: string;
  language?: string;
  direction?: Direction;
  intro_title?: string;
  intro_body?: string;
  success_message?: string;
  failure_message?: string;
  passing_score_percent?: number;
  attempts?: number;
  shuffle_questions?: boolean;
  show_feedback?: boolean;
  results_page?: ResultsPageConfig;
  assets?: QuizAssets;
  questions: QuizQuestion[];
}

export interface QuizzesContainer {
  quizzes: Quiz[];
}

export type Course = QuizzesContainer;

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

export interface ExportReport {
  ok: boolean;
  command: "export" | "validate" | "build";
  courseId: string;
  output?: string;
  report?: string;
  sha256?: string;
  questionCount: number;
  totalPoints: number;
  suspendDataEstimate?: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type BuildReport = ExportReport;
