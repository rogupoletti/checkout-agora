import type { DefaultSession } from "next-auth";
import type { AgoraRole } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AgoraRole;
    } & DefaultSession["user"];
  }

  interface User {
    bitcartAccessToken: string;
    bitcartUserId: string;
    role: AgoraRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    bitcartAccessToken?: string;
    bitcartUserId?: string;
    role?: AgoraRole;
  }
}
