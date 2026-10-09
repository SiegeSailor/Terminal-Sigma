import test from "ava";
import { windowOf } from "../components/choice.js";
import { layoutOf } from "../content.js";

test("keeps the menu and adds panels as the terminal grows", (t) => {
	t.like(layoutOf(160, 22), {
		showCharacter: true,
		showToday: true,
		todayBeside: true,
		isMenuSplit: true,
		isTodayCompact: true,
	});
	t.like(layoutOf(160, 27), { isTodayCompact: true });
	t.like(layoutOf(160, 28), { isTodayCompact: false });
	t.like(layoutOf(160, 40), { isTodayCompact: false, showRecent: true });
	// The group headings give way to Recent on a short terminal.
	t.like(layoutOf(100, 27), { isMenuGrouped: true, showRecent: true });
	t.like(layoutOf(100, 26), { isMenuGrouped: false });
	t.like(layoutOf(100, 24), { isMenuGrouped: false, showRecent: true });
	t.like(layoutOf(120, 32), { todayBeside: true, isMenuSplit: false });
	t.like(layoutOf(138, 32), { todayBeside: true, isMenuSplit: true });
	t.like(layoutOf(100, 24), {
		showCharacter: true,
		showToday: false,
		isMenuSplit: true,
		panelWidth: 64,
	});
	t.like(layoutOf(100, 50), { showToday: true, todayBeside: false });
	t.like(layoutOf(100, 49), { showToday: false });
	t.like(layoutOf(84, 24), { isMenuSplit: false });
	t.like(layoutOf(56, 24), {
		showCharacter: false,
		stacked: true,
		isMenuSplit: false,
	});
	t.like(layoutOf(64, 72), {
		isMenuSplit: true,
		showCharacter: true,
		showToday: true,
	});
});

test("shows a window of a long list around the cursor", (t) => {
	t.deepEqual(windowOf(0, 20), { start: 0, end: 20 });
	t.deepEqual(windowOf(0, 20, 5), { start: 0, end: 5 });
	t.deepEqual(windowOf(10, 20, 5), { start: 8, end: 13 });
	t.deepEqual(windowOf(19, 20, 5), { start: 15, end: 20 });
	t.deepEqual(windowOf(2, 3, 5), { start: 0, end: 3 });
});
