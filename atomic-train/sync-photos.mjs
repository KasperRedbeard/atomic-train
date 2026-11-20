import fs from "node:fs";

const ALBUM_URL = "https://photos.app.goo.gl/zntpiVSbSn6L2Nr5A";
const OUTPUT_FILE = "photos.json";

async function sync() {
  const res = await fetch(ALBUM_URL, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch album: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Extract album title from og:title if present
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const title = titleMatch ? titleMatch[1].replace(/ - Google Photos$/, "") : "atomic-train.com";

  const seen = new Set();
  const photos = [];

  // Primary match: Google Photos embeds ["https://lh3.googleusercontent.com/pw/...", width, height]
  const tupleRegex = /\["(https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+)",(\d+),(\d+)/g;
  for (const match of html.matchAll(tupleRegex)) {
    const [, url, w, h] = match;
    if (!seen.has(url)) {
      seen.add(url);
      photos.push({ url, width: Number(w), height: Number(h) });
    }
  }

  // Fallback match if Google changes the tuple format
  if (photos.length === 0) {
    const urlRegex = /"(https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+)"/g;
    for (const match of html.matchAll(urlRegex)) {
      const url = match[1];
      if (!seen.has(url)) {
        seen.add(url);
        photos.push({ url, width: 1600, height: 1200 });
      }
    }
  }

  if (photos.length === 0) {
    throw new Error("No photos found. Check that link sharing is enabled and the album has images.");
  }

  const payload = {
    title,
    albumUrl: ALBUM_URL,
    updatedAt: new Date().toISOString(),
    count: photos.length,
    photos,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Synced ${photos.length} photos to ${OUTPUT_FILE}`);
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});