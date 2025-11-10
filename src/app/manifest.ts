import type {
  MetadataRoute
} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "p5*js templates",
    short_name: "p5.steeve.website",
    description: "Generate video with HTML and JavaScript (p5*js)",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/assets/images/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/assets/images/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
