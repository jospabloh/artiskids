import { useEffect, useState } from "react";
import { callFunction } from "@/lib/functions";

// Drawings are private files; this asks the content function for short-lived
// signed links (it checks each drawing belongs to the caller's family before
// signing). Returns { [drawingId]: url }; an id is absent until its link
// arrives, or if the server refused it.
export function useDrawingImages(drawings) {
  const [urls, setUrls] = useState({});
  const key = drawings.map((d) => d.id).join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    callFunction("content", "imageUrls", { ids: key.split(",") })
      .then((data) => { if (!cancelled) setUrls(data?.urls ?? {}); })
      .catch(() => { if (!cancelled) setUrls({}); });
    return () => { cancelled = true; };
  }, [key]);

  return urls;
}
