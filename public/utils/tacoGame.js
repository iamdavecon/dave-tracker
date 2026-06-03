export const TACO_ITEM = "🌮";
export const TACO_GAME_ACTION = "tacoCalibration";
export const TACO_GAME_COOLDOWN = 5 * 60 * 1000;
export const TACO_GAME_REWARD_COUNT = 2;

const tacoQuestions = [
	{
		id: "shell-integrity",
		prompt: "Taco shell integrity is failing. What goes in first?",
		options: ["Meat or beans", "Salsa", "Sour cream", "Shredded lettuce"],
		answer: "Meat or beans"
	},
	{
		id: "salsa-routing",
		prompt: "The taco is too dry. Which packet restores signal?",
		options: ["Salsa verde", "Napkin", "Receipt", "Plastic fork"],
		answer: "Salsa verde"
	},
	{
		id: "double-stack",
		prompt: "A taco has cracked in the field. What is the Dave-approved patch?",
		options: ["Second tortilla", "More air", "A hotdog bun", "Pocket storage"],
		answer: "Second tortilla"
	},
	{
		id: "final-check",
		prompt: "Before deployment, the taco must be pointed toward:",
		options: ["Your mouth", "The floor", "A random Dave", "The nearest printer"],
		answer: "Your mouth"
	}
];

export function getTacoGameQuestions() {
	return tacoQuestions;
}

export function getTacoGameQuestion(questionId) {
	return tacoQuestions.find(question => question.id === questionId);
}

export function getRandomTacoGameQuestion() {
	return tacoQuestions[Math.floor(Math.random() * tacoQuestions.length)];
}

export function shuffleTacoGameOptions(question) {
	const options = [...(question?.options ?? [])];
	for (let i = options.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[options[i], options[j]] = [options[j], options[i]];
	}
	return options;
}

export function formatTacoGamePrompt(question, options = question?.options ?? []) {
	const choices = options
		.map((option, index) => `${index + 1}. ${option}`)
		.join("\n");

	return `Taco Calibration\n\n${question.prompt}\n\n${choices}\n\nEnter the number or answer:`;
}

export function isCorrectTacoGameAnswer(questionId, answer) {
	const question = getTacoGameQuestion(questionId);
	const normalizedAnswer = String(answer ?? "").trim().toLowerCase();
	const selectedIndex = Number.parseInt(normalizedAnswer, 10) - 1;

	if (!question) {
		return false;
	}

	if (Number.isInteger(selectedIndex) && question.options[selectedIndex]) {
		return question.options[selectedIndex] === question.answer;
	}

	return normalizedAnswer === question.answer.toLowerCase();
}

export function getTacoGameCooldownRemaining(dave) {
	if (!Number.isFinite(dave?.lastTacoCalibrationTime)) {
		return 0;
	}

	return Math.max(0, dave.lastTacoCalibrationTime + TACO_GAME_COOLDOWN - Date.now());
}

export function canAttemptTacoGame(dave) {
	return getTacoGameCooldownRemaining(dave) === 0;
}
