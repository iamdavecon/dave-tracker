import { getAmt } from "./state.js";

const FIRST_EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/u;

const validItems = [
	{
		item: "🌮",
		getLabel: "Get a Taco",
		label: "🌮 Tacos",
	},
	{
		item: "🌭",
		getLabel: "Get a hotdog",
		label: "🌭 Hotdogs",
		sourceLabels: {
			"🌭": "Get some $2 Hotdogs",
		},
		sourceCounts: {
			"🌭": 2,
		},
	},
	{
		item: "🍸",
		getLabel: "Get a drink",
		label: "🍸 Drinks",
		sources: ["🍖", "🌭"],
		sourceLabels: {
			"🌭": "Get some $2 Beers",
		},
		sourceCounts: {
			"🌭": 2,
		},
	},
	{
		item: "🌶️",
		getLabel: "Get a pepper",
		label: "🌶️ Peppers",
		sources: ["🍖"],
	},
];

export function getValidItems() {
	return validItems;
}

export function getItemDefinition(item) {
	return validItems.find(i => i.item === item) ?? null;
}

export function getFirstEmoji(value = "") {
	return String(value).match(FIRST_EMOJI_RE)?.[0] ?? "";
}

export function getFirstItemDefinition(value = "") {
	const firstEmoji = getFirstEmoji(value);
	return firstEmoji ? getItemDefinition(firstEmoji) : null;
}

export function getItemsForSource(source) {
	return validItems
		.filter(i => i.item === source || i.sources?.includes(source))
		.map(i => ({
			...i,
			getLabel: i.sourceLabels?.[source] ?? i.getLabel,
			rewardCount: i.sourceCounts?.[source] ?? 1,
		}));
}

export function displayItems(dave, filter, options = {}) {
	const itemsToShow = filter
		? getItemsForSource(filter)
		: validItems;
	const linkUserId = options.userId ?? dave?.userId;
	const viewerId = options.viewerId;

	let html = "";
	itemsToShow.forEach(i => {
		const amt = getAmt(dave, i.item);
		if (amt > 0 && linkUserId) {
			const href = `/item.html?id=${encodeURIComponent(linkUserId)}${viewerId ? `&viewerId=${encodeURIComponent(viewerId)}` : ""}&item=${encodeURIComponent(i.item)}`;
			html += `
			<a class="field item-row" href="${href}">
				<span class="label">${i.label}</span>
				<span>${amt}</span>
			</a>
		`;
			return;
		}

		html += `
			<div class="field">
				<span class="label">${i.label}</span>
				<span>${amt}</span>
			</div>
		`;
	});
	return html;
}
