import { describe, expect, it } from "vitest";
import { keepImages, pathOf, sortFiles } from "@/lib/upload";

function file(name: string, type = "image/jpeg", size = 1024): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name.split("/").pop() ?? name, { type });
}

/** Mimics a folder pick, where the browser sets webkitRelativePath. */
function inFolder(path: string, type = "image/jpeg"): File {
  const f = file(path, type);
  Object.defineProperty(f, "webkitRelativePath", { value: path });
  return f;
}

describe("folder uploads", () => {
  it("orders frames the way a photographer numbered them", () => {
    const picked = [
      inFolder("roll/IMG_10.jpg"),
      inFolder("roll/IMG_2.jpg"),
      inFolder("roll/IMG_1.jpg"),
    ];
    expect(sortFiles(picked).map(pathOf)).toEqual([
      "roll/IMG_1.jpg",
      "roll/IMG_2.jpg",
      "roll/IMG_10.jpg",
    ]);
  });

  it("sorts by the whole path so nested folders stay grouped", () => {
    const picked = [
      inFolder("roll/b/2.jpg"),
      inFolder("roll/a/2.jpg"),
      inFolder("roll/a/10.jpg"),
    ];
    expect(sortFiles(picked).map(pathOf)).toEqual([
      "roll/a/2.jpg",
      "roll/a/10.jpg",
      "roll/b/2.jpg",
    ]);
  });

  it("drops the debris a real photo folder carries", () => {
    const picked = [
      inFolder("roll/.DS_Store", "application/octet-stream"),
      inFolder("roll/Thumbs.db", "application/octet-stream"),
      inFolder("roll/notes.txt", "text/plain"),
      inFolder("roll/RAW/DSC_1.NEF", "image/x-nikon-nef"),
      inFolder("roll/frame-01.jpg"),
      inFolder("roll/frame-02.png", "image/png"),
    ];
    expect(keepImages(picked).map((f) => f.name)).toEqual(["frame-01.jpg", "frame-02.png"]);
  });

  it("keeps every accepted still format", () => {
    const picked = [
      inFolder("a.jpg"),
      inFolder("b.jpeg"),
      inFolder("c.png", "image/png"),
      inFolder("d.webp", "image/webp"),
      inFolder("e.heic", "image/heic"),
    ];
    expect(keepImages(picked)).toHaveLength(5);
  });

  it("falls back to the plain name when there is no relative path", () => {
    expect(pathOf(file("loose.jpg"))).toBe("loose.jpg");
  });
});
