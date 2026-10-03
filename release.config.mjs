const config = {
	branches: ["main"],
	plugins: [
		["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
		[
			"@semantic-release/release-notes-generator",
			{ preset: "conventionalcommits" },
		],
		"@semantic-release/npm",
		[
			"@semantic-release/git",
			{
				assets: ["package.json", "package-lock.json"],
				// eslint-disable-next-line no-template-curly-in-string
				message: "chore(release): ${nextRelease.version} [skip ci]",
			},
		],
		[
			"@semantic-release/github",
			{
				successComment: false,
				failComment: false,
				failTitle: false,
				releasedLabels: false,
			},
		],
	],
};

export default config;
