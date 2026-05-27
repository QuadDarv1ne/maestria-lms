/**
 * Feature Flags Configuration
 * 
 * Central registry of all feature flags with typed definitions.
 * Each flag has: key, default value, description, and rollout percentage.
 */

export interface FeatureFlagDefinition {
  key: string;
  description: string;
  defaultValue: boolean;
  /** Percentage of users who see the feature (0-100). null = all users get defaultValue */
  rolloutPercentage?: number | null;
  /** Environment restriction: null = all, 'development' = dev only, 'production' = prod only */
  environment?: "development" | "production" | null;
}

export const FEATURE_FLAGS: Record<string, FeatureFlagDefinition> = {
  // === Core Features ===
  emailVerification: {
    key: "emailVerification",
    description: "Require email verification after registration",
    defaultValue: true,
    rolloutPercentage: null,
  },

  twoFactorAuth: {
    key: "twoFactorAuth",
    description: "Enable 2FA authentication for users",
    defaultValue: true,
    rolloutPercentage: null,
  },

  // === Course Features ===
  courseCertificates: {
    key: "courseCertificates",
    description: "Allow certificate generation for completed courses",
    defaultValue: true,
    rolloutPercentage: null,
  },

  courseReviews: {
    key: "courseReviews",
    description: "Enable course reviews and ratings",
    defaultValue: true,
    rolloutPercentage: null,
  },

  // === Payment Features ===
  paymentWebhooks: {
    key: "paymentWebhooks",
    description: "Enable automatic payment webhook processing",
    defaultValue: true,
    rolloutPercentage: 100,
  },

  // === Blog Features ===
  blogArticles: {
    key: "blogArticles",
    description: "Enable blog/articles section",
    defaultValue: true,
    rolloutPercentage: null,
  },

  // === Admin Features ===
  adminSettings: {
    key: "adminSettings",
    description: "Show admin settings tab with system toggles",
    defaultValue: true,
    rolloutPercentage: null,
  },

  adminCacheManagement: {
    key: "adminCacheManagement",
    description: "Show cache clearing button in admin panel",
    defaultValue: true,
    rolloutPercentage: null,
  },

  // === Experimental Features ===
  darkModeAmber: {
    key: "darkModeAmber",
    description: "Enable amber theme variant",
    defaultValue: true,
    rolloutPercentage: null,
  },

  apiCaching: {
    key: "apiCaching",
    description: "Enable Redis response caching for API endpoints",
    defaultValue: true,
    rolloutPercentage: 100,
  },

  // === Future Features (disabled by default) ===
  socialLogin: {
    key: "socialLogin",
    description: "Enable Google/GitHub OAuth login",
    defaultValue: false,
    rolloutPercentage: null,
  },

  liveChat: {
    key: "liveChat",
    description: "Enable real-time chat between students and teachers",
    defaultValue: false,
    rolloutPercentage: null,
  },

  aiTutor: {
    key: "aiTutor",
    description: "Enable AI-powered tutoring assistant",
    defaultValue: false,
    rolloutPercentage: null,
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
