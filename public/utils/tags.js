export const TAGS = {
	"standard-user": { label: "\u2301 Standard User" },
	admin: { label: "\u232c Admin" },
	"power-user": { label: "\u25c6 Power User" },
	root: { label: "# Root" },
	"network-administrator": { label: "\u2318 Network Administrator" },
	doon: { label: "\u{1f480} DOON" },
	peppercon: { label: "\u{1f336}\ufe0fPepperCon" },
	"bad-decision": { label: "\u{1f300} Bad Decision" },
	linecon: { label: "\u{1f6b6} LineCon" },
	"ball-master": { label: "\u{1f3d0} BALL MASTER" },
	toxicbbg: { label: "\u{1f356} Toxic BBQ" },
	drinks: { label: "\u{1f37b}Cheers!" },
	dod: { label: "\u{1f6e1}\ufe0f DoD", title: "Department of Davefence" },
	general: { label: "\u{1f396}\ufe0f General" },
	Timmy: { label: "\u{1f32d} Timmy" },
	redeye: { label: "\u{1f441}\ufe0f Redeye" },
	DT: { label: "Met DT" }
};

function splitTagLabel(label = "") {
	const chars = Array.from(label);
	if (chars.length === 0 || /^[A-Za-z0-9]/.test(chars[0])) {
		return { emoji: "", text: label };
	}

	let emojiLength = 1;
	while (chars[emojiLength] === "\ufe0f") {
		emojiLength += 1;
	}

	return {
		emoji: chars.slice(0, emojiLength).join(""),
		text: chars.slice(emojiLength).join("").trim()
	};
}

export function getTagMetadata(tag) {
	return TAGS[tag] ?? null;
}

export function getRecognizedTags() {
	return Object.entries(TAGS).map(([tag, metadata]) => ({
		tag,
		...metadata
	}));
}

export function getTagLabel(tag) {
	return getTagMetadata(tag)?.label ?? tag;
}

export function getTagEmoji(tag) {
	const metadata = getTagMetadata(tag);
	return metadata ? splitTagLabel(metadata.label).emoji : "";
}

export function getTagTitle(tag) {
	const metadata = getTagMetadata(tag);
	return metadata?.title ?? getTagPlayerLabel(tag, { emoji: false });
}

export function getTagPlayerLabel(tag, options = {}) {
	const metadata = getTagMetadata(tag);
	if (!metadata) {
		return tag;
	}

	if (options.emoji === false) {
		return splitTagLabel(metadata.label).text || metadata.label;
	}
	return metadata.label;
}
