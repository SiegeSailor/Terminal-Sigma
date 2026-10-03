const config = {
	files: ["source/tests/**/*.test.ts", "source/tests/**/*.test.tsx"],
	typescript: {
		compile: "tsc",
		extensions: ["ts", "tsx"],
		rewritePaths: {
			"source/": "build/",
		},
	},
};

export default config;
