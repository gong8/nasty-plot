import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // DEV-ONLY credentials: username="dev", password="dev"
        // WARNING: This MUST be replaced with a real auth provider before production deployment
        if (!credentials?.username || !credentials?.password) return null
        if (credentials.username !== "dev" || credentials.password !== "dev") return null
        return { id: "1", name: credentials.username }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
}
