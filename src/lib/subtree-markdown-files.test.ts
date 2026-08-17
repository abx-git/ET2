import { describe, expect, it } from "vitest";

import { writeMarkdownFilesToDirectory } from "@/lib/subtree-markdown-files";

describe("writeMarkdownFilesToDirectory", () => {
  it("creates nested directories and writes file contents", async () => {
    const written = new Map<string, string>();
    const dirs = new Map<string, FileSystemDirectoryHandle>();

    const makeDir = (path: string): FileSystemDirectoryHandle => {
      const existing = dirs.get(path);
      if (existing) return existing;
      const handle = {
        kind: "directory" as const,
        name: path.split("/").pop() || "root",
        async getDirectoryHandle(name: string, _opts?: { create?: boolean }) {
          const next = path ? `${path}/${name}` : name;
          return makeDir(next);
        },
        async getFileHandle(name: string, _opts?: { create?: boolean }) {
          const filePath = path ? `${path}/${name}` : name;
          return {
            kind: "file" as const,
            name,
            async getFile() {
              return new File([written.get(filePath) ?? ""], name);
            },
            async createWritable() {
              let buf = "";
              return {
                async write(data: string | BufferSource | Blob) {
                  if (typeof data === "string") buf += data;
                  else if (data instanceof Blob) buf += await data.text();
                  else buf += new TextDecoder().decode(data as ArrayBuffer);
                },
                async close() {
                  written.set(filePath, buf);
                },
                async abort() {},
                get locked() {
                  return false;
                },
              };
            },
            async queryPermission() {
              return "granted" as PermissionState;
            },
            async requestPermission() {
              return "granted" as PermissionState;
            },
          } as unknown as FileSystemFileHandle;
        },
      } as unknown as FileSystemDirectoryHandle;
      dirs.set(path, handle);
      return handle;
    };

    const root = makeDir("");
    const count = await writeMarkdownFilesToDirectory(root, [
      { relativePath: "projekt.md", content: "# Projekt\n" },
      { relativePath: "projekt/phase-1.md", content: "# Phase 1\n" },
    ]);
    expect(count).toBe(2);
    expect(written.get("projekt.md")).toBe("# Projekt\n");
    expect(written.get("projekt/phase-1.md")).toBe("# Phase 1\n");
  });
});
