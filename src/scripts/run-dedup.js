#!/usr/bin/env node
/**
 * run-dedup.js — dedup-cleanup.ts 실행 래퍼
 *
 * Node.js 22+ 의 --experimental-strip-types 기능으로 TypeScript를 직접 실행합니다.
 * ts-node 설치가 필요 없습니다.
 *
 * 사용법:
 *   node src/scripts/run-dedup.js           # dry-run (미리보기만)
 *   node src/scripts/run-dedup.js --execute  # 실제 삭제 실행
 */

const { spawnSync } = require("child_process");
const path = require("path");

const scriptPath = path.join(__dirname, "dedup-cleanup.ts");
const args = process.argv.slice(2); // --execute 등 전달

const result = spawnSync(
  process.execPath, // 현재 node 실행파일
  [
    "--experimental-strip-types",
    "--no-warnings",
    scriptPath,
    ...args,
  ],
  {
    stdio: "inherit",
    cwd: path.join(__dirname, "../../.."), // 프로젝트 루트
  }
);

process.exit(result.status ?? 1);
