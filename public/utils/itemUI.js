import { getAmt } from "./state.js";

const validItems = [
	{
		item: "🌮",
		getLabel: "Get a Taco",
		label: "🌮 Tacos",
	},
	{
		item: "🌭",
		getLabel: "Get a $2 Hotdog",
		label: "🌭 Hotdogs",
	},
	{
		item: "🍸",
		getLabel: "Get a drink",
		label: "🍸 Drinks",
		sources: ["🍖", "🌭"],
		sourceLabels: {
			"🌭": "Get a $2 Beer",
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

export function getItemsForSource(source) {
	return validItems
		.filter(i => i.item === source || i.sources?.includes(source))
		.map(i => ({
			...i,
			getLabel: i.sourceLabels?.[source] ?? i.getLabel,
		}));
}

export function displayItems(dave, filter) {
	const itemsToShow = filter
		? getItemsForSource(filter)
		: validItems;

	let html = "";
	itemsToShow.forEach(i => {
		const amt = getAmt(dave, i.item) 
		html += `
			<div class="field">
				<span class="label">${i.label}</span>
				<span>${amt}</span>
			</div>
		`
	});
	return html;
}
