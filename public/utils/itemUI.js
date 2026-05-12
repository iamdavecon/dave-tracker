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
		emoji: "🍸",
		getLabel: "Get a drink",
		label: "🍸 Drinks",
	},
];

export function getValidItems() {
	return validItems;
}

export function displayItems(dave, filter) {
	const itemsToShow = filter
		? validItems.filter(i => filter.includes(i.item))
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

