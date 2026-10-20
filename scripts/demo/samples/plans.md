# Example plan

**Plan** · 2026-10-20 · Status: Draft · **Owner:** project-a team

## In short

This example plan shows how the reading layout draws a plan: a badge on each task, a number and an owner on each step, and an outline of a long plan. It is made up for the demo, and every name in it is a stand-in.

## 1. Before you start

Each task is a heading that opens with its number. Each step is a checkbox whose bold title opens with the step's number, and a step that names you as its owner is tinted. A plan of twenty steps or more can be read as an outline: press the Outline button, or `o`.

## 2. Tasks

### Task 1: Set up the project

Who: you.

- [ ] **Step 1: Make the folder** with a readme in it.
- [ ] **Step 2 (you): Pick a name** for the tool, short enough to type.
- [x] **Step 3: Write the first config** as `config.json`.
- [ ] **Step 4: Add a licence file** before anything else lands.
- [ ] **Step 5: Commit the skeleton** on a branch of its own.

### Task 2: Write the parser

Who: the build team.

- [ ] **Step 1: Read the input**

  The input is one file. A second paragraph in a step keeps to the step's indent.

- [ ] **Step 2: Split it into tokens**

  ```typescript
  const tokens = source.split(/\s+/);
  ```

- [ ] **Step 3 (you): Check the token list**

- [ ] **Step 4: Build the tree**

- [ ] **Step 5: Report errors with their line numbers**

The parts it builds:

| Part | Owner | Status |
|---|---|---|
| Lexer | the build team | Agreed |
| Parser | the build team | Pending |

### Task 3: Test it

- [ ] **Step 1: Write one test per rule**
- [ ] **Step 2: Run them on every change**
- [ ] **Step 3 (a reviewer): Read the failures**
- [ ] **Step 4: Fix what they find**
- [ ] **Step 5: Run them again**

### Task 4. Ship it

Who: you and the release team.

- [ ] **Step 1: Tag the release**
- [ ] **Step 2: Write the notes**
- [ ] **Step 3 (you): Announce it**
- [ ] **Step 4: Watch for the first reports**
- [ ] **Step 5: Close the plan**

## Where things stand

### Agreed

- The four tasks, in that order.

### Waiting on you

- Task 1, step 2: the tool's name.
- Task 4, step 3: the announcement.
