import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import Index from "../commands/index.js";

test("renders the dashboard shell", (t) => {
	const { lastFrame, unmount } = render(<Index options={{ name: "Nova" }} />);
	const frame = lastFrame() ?? "";

	t.true(frame.includes("TERMINAL SIGMA"));
	t.true(frame.includes("STATUS BOARD"));
	t.true(frame.includes("NAVIGATION MENU"));
	t.true(frame.includes("Nova"));

	unmount();
});
