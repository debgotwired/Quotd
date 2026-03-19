#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { configCommand } from "./commands/config.js";
import { interviewsListCommand } from "./commands/interviews/list.js";
import { interviewsCreateCommand } from "./commands/interviews/create.js";
import { interviewsGetCommand } from "./commands/interviews/get.js";
import { interviewsExportCommand } from "./commands/interviews/export.js";
import { draftGetCommand } from "./commands/draft/get.js";
import { formatsGenerateCommand } from "./commands/formats/generate.js";
import { formatsListCommand } from "./commands/formats/list.js";
import { teamsListCommand } from "./commands/teams/list.js";
import { webhooksListCommand } from "./commands/webhooks/list.js";
import { webhooksCreateCommand } from "./commands/webhooks/create.js";
import { webhooksDeleteCommand } from "./commands/webhooks/delete.js";

const program = new Command();

program
  .name("quotd")
  .description("Quotd CLI - AI voice interviews to case studies")
  .version("0.1.0");

// Auth
program.addCommand(loginCommand);
program.addCommand(configCommand);

// Interviews
const interviews = new Command("interviews").description("Manage interviews");
interviews.addCommand(interviewsListCommand);
interviews.addCommand(interviewsCreateCommand);
interviews.addCommand(interviewsGetCommand);
interviews.addCommand(interviewsExportCommand);
program.addCommand(interviews);

// Draft
const draft = new Command("draft").description("Manage drafts");
draft.addCommand(draftGetCommand);
program.addCommand(draft);

// Formats
const formats = new Command("formats").description("Manage generated formats");
formats.addCommand(formatsGenerateCommand);
formats.addCommand(formatsListCommand);
program.addCommand(formats);

// Teams
const teams = new Command("teams").description("Manage teams");
teams.addCommand(teamsListCommand);
program.addCommand(teams);

// Webhooks
const webhooks = new Command("webhooks").description("Manage webhooks");
webhooks.addCommand(webhooksListCommand);
webhooks.addCommand(webhooksCreateCommand);
webhooks.addCommand(webhooksDeleteCommand);
program.addCommand(webhooks);

program.parse(process.argv);
