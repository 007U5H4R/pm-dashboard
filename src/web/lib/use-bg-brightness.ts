import { useEffect, useState } from "react";

/**
 * Samples a background image (data URI or same-origin URL) and reports whether it reads as 'light'
 * or 'dark', so overlaid text can pick a contrasting color. Defaults to 'dark' (→ light text) until
 * the image loads or if sampling fails.
 */
export function useBgBrightness(url: string | undefined): "light" | "dark" {
	const [tone, setTone] = useState<"light" | "dark">("dark");

	useEffect(() => {
		if (!url) {
			setTone("dark");
			return;
		}
		let cancelled = false;
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				const size = 24;
				const canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext("2d");
				if (!ctx) return;
				ctx.drawImage(img, 0, 0, size, size);
				const { data } = ctx.getImageData(0, 0, size, size);
				let sum = 0;
				let count = 0;
				for (let i = 0; i < data.length; i += 4) {
					sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
					count += 1;
				}
				const luminance = count > 0 ? sum / count / 255 : 0;
				if (!cancelled) setTone(luminance > 0.6 ? "light" : "dark");
			} catch {
				if (!cancelled) setTone("dark");
			}
		};
		img.onerror = () => {
			if (!cancelled) setTone("dark");
		};
		img.src = url;
		return () => {
			cancelled = true;
		};
	}, [url]);

	return tone;
}
