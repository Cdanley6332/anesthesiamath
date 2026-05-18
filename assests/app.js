const CATEGORY_LABELS = {
  dilution: "Diluting Anesthesia Specific Medications",
  localAnesthetic: "Local Anesthetic Dosing",
  mixingDrips: "Mixing Drips",
  randomMath: "Random Anesthesia Math Questions",
};

const CATEGORY_FILES = {
  dilution: "/questions/dilution.json",
  localAnesthetic: "/questions/localAnesthetic.json",
  mixingDrips: "/questions/mixingDrips.json",
  randomMath: "/questions/randomMath.json",
};

const state = {
  currentCategory: null,
  questionBankByCategory: new Map(),  // category -> questions[]
  remainingIdsByCategory: new Map(),  // category -> shuffled ids[]
  currentQuestion: null,
};

// ---------- helpers ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Allows "210", "210 mg", "24 mL" etc.
// Numeric answers compared with tolerance.
function answersMatch(userInput, correctAnswer) {
  const normalize = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\b(mg|ml|mcg|gtt\/min|gtt|min|units|unit)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const u = normalize(userInput);
  const c = normalize(correctAnswer);

  const uNum = Number(u);
  const cNum = Number(c);

  const uIsNum = u !== "" && !Number.isNaN(uNum);
  const cIsNum = c !== "" && !Number.isNaN(cNum);

  if (uIsNum && cIsNum) {
    const tol = 0.01;
    return Math.abs(uNum - cNum) <= tol;
  }
  return u === c;
}

async function loadCategoryQuestions(category) {
  if (state.questionBankByCategory.has(category)) return;

  const url = CATEGORY_FILES[category];
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}`);

  const questions = await res.json();

  // Normalize: attach category + guarantee id
  const normalized = questions.map((q, idx) => ({
    id: q.id ?? `${category}-${idx}`,
    category,
    questionText: q.questionText,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? "",
  }));

  state.questionBankByCategory.set(category, normalized);
  resetRemaining(category);
}

function resetRemaining(category) {
  const bank = state.questionBankByCategory.get(category) || [];
  const ids = bank.map(q => q.id);
  state.remainingIdsByCategory.set(category, shuffle([...ids]));
}

function getNextQuestion(category) {
  const bank = state.questionBankByCategory.get(category);
  if (!bank || bank.length === 0) return null;

  let remaining = state.remainingIdsByCategory.get(category);
  if (!remaining) {
    resetRemaining(category);
    remaining = state.remainingIdsByCategory.get(category);
  }

  // no repeats until exhausted; then DONE screen (you can restart)
  if (remaining.length === 0) return null;

  const nextId = remaining.pop();
  return bank.find(q => q.id === nextId) || null;
}

// ---------- UI wiring ----------
const homeView = document.getElementById("homeView");
const questionView = document.getElementById("questionView");
const navTitle = document.getElementById("navTitle");
const backBtn = document.getElementById("backBtn");

const questionTextEl = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");

const resultBlock = document.getElementById("resultBlock");
const resultPill = document.getElementById("resultPill");
const correctLine = document.getElementById("correctLine");
const explanationText = document.getElementById("explanationText");
const nextBtn = document.getElementById("nextBtn");

const doneBlock = document.getElementById("doneBlock");
const restartBtn = document.getElementById("restartBtn");

function showHome() {
  state.currentCategory = null;
  state.currentQuestion = null;

  navTitle.textContent = "Anesthesia Math";
  backBtn.style.display = "none";

  homeView.classList.remove("hidden");
  questionView.classList.add("hidden");
}

async function showCategory(category) {
  state.currentCategory = category;

  navTitle.textContent = CATEGORY_LABELS[category] || "Questions";
  backBtn.style.display = "inline-block";

  homeView.classList.add("hidden");
  questionView.classList.remove("hidden");

  try {
    await loadCategoryQuestions(category);
  } catch (e) {
    questionTextEl.textContent = "Could not load questions. Check your /questions JSON files.";
    console.error(e);
    return;
  }

  state.currentQuestion = getNextQuestion(category);
  renderQuestion();
}

function renderQuestion() {
  resultBlock.classList.add("hidden");
  doneBlock.classList.add("hidden");

  answerInput.value = "";
  answerInput.disabled = false;
  submitBtn.disabled = false;

  const q = state.currentQuestion;
  if (!q) {
    doneBlock.classList.remove("hidden");
    questionTextEl.textContent = "";
    return;
  }

  questionTextEl.textContent = q.questionText;
  setTimeout(() => answerInput.focus(), 50);
}

function submitAnswer() {
  const q = state.currentQuestion;
  if (!q) return;

  const user = answerInput.value;
  const correct = answersMatch(user, q.correctAnswer);

  resultPill.className = "pill " + (correct ? "ok" : "bad");
  resultPill.textContent = correct ? "Correct!" : "Incorrect!";

  correctLine.textContent = `Correct answer: ${q.correctAnswer}`;

  explanationText.textContent = q.explanation || "(No explanation provided.)";
  resultBlock.classList.remove("hidden");

  answerInput.disabled = true;
  submitBtn.disabled = true;
}

function nextQuestion() {
  if (!state.currentCategory) return;
  state.currentQuestion = getNextQuestion(state.currentCategory);
  renderQuestion();
}

function restartCategory() {
  if (!state.currentCategory) return;
  resetRemaining(state.currentCategory);
  state.currentQuestion = getNextQuestion(state.currentCategory);
  renderQuestion();
}

// Category click handlers
document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const cat = btn.getAttribute("data-category");
    await showCategory(cat);
  });
});

backBtn.addEventListener("click", showHome);
submitBtn.addEventListener("click", submitAnswer);
nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", restartCategory);

// Submit on Enter
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !submitBtn.disabled) submitAnswer();
});

showHome();
