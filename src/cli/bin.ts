import { DynamicCommandLineParser } from "@rushstack/ts-command-line";
import { DNSProtectCLI } from "./cli";

const commandLine: DNSProtectCLI = new DNSProtectCLI();
commandLine.execute();