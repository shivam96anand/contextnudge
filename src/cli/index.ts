import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { rememberCommand } from "./commands/remember.js";
import { searchCommand } from "./commands/search.js";
import { listCommand } from "./commands/list.js";
import { forgetCommand } from "./commands/forget.js";
import { statusCommand } from "./commands/status.js";
import { exportCommand } from "./commands/export.js";
import { doctorCommand } from "./commands/doctor.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("contextnudge")
    .description("Local-first personal memory layer for AI coding agents")
    .version("0.1.0");

  program.addCommand(initCommand());
  program.addCommand(rememberCommand());
  program.addCommand(searchCommand());
  program.addCommand(listCommand());
  program.addCommand(forgetCommand());
  program.addCommand(statusCommand());
  program.addCommand(exportCommand());
  program.addCommand(doctorCommand());

  return program;
}
