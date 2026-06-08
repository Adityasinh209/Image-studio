export type SocialPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  platform: string;
};

export const SOCIAL_PRESETS: SocialPreset[] = [
  { id: "instagram-post", name: "Instagram Post", width: 1080, height: 1080, platform: "Instagram" },
  { id: "instagram-story", name: "Instagram Story", width: 1080, height: 1920, platform: "Instagram" },
  { id: "facebook-post", name: "Facebook Post", width: 1200, height: 630, platform: "Facebook" },
  { id: "linkedin-post", name: "LinkedIn Post", width: 1200, height: 627, platform: "LinkedIn" },
  { id: "linkedin-banner", name: "LinkedIn Banner", width: 1584, height: 396, platform: "LinkedIn" },
  { id: "youtube-thumbnail", name: "YouTube Thumbnail", width: 1280, height: 720, platform: "YouTube" },
  { id: "youtube-banner", name: "YouTube Banner", width: 2560, height: 1440, platform: "YouTube" },
  { id: "twitter-header", name: "Twitter/X Header", width: 1500, height: 500, platform: "Twitter/X" },
];
