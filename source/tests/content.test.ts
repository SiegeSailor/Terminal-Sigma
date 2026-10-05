import test from "ava";
import { layoutOf } from "../content.js";

test("keeps the menu and adds panels as the terminal grows", (t) => {
	t.like(layoutOf(160, 22), {
		showCharacter: true,
		showToday: true,
		todayBeside: true,
		isMenuSplit: true,
		isTodayCompact: true,
	});
	t.like(layoutOf(160, 40), { isTodayCompact: false, showRecent: true });
	t.like(layoutOf(120, 32), { todayBeside: true, isMenuSplit: false });
	t.like(layoutOf(136, 32), { todayBeside: true, isMenuSplit: true });
	t.like(layoutOf(100, 24), {
		showCharacter: true,
		showToday: false,
		isMenuSplit: true,
		panelWidth: 64,
	});
	t.like(layoutOf(100, 44), { showToday: true, todayBeside: false });
	t.like(layoutOf(84, 24), { isMenuSplit: false });
	t.like(layoutOf(56, 24), {
		showCharacter: false,
		stacked: true,
		isMenuSplit: false,
	});
	t.like(layoutOf(64, 70), {
		isMenuSplit: true,
		showCharacter: true,
		showToday: true,
	});
});
