import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nudge Me",
    short_name: "Nudge Me",
    description: "One-line reminders that keep nudging until you mark them done.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef1f7",
    theme_color: "#eef1f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
