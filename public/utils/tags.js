export const TAGS = {
	"standard-user": { emoji: "\u2301", label: "Standard User" },
	admin: { emoji: "\u232c", label: "Admin" },
	"power-user": { emoji: "\u25c6", label: "Power User" },
	root: { emoji: "#", label: "Root" },
	"network-administrator": { emoji: "\u2318", label: "Network Administrator" },
	doon: { emoji: "\u{1f480}", label: "DOON" },
	peppercon: { emoji: "\u{1f336}\ufe0f", label: "PepperCon", playerLabel: "\u{1f336}\ufe0fPepperCon" },
	"bad-decision": { emoji: "\u{1f300}", label: "Bad Decision" },
	linecon: { emoji: "\u{1f6b6}", label: "LineCon" },
	toxicbbg: { emoji: "\u{1f356}", label: "Toxic BBQ" },
	drinks: { emoji: "\u{1f37b}", label: "Cheers", playerLabel: "\u{1f37b}Cheers!" },
	dod: { emoji: "\u{1f6e1}\ufe0f", label: "DoD", title: "Department of Davefence" },
	general: { emoji: "\u{1f396}\ufe0f", label: "General" },
	Timmy: { emoji: "\u{1f32d}", label: "Timmy" }
};

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

export function getTagTitle(tag) {
	const metadata = getTagMetadata(tag);
	return metadata?.title ?? metadata?.label ?? tag;
}

export function getTagPlayerLabel(tag) {
	const metadata = getTagMetadata(tag);
	if (!metadata) {
		return tag;
	}

	return metadata.playerLabel ?? `${metadata.emoji} ${metadata.label}`;
}
