import type { UserConfig } from "@commitlint/types";

const userConfig: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  parserPreset: "conventional-changelog-conventionalcommits",
  formatter: "@commitlint/format",
};

export default userConfig;
