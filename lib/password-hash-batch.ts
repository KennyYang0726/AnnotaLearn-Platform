import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import bcrypt from "bcryptjs";

type PasswordItem = {
  index: number;
  password: string;
};

type WorkerResult = {
  index: number;
  passwordHash: string;
};

const BCRYPT_ROUNDS = 12;
const MAX_WORKERS = 4;

const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const bcrypt = require("bcryptjs");

try {
  const results = workerData.items.map((item) => ({
    index: item.index,
    passwordHash: bcrypt.hashSync(item.password, workerData.rounds),
  }));
  parentPort.postMessage({ ok: true, results });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : "密碼雜湊失敗",
  });
}
`;

function workerCountFor(itemCount: number) {
  if (itemCount <= 1) return 1;
  const cpuCount = Math.max(1, availableParallelism());
  return Math.max(1, Math.min(MAX_WORKERS, itemCount, cpuCount > 1 ? cpuCount - 1 : 1));
}

function runWorker(items: PasswordItem[]) {
  return new Promise<WorkerResult[]>((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { items, rounds: BCRYPT_ROUNDS },
    });

    worker.once("message", (message: { ok: boolean; results?: WorkerResult[]; error?: string }) => {
      if (message.ok && message.results) resolve(message.results);
      else reject(new Error(message.error || "密碼雜湊失敗"));
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`密碼雜湊Worker異常結束（${code}）`));
    });
  });
}

export async function hashPasswordsBatch(passwords: string[]) {
  if (!passwords.length) return [];

  const count = workerCountFor(passwords.length);
  if (count === 1 || passwords.length < 4) {
    const hashes: string[] = [];
    for (const password of passwords) hashes.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
    return hashes;
  }

  const chunks: PasswordItem[][] = Array.from({ length: count }, () => []);
  passwords.forEach((password, index) => {
    chunks[index % count].push({ index, password });
  });

  const results = (await Promise.all(chunks.filter((chunk) => chunk.length).map(runWorker))).flat();
  const hashes = new Array<string>(passwords.length);
  for (const result of results) hashes[result.index] = result.passwordHash;
  return hashes;
}
