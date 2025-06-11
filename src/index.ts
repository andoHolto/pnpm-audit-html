#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { generateHtml } from './htmlGenerator';
import { writeFileSync } from 'fs';

const SEVERITY_LEVELS: Array<string> = ['info', 'low', 'moderate', 'high', 'critical'] as const 

export const runPnpmAudit = (auditLevel: string, prod: boolean): string => {
  const levelIncludes = SEVERITY_LEVELS.slice(SEVERITY_LEVELS.indexOf(auditLevel)).join("\" or .value.severity == \"")
  const auditLevelPruneJQ = `| jq '.advisories = (.advisories | to_entries | 
    map(select(.value.severity == \"${levelIncludes}\")) | 
    from_entries)'`

  try {
    return execSync(`pnpm audit --audit-level ${auditLevel} ${prod===true ? '--prod' : ''} --json ${auditLevelPruneJQ}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 20, // 20 MB buffer
    } as ExecSyncOptionsWithStringEncoding);
  } catch (error) {
    if (error instanceof Error && (error as any).stdout) {
      return (error as any).stdout.toString();
    } else {
      throw error;
    }
  }
};

export const generateAuditReport = (auditOutput: string, outputPath: string): void => {
  let auditData;
  try {
    auditData = JSON.parse(auditOutput);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to parse JSON:', error.message);
      console.error('Raw output:', auditOutput);
    }
    throw error;
  }

  const html = generateHtml(auditData);
  writeFileSync(outputPath, html);
};

export const main = (cliArgs: string[] = process.argv): void => {
  const program = new Command();

  program
    .name('pnpm-audit-html')
    .version('1.0.0')
    .description('Generate HTML report from pnpm audit')
    .option('-o, --output <file>', 'Output HTML file', 'pnpm-audit-report.html')
    .option('--audit-level <severity>', 'Minimum severity', 'high')
    .option('--prod', 'Only audit prod', false)
    .action((options) => {
      try {
        console.log(`Running pnpm audit with options [--audit-level=${options.auditLevel}, --prod=${options.prod}] ...`);
        console.time('Audit report generation time');
        const auditOutput = runPnpmAudit(options.auditLevel, options.prod);
        console.log('Audit command completed. Parsing output...');
        generateAuditReport(auditOutput, options.output);

        console.timeEnd('Audit report generation time');
        console.log(`Audit report generated: ${options.output}`);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Failed to generate audit report:', error.message);
        }
        console.error('Full error:', error);
      }
    });

  // Custom help information
  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ pnpm-audit-html --output report.html');
    console.log('  $ pnpm-audit-html -o custom-report.html');
  });

  program.parse(cliArgs);
};

if (require.main === module) {
  main();
}
