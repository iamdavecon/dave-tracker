const DEBUG_USER_IDS = Object.freeze([
	"59a388e8-413a-4d8e-906e-15469bb3b471",
	"629603fc-58fa-49c9-ba98-cfc391b82569",
	"bd3d5224-f42c-4e58-8188-0dfac714fc75",
	"60eb9ea6-b3ab-4411-8c91-25ec23adb84c",
	"a7b35cb9-8b75-4e66-a5a4-559722ec8442"
]);

const DEBUG_USER_ID_SET = new Set(DEBUG_USER_IDS);

export function isDebugId(id) {
	return DEBUG_USER_ID_SET.has(id);
}

