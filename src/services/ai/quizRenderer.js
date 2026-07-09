const CHOICE_LETTERS = ["A", "B", "C", "D"];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Renders a validated quiz payload into Markdown, shuffling answer order
// ourselves (rather than asking the model to) so "shuffled" is guaranteed,
// not just requested. Builds an array of blocks and joins once at the end
// instead of repeated += concatenation.
export function formatQuizAsMarkdown(payload) {
  const answerKey = [];

  const questionBlocks = payload.questions.map((q, i) => {
    const order = shuffle([0, 1, 2, 3]);
    const shuffledChoices = order.map((originalIdx) => q.choices[originalIdx]);
    const correctLetter = CHOICE_LETTERS[order.indexOf(q.correctIndex)];
    answerKey.push(`${i + 1}. ${correctLetter}`);

    const choiceLines = shuffledChoices
      .map((choice, idx) => `${CHOICE_LETTERS[idx]}. ${choice}`)
      .join("\n");

    return `**${i + 1}. ${q.question}**\n\n${choiceLines}`;
  });

  return `${questionBlocks.join("\n\n")}\n\n## Answer Key\n\n${answerKey.join("\n")}\n`;
}