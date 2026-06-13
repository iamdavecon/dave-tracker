export const PLACE_CHALLENGE_COOLDOWN = 60 * 60 * 1000;
export const HACKER_JEOPARDY_COOLDOWN = 10 * 60 * 1000;
export const HACKER_JEOPARDY_BABY_COOLDOWN = 60 * 60 * 1000;
export const HACKER_JEOPARDY_BABY_COOLDOWN_KEY = "lastHackerJeopardyBabyTime";

export const HACKER_JEOPARDY_QUESTIONS = [
	{
		id: "viscosity",
		clue: "This physical property becomes critically important during high velocity drinking situations.",
		options: ["What is viscosity?", "What is angular momentum?", "What is South America?", "What is packet loss?"],
		answer: "What is viscosity?",
		aliases: ["What is viscosity?"],
		reward: { type: "item", item: "🍺", label: "a drink" }
	},
	{
		id: "south-america",
		clue: "This continent is home to DEF CON-adjacent levels of rainforest humidity and the Andes.",
		options: ["What is South America?", "What is Antarctica?", "What is Las Vegas?", "What is root?"],
		answer: "What is South America"
	},
	{
		id: "malort",
		clue: "This Chicago beverage tastes like a dare that filed paperwork.",
		options: ["What is Malort", "What is Koval Cranberry Gin Liqueur?", "What is a mojito?", "What is raki?"],
		answer: "What is Malort?",
		reward: { type: "item", item: "🍺", label: "a drink" }
	},
	{
		id: "beef-thief",
		clue: "This shadowy figure absconds with brisket, steak, and other conference-adjacent proteins.",
		options: ["Who is beef thief", "Who is DavePrime?", "What is a packet sniffer?", "Who is brisket bandit?"],
		answer: "Who is beef thief?",
		reward: { type: "item", item: "🌭", label: "a hot dog" }
	},
	{
		id: "rubber-duck",
		clue: "This debugging method involves explaining your code to an inanimate coworker.",
		options: ["What is rubber duck debugging?", "What is blue teaming?", "What is yak shaving?", "What is soldering?"],
		answer: "What is rubber duck debugging?"
	},
	{
		id: "three-way-handshake",
		clue: "TCP begins a connection with this SYN, SYN-ACK, ACK ritual.",
		options: ["What is a three-way handshake?", "What is ARP poisoning?", "What is DNSSEC?", "What is a stack trace?"],
		answer: "What is a three-way handshake?"
	},
	{
		id: "port-53",
		clue: "This port is traditionally associated with DNS.",
		options: ["What is 53?", "What is 22?", "What is 443?", "What is 31337?"],
		answer: "What is 53?"
	},
	{
		id: "magic-smoke",
		clue: "When this leaves the hardware, the hardware often stops working.",
		options: ["What is magic smoke?", "What is firmware?", "What is entropy?", "What is coffee?"],
		answer: "What is magic smoke?"
	},
	{
		id: "sudo",
		clue: "This command asks politely, with authority, to run something as another user.",
		options: ["What is sudo?", "What is ping?", "What is curl?", "What is vim?"],
		answer: "What is sudo?"
	},
	{
		id: "acdc-beef-xor",
		clue: "0xACDC XOR 0xBEEF",
		options: ["0x1233", "0x1213", "0xCAFE", "0xBEEF"],
		answer: "0x1233"
	},
	{
		id: "layer-eight",
		clue: "This unofficial OSI layer is where user problems traditionally live.",
		options: ["What is layer 8?", "What is layer 2?", "What is layer 4?", "What is South America"],
		answer: "What is layer 8?"
	}
];

export const PLACE_CHALLENGES = [
	{
		emoji: "🙅",
		action: "hackerJeopardy",
		label: "Hacker Jeopardy",
		cooldownKey: "lastHackerJeopardyTime",
		cooldown: HACKER_JEOPARDY_COOLDOWN,
		reward: { type: "fragment", label: "a fragment" },
		questions: HACKER_JEOPARDY_QUESTIONS
	},
	{
		emoji: "⚙️",
		action: "hardwareHacking",
		label: "Hardware Hacking",
		cooldownKey: "lastHardwareHackingTime",
		reward: { type: "fragment" },
		questions: [
			{
				id: "multimeter",
				clue: "This tool measures voltage, current, and resistance.",
				options: ["multimeter", "oscilloscope", "logic analyzer", "solder wick"],
				answer: "multimeter",
				aliases: ["multi meter"]
			}
		]
	},
	{
		emoji: "🎖️",
		action: "vetcon",
		label: "VetCon",
		cooldownKey: "lastVetconTime",
		reward: { type: "fragment" },
		questions: [
			{
				id: "1900",
				clue: "In 24-hour time, 1900 is this in 12-hour time.",
				options: ["7pm", "5pm", "9pm", "7am"],
				answer: "7pm",
				aliases: ["7 pm", "7:00pm", "7:00 pm"]
			}
		]
	}
];

function stripVariationSelectors(value) {
	return value?.replace(/\uFE0F/g, "");
}

export function normalizePlaceChallengeAnswer(answer) {
	return String(answer ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getPlaceFragmentChallengeForEmoji(emoji) {
	const normalizedEmoji = stripVariationSelectors(emoji);
	return PLACE_CHALLENGES.find((challenge) =>
		stripVariationSelectors(challenge.emoji) === normalizedEmoji
	);
}

export function getPlaceFragmentChallengeForAction(action) {
	return PLACE_CHALLENGES.find((challenge) => challenge.action === action);
}

export function getPlaceFragmentChallengeForPlaceName(name = "") {
	const emoji = [...String(name)].find(char => /\p{Extended_Pictographic}/u.test(char));
	const emojiChallenge = emoji ? getPlaceFragmentChallengeForEmoji(emoji) : null;
	if (emojiChallenge) {
		return emojiChallenge;
	}
	if (/\bHHV\b|hardware\s+hacking/i.test(String(name))) {
		return getPlaceFragmentChallengeForAction("hardwareHacking");
	}
	return null;
}

export function getPlaceChallengeQuestion(action, questionId) {
	const challenge = getPlaceFragmentChallengeForAction(action);
	return challenge?.questions.find((question) => question.id === questionId) ?? null;
}

export function getRandomPlaceChallengeQuestion(challenge) {
	const questions = challenge?.questions ?? [];
	if (questions.length === 0) {
		return null;
	}

	return questions[Math.floor(Math.random() * questions.length)];
}

export function shufflePlaceChallengeOptions(question) {
	const options = [...(question?.options ?? [])];
	for (let index = options.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[options[index], options[swapIndex]] = [options[swapIndex], options[index]];
	}
	return options;
}

export function formatPlaceChallengePrompt(challenge, question, options = question.options) {
	return [
		`${challenge.label}: ${question.clue}`,
		"",
		...options.map((option, index) => `${index + 1}. ${option}`),
		"",
		"Enter the number or exact response."
	].join("\n");
}

export function isCorrectPlaceFragmentAnswer(action, answer, questionId = null) {
	const challenge = getPlaceFragmentChallengeForAction(action);
	if (!challenge) {
		return false;
	}

	const questions = questionId
		? challenge.questions.filter((question) => question.id === questionId)
		: challenge.questions;
	const normalizedAnswer = normalizePlaceChallengeAnswer(answer);

	return questions.some((question) => {
		const selectedIndex = Number.parseInt(normalizedAnswer, 10) - 1;
		const selectedOption = Number.isInteger(selectedIndex) ? question.options[selectedIndex] : null;
		const acceptableAnswers = [question.answer, ...(question.aliases ?? [])]
			.map(normalizePlaceChallengeAnswer);

		return acceptableAnswers.includes(normalizedAnswer)
			|| normalizePlaceChallengeAnswer(selectedOption) === normalizePlaceChallengeAnswer(question.answer)
			|| question.options.some((option) =>
				normalizePlaceChallengeAnswer(option) === normalizedAnswer
					&& normalizePlaceChallengeAnswer(option) === normalizePlaceChallengeAnswer(question.answer)
			);
	});
}

export function getPlaceFragmentChallengeCooldownRemaining(dave, challenge) {
	if (!challenge || !Number.isFinite(dave?.[challenge.cooldownKey])) {
		return 0;
	}

	return Math.max(0, dave[challenge.cooldownKey] + (challenge.cooldown ?? PLACE_CHALLENGE_COOLDOWN) - Date.now());
}

export function canAttemptPlaceFragmentChallenge(dave, challenge) {
	return getPlaceFragmentChallengeCooldownRemaining(dave, challenge) === 0;
}

export function getHackerJeopardyBabyCooldownRemaining(dave) {
	if (!Number.isFinite(dave?.[HACKER_JEOPARDY_BABY_COOLDOWN_KEY])) {
		return 0;
	}

	return Math.max(0, dave[HACKER_JEOPARDY_BABY_COOLDOWN_KEY] + HACKER_JEOPARDY_BABY_COOLDOWN - Date.now());
}

export function canReceiveHackerJeopardyBaby(dave) {
	return getHackerJeopardyBabyCooldownRemaining(dave) === 0;
}
