import type { MetadataRoute } from "next";
import { getSiteSettings, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_TITLE } from "@/lib/site-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSiteSettings();
  const icons: MetadataRoute.Manifest["icons"] = settings.appleTouchIconUrl || settings.faviconUrl
    ? [{ src: settings.appleTouchIconUrl || settings.faviconUrl!, sizes: "any" }]
    : [{ src: "/icon", sizes: "32x32", type: "image/png" }];
  return {
    name: settings.ogTitle || SITE_DEFAULT_TITLE,
    short_name: settings.appShortName,
    description: settings.ogDescription || SITE_DEFAULT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: settings.themeColor,
    icons,
  };
}
