function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b)));
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function correctAnswer(question) {
  switch (question.type) {
    case "multipleChoice":
      return question.choices.find((choice) => choice.correct)?.id ?? "";
    case "multipleResponse":
      return question.choices.filter((choice) => choice.correct).map((choice) => choice.id);
    case "sequence":
      return question.items.map((item) => item.id);
    case "matching":
      return Object.fromEntries(question.pairs.map((pair) => [pair.id, pair.id]));
    case "categorization":
      return Object.fromEntries(question.items.map((item) => [item.id, item.categoryId]));
    case "wordBank":
      return Object.fromEntries(question.blanks.map((blank) => [blank.id, blank.answers]));
    default:
      return null;
  }
}

export function evaluateQuestion(question, answer) {
  if (question.type === "multipleChoice") {
    return answer === correctAnswer(question);
  }
  if (question.type === "multipleResponse") {
    return sameArray(sorted(Array.isArray(answer) ? answer : []), sorted(correctAnswer(question)));
  }
  if (question.type === "sequence") {
    return sameArray(Array.isArray(answer) ? answer : [], correctAnswer(question));
  }
  if (question.type === "matching" || question.type === "categorization") {
    const expected = correctAnswer(question);
    return Object.keys(expected).every((key) => answer?.[key] === expected[key]);
  }
  if (question.type === "wordBank") {
    const expected = correctAnswer(question);
    return Object.keys(expected).every((key) => {
      const response = String(answer?.[key] ?? "").trim().toLocaleLowerCase();
      return expected[key].some((candidate) => candidate.trim().toLocaleLowerCase() === response);
    });
  }
  return false;
}

export function scoreCourse(course, answers) {
  const maximum = course.questions.reduce((total, question) => total + (question.points ?? 1), 0);
  const awarded = course.questions.reduce(
    (total, question) => total + (evaluateQuestion(question, answers[question.id]) ? (question.points ?? 1) : 0),
    0
  );
  const percentage = maximum === 0 ? 0 : Math.round((awarded / maximum) * 10000) / 100;
  return { awarded, maximum, percentage, passed: percentage >= (course.passingScore ?? 80) };
}

export function interactionType(question) {
  return {
    multipleChoice: "choice",
    multipleResponse: "choice",
    sequence: "sequencing",
    matching: "matching",
    categorization: "matching",
    wordBank: "fill-in"
  }[question.type];
}

export function responsePattern(question, answer) {
  if (Array.isArray(answer)) return answer.join("[,]");
  if (answer && typeof answer === "object") {
    return Object.entries(answer).map(([key, value]) => `${key}[.]${value}`).join("[,]");
  }
  return String(answer ?? "");
}
