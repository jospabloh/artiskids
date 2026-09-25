// Lives at the functions ROOT, like acaciaSign.test.ts: every directory under
// base44/functions/ is a deployed endpoint and a test file is not one.
//
// What this protects: the storage quota is charged with the size of the file
// that was actually stored, never a number the client sends. If
// countBytesUpTo ever reported less than it read, a family could store past
// its plan's quota -- the exact bypass this helper replaced.
import { assertEquals } from "jsr:@std/assert@1";
import { countBytesUpTo } from "./content/_storageQuota.ts";

function streamOf(chunks: number[]): { stream: ReadableStream<Uint8Array>; pulled: () => number } {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) return controller.close();
      controller.enqueue(new Uint8Array(chunks[i++]));
    },
  });
  return { stream, pulled: () => i };
}

Deno.test("reports the real size of a file that fits", async () => {
  const { stream } = streamOf([1000, 2000, 500]);
  assertEquals(await countBytesUpTo(stream, 10_000), 3500);
});

Deno.test("a file exactly at the limit still fits", async () => {
  const { stream } = streamOf([600, 400]);
  assertEquals(await countBytesUpTo(stream, 1000), 1000);
});

Deno.test("an oversized file reads as over the limit and is not read in full", async () => {
  const { stream, pulled } = streamOf([800, 800, 800, 800]);
  assertEquals(await countBytesUpTo(stream, 1000), 1001);
  // Stopped after the chunk that crossed the limit: a 5 GB upload must not
  // be downloaded end to end just to be refused.
  assertEquals(pulled() < 4, true);
});

Deno.test("a family with no room left is refused for any non-empty file", async () => {
  const { stream } = streamOf([1]);
  assertEquals(await countBytesUpTo(stream, 0), 1);
});
