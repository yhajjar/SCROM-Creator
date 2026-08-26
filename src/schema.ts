export const courseSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://local.invalid/scorm/quiz.schema.json",
  title: "Interactive Assessment Quizzes Schema",
  type: "object",
  oneOf: [
    {
      type: "object",
      required: ["quizzes"],
      additionalProperties: false,
      properties: {
        quizzes: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/quiz" }
        }
      }
    },
    {
      $ref: "#/$defs/quiz"
    }
  ],
  $defs: {
    color: { type: "string" },
    id: { type: "string", minLength: 1, maxLength: 100 },
    quiz: {
      type: "object",
      required: ["id", "title", "questions"],
      additionalProperties: true,
      properties: {
        id: { $ref: "#/$defs/id" },
        title: { type: "string", minLength: 1, maxLength: 500 },
        language: { type: "string", minLength: 2, maxLength: 35 },
        direction: { enum: ["ltr", "rtl", "auto"] },
        intro_title: { type: "string", maxLength: 500 },
        intro_body: { type: "string", maxLength: 5000 },
        success_message: { type: "string", maxLength: 2000 },
        failure_message: { type: "string", maxLength: 2000 },
        passing_score_percent: { type: "number", minimum: 0, maximum: 100 },
        attempts: { type: "number", minimum: 1, maximum: 100 },
        shuffle_questions: { type: "boolean" },
        show_feedback: { type: "boolean" },
        results_page: {
          type: "object",
          additionalProperties: true,
          properties: {
            show: { type: "boolean" },
            show_grade: { type: "boolean" },
            message_mode: { type: "string", enum: ["completion", "pass_fail", "none", "score_based"] },
            completion_message: { type: "string", maxLength: 2000 },
            success_message: { type: "string", maxLength: 2000 },
            failure_message: { type: "string", maxLength: 2000 },
            show_result_icon: { type: "boolean" },
            show_review_button: { type: "boolean" }
          }
        },
        assets: {
          type: "object",
          additionalProperties: true,
          properties: {
            review_button_text: { type: "string" },
            review_button_color: { type: "string" },
            review_button_text_color: { type: "string" },
            primary_button_color: { type: "string" },
            primary_button_text_color: { type: "string" },
            correct_feedback_color: { type: "string" },
            incorrect_feedback_color: { type: "string" }
          }
        },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 250,
          items: { $ref: "#/$defs/question" }
        }
      }
    },
    choice_item: {
      type: "object",
      required: ["text"],
      additionalProperties: true,
      properties: {
        order: { type: "number" },
        text: { type: "string", minLength: 1, maxLength: 4000 },
        correct: { type: "boolean" }
      }
    },
    sequence_item: {
      type: "object",
      required: ["text"],
      additionalProperties: true,
      properties: {
        order: { type: "number" },
        text: { type: "string", minLength: 1, maxLength: 4000 }
      }
    },
    matching_item: {
      type: "object",
      required: ["text", "target"],
      additionalProperties: true,
      properties: {
        order: { type: "number" },
        text: { type: "string", minLength: 1, maxLength: 4000 },
        target: { type: "string", minLength: 1, maxLength: 4000 },
        target_order: { type: "number" }
      }
    },
    categorization_category: {
      type: "object",
      required: ["title"],
      additionalProperties: true,
      properties: {
        order: { type: "number" },
        title: { type: "string", minLength: 1, maxLength: 500 }
      }
    },
    categorization_item: {
      type: "object",
      required: ["text", "category"],
      additionalProperties: true,
      properties: {
        order: { type: "number" },
        text: { type: "string", minLength: 1, maxLength: 4000 },
        category: { type: "string", minLength: 1, maxLength: 500 }
      }
    },
    question: {
      oneOf: [
        {
          type: "object",
          required: ["id", "type", "prompt", "items"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "multiple_choice" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            items: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/choice_item" } }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt", "items"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "multiple_response" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            items: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/choice_item" } }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt", "items"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "sequence" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            items: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/sequence_item" } }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt", "items"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "matching" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            items: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/matching_item" } }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt", "body"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "word_bank" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            body: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            distractors: {
              type: "array",
              items: { type: "string", minLength: 1, maxLength: 500 }
            }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "categorization" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 },
            categories: {
              type: "array",
              minItems: 2,
              items: { $ref: "#/$defs/categorization_category" }
            },
            items: {
              type: "array",
              minItems: 2,
              items: { $ref: "#/$defs/categorization_item" }
            }
          }
        },
        {
          type: "object",
          required: ["id", "type", "prompt", "correct_answer"],
          additionalProperties: true,
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "true_false" },
            order: { type: "number" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            correct_answer: { type: "boolean" },
            points: { type: "number", minimum: 0, maximum: 1000 },
            attempts: { type: "number", minimum: 1, maximum: 100 },
            shuffle: { type: "boolean" },
            correct_feedback: { type: "string", maxLength: 4000 },
            incorrect_feedback: { type: "string", maxLength: 4000 }
          }
        }
      ]
    }
  }
} as const;
