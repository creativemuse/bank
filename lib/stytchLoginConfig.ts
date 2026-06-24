import { OAuthProviders, OTPMethods, Products } from "@stytch/nextjs";

/** 30 days — must not exceed the max set in Stytch Dashboard → SDK Configuration */
export const SESSION_DURATION_MINUTES = 60 * 24 * 30;

export const getAuthRedirectUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/authenticate`;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production"
      ? "https://bank.creativeplatform.xyz"
      : "http://localhost:3000");

  return `${siteUrl}/authenticate`;
};

export const getStytchLoginConfig = (authRedirectUrl: string) => ({
  products: [Products.otp, Products.oauth],
  otpOptions: {
    methods: [OTPMethods.Email],
    expirationMinutes: 10,
  },
  oauthOptions: {
    providers: [{ type: OAuthProviders.Google }],
    loginRedirectURL: authRedirectUrl,
    signupRedirectURL: authRedirectUrl,
  },
});
