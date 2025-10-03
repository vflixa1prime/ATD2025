import { toPng } from "html-to-image";

export async function captureNodeToPng(node: HTMLElement) {
  return toPng(node, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 2, 3),
    backgroundColor: getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--background")
      ? undefined
      : "white",
  });
}
