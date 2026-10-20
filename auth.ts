import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Only basic, non-sensitive scopes: no Google app verification needed.
      authorization: { params: { scope: "openid email profile", prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  trustHost: true,
  pages: { signIn: "/", error: "/" },
  callbacks: {
    // Any Google account may sign in; authorisation (shared with the sheet) is checked per request.
    async signIn({ profile }) {
      return !!profile?.email && profile.email_verified !== false;
    },
  },
});
