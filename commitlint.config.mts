import type { UserConfig } from "@commitlint/types";

const userConfig: UserConfig = {
	extends: ["@commitlint/config-conventional"],
	parserPreset: "conventional-changelog-conventionalcommits",
	formatter: "@commitlint/format",
	// CI lints with opensource-nepal/commitlint, which caps the header at 72.
	rules: { "header-max-length": [2, "always", 72] },
};

export default userConfig;
