export const courseSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://local.invalid/scorm/course.schema.json",
  title: "Reusable SCORM course",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "title", "questions"],
  properties: {
    schemaVersion: { const: "1.0" },
    id: { type: "string", format: "uuid" },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", maxLength: 2000 },
    language: { type: "string", minLength: 2, maxLength: 35, default: "en" },
    direction: { enum: ["ltr", "rtl", "auto"], default: "ltr" },
    passingScore: { type: "number", minimum: 0, maximum: 100, default: 80 },
    intro: { type: "string", maxLength: 4000 },
    results: {
      type: "object",
      additionalProperties: false,
      properties: {
        passed: { type: "string", maxLength: 2000 },
        failed: { type: "string", maxLength: 2000 }
      }
    },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: { $ref: "#/$defs/color" },
        secondary: { $ref: "#/$defs/color" },
        background: { $ref: "#/$defs/color" },
        surface: { $ref: "#/$defs/color" },
        text: { $ref: "#/$defs/color" },
        fontFamily: { type: "string", minLength: 1, maxLength: 120 },
        logo: { $ref: "#/$defs/assetPath" }
      }
    },
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 250,
      items: { $ref: "#/$defs/question" }
    }
  },
  $defs: {
    color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    id: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" },
    assetPath: {
      type: "string",
      minLength: 1,
      maxLength: 240,
      pattern: "^(?![A-Za-z]:)(?![/\\\\])(?!.*(?:^|[/\\\\])\\.\\.(?:[/\\\\]|$)).+$"
    },
    base: {
      type: "object",
      required: ["id", "type", "prompt"],
      properties: {
        id: { $ref: "#/$defs/id" },
        type: { type: "string" },
        prompt: { type: "string", minLength: 1, maxLength: 8000 },
        points: { type: "number", exclusiveMinimum: 0, maximum: 1000, default: 1 },
        image: { $ref: "#/$defs/assetPath" },
        correctFeedback: { type: "string", maxLength: 4000 },
        incorrectFeedback: { type: "string", maxLength: 4000 },
        direction: { enum: ["ltr", "rtl", "auto"] }
      }
    },
    choice: {
      type: "object",
      additionalProperties: false,
      required: ["id", "text", "correct"],
      properties: {
        id: { $ref: "#/$defs/id" },
        text: { type: "string", minLength: 1, maxLength: 4000 },
        correct: { type: "boolean" }
      }
    },
    item: {
      type: "object",
      additionalProperties: false,
      required: ["id", "text"],
      properties: {
        id: { $ref: "#/$defs/id" },
        text: { type: "string", minLength: 1, maxLength: 4000 }
      }
    },
    question: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "choices"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "multipleChoice" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            choices: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/choice" } }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "choices"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "multipleResponse" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            choices: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/choice" } }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "items"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "sequence" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            items: { type: "array", minItems: 2, maxItems: 30, items: { $ref: "#/$defs/item" } }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "pairs"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "matching" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            pairs: {
              type: "array",
              minItems: 2,
              maxItems: 30,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "left", "right"],
                properties: {
                  id: { $ref: "#/$defs/id" },
                  left: { type: "string", minLength: 1, maxLength: 4000 },
                  right: { type: "string", minLength: 1, maxLength: 4000 }
                }
              }
            }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "categories", "items"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "categorization" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            categories: { type: "array", minItems: 2, maxItems: 20, items: { $ref: "#/$defs/item" } },
            items: {
              type: "array",
              minItems: 2,
              maxItems: 50,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "text", "categoryId"],
                properties: {
                  id: { $ref: "#/$defs/id" },
                  text: { type: "string", minLength: 1, maxLength: 4000 },
                  categoryId: { $ref: "#/$defs/id" }
                }
              }
            }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "prompt", "segments", "blanks"],
          properties: {
            id: { $ref: "#/$defs/id" },
            type: { const: "wordBank" },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            points: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
            image: { $ref: "#/$defs/assetPath" },
            correctFeedback: { type: "string", maxLength: 4000 },
            incorrectFeedback: { type: "string", maxLength: 4000 },
            direction: { enum: ["ltr", "rtl", "auto"] },
            segments: {
              type: "array",
              minItems: 2,
              maxItems: 100,
              items: {
                oneOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["text"],
                    properties: { text: { type: "string", minLength: 1, maxLength: 4000 } }
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["blankId"],
                    properties: { blankId: { $ref: "#/$defs/id" } }
                  }
                ]
              }
            },
            blanks: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "answers"],
                properties: {
                  id: { $ref: "#/$defs/id" },
                  answers: {
                    type: "array",
                    minItems: 1,
                    maxItems: 20,
                    uniqueItems: true,
                    items: { type: "string", minLength: 1, maxLength: 500 }
                  }
                }
              }
            },
            distractors: {
              type: "array",
              maxItems: 50,
              uniqueItems: true,
              items: { type: "string", minLength: 1, maxLength: 500 }
            }
          }
        }
      ]
    }
  }
} as const;
