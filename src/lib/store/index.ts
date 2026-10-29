import "server-only";
import path from "node:path";
import { createFileStore, type FileStore } from "./file-store";

const globalStore = globalThis as typeof globalThis & { __intromeshStore?: FileStore };

export function getStore(): FileStore {
  globalStore.__intromeshStore ??= createFileStore(path.join(process.cwd(), ".data"));
  return globalStore.__intromeshStore;
}

export function persistenceMode(): "file" {
  return "file";
}
