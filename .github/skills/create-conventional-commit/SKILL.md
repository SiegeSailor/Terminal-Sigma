---
name: create-conventional-commit
description: "Generates conventional commit messages using a structured XML format. Guides users to create standardized, descriptive commit messages in line with the Conventional Commits specification, including instructions, examples, and validation."
---

# `create-conventional-commit`

Your goal is to generate a conventional commit message using the provided XML structure for the changes.

## When to Use This Skill

- A user asks to create a commit message for the current changes
- You finish the current task and need a fresh start for the next one
- Keywords: `commit`, `commit message`, `commit changes`, `make a commit`

## Workflow

Follow these steps:

1. Run `git status` to review changed files
2. Run `git diff` or `git diff --cached` to inspect changes
3. Stage the changes that are relevant to a single commit with `git add <file>`
4. Construct your commit message using the XML structure provided below
5. After generating the commit message, Copilot will automatically run the `git commit` command in your integrated terminal with the generated message (no confirmation needed):

```bash
git commit -m "type(scope): description"
```

## Commit Message Structure

```xml
<commit-message>
	<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert</type>
	<scope>()</scope>
	<description>A short, imperative summary of the change</description>
	<body>(optional: more detailed explanation)</body>
	<footer>(optional: e.g. BREAKING CHANGE: details, or issue references)</footer>
</commit-message>
```

## Examples

```xml
<examples>
	<example>feat(parser): add ability to parse arrays</example>
	<example>fix(ui): correct button alignment</example>
	<example>docs: update README.md with usage instructions</example>
	<example>refactor: improve performance of data processing</example>
	<example>chore: update dependencies</example>
	<example>feat!: send email on registration (BREAKING CHANGE: email service required)</example>
</examples>
```

## Validation

```xml
<validation>
	<type>Must be one of the allowed types. See <reference>https://www.conventionalcommits.org/en/v1.0.0/#specification</reference></type>
	<scope>Optional, but recommended for clarity.</scope>
	<description>Required. Use the imperative mood (e.g., "add", not "added").</description>
	<body>Optional. Use for additional context.</body>
	<footer>Use for breaking changes or issue references.</footer>
</validation>
```

## Final Step

```xml
<final-step>
	<cmd>git commit -m "type(scope): description"</cmd>
	<note>Replace with your constructed message. Include body and footer if needed.</note>
</final-step>
```
