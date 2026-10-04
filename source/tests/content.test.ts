import test from "ava";
import { layoutOf } from "../content.js";

test("keeps the input panel and adds panels as the terminal grows", (t) => {
	t.like(layoutOf(160, 24), {
		showCharacter: true,
		showToday: true,
		todayBeside: true,
		menuColumns: 2,
	});
	t.like(layoutOf(100, 24), {
		showCharacter: true,
		showToday: false,
		panelWidth: 74,
	});
	t.like(layoutOf(100, 40), { showToday: true, todayBeside: false });
	t.like(layoutOf(60, 24), {
		showCharacter: false,
		showToday: false,
		stacked: true,
		panelWidth: 60,
		menuColumns: 2,
	});
	t.like(layoutOf(40, 60), { showCharacter: true, menuColumns: 1 });
});
