import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateBitcart } from "@/lib/bitcart/server";
import type { AgoraRole } from "@/lib/auth/types";

function roleFor(email: string): AgoraRole {
  const admins = (process.env.AGORA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(email.toLowerCase()) ? "admin" : "operator";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  providers: [
    CredentialsProvider({
      name: "Bitcart",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const identity = await authenticateBitcart({ email, password });
        if (!identity) {
          return null;
        }

        return {
          id: identity.userId,
          email,
          bitcartAccessToken: identity.accessToken,
          bitcartUserId: identity.userId,
          role: roleFor(email),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.bitcartAccessToken = user.bitcartAccessToken;
        token.bitcartUserId = user.bitcartUserId;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.sub || !token.email || !token.role) {
        throw new Error("Invalid Agora session");
      }

      session.user = {
        ...session.user,
        id: token.sub,
        email: token.email,
        role: token.role,
      };
      return session;
    },
  },
  pages: { signIn: "/login" },
};
