#!/usr/bin/env node

/**
 * J33T Intel CLI
 * On-Chain Intelligence Platform for Solana Meme Tokens
 *
 * Usage:
 *   j33t backtest <token-ca>   Backtest a successful token
 *   j33t rugcheck <token-ca>   Analyze a rugpull pattern
 *   j33t scan <token-ca>       Live scan a token
 *   j33t config                Show/edit configuration
 */

import { Command } from "commander";
import { VERSION } from "@j33t-intel/shared";
import { loadConfig } from "./config/loader.js";
import { backtestCommand } from "./commands/backtest.js";
import { rugcheckCommand } from "./commands/rugcheck.js";
import { scanCommand } from "./commands/scan.js";
import { configCommand } from "./commands/config.js";

const program = new Command();

program
  .name("j33t")
  .description("J33T Intel — On-Chain Intelligence for Solana Meme Tokens 🐾")
  .version(VERSION);

program
  .command("backtest <token-ca>")
  .description("Backtest a successful token — find optimal filter settings")
  .option("-o, --output <path>", "Output JSON file path")
  .option("--contribute", "Submit results to community database")
  .option("-v, --verbose", "Verbose output")
  .action(async (tokenCA: string, options) => {
    const config = await loadConfig(options);
    await backtestCommand(tokenCA, config, options);
  });

program
  .command("rugcheck <token-ca>")
  .description("Analyze a known rugpull — extract negative patterns")
  .option("-o, --output <path>", "Output JSON file path")
  .option("--contribute", "Submit results to community database")
  .option("-v, --verbose", "Verbose output")
  .action(async (tokenCA: string, options) => {
    const config = await loadConfig(options);
    await rugcheckCommand(tokenCA, config, options);
  });

program
  .command("scan <token-ca>")
  .description("Live scan a token — get potential & risk scores")
  .option("-o, --output <path>", "Output JSON file path")
  .option("-v, --verbose", "Verbose output")
  .action(async (tokenCA: string, options) => {
    const config = await loadConfig(options);
    await scanCommand(tokenCA, config, options);
  });

program
  .command("config")
  .description("Show current configuration")
  .option("--init", "Create a new .env configuration file")
  .action(async (options) => {
    await configCommand(options);
  });

program.parse();
