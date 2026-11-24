import { connection } from "next/server";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await connection();
  return <RegisterForm />;
}
