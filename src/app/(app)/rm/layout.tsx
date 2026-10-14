import { exigirEmpresa } from "@/lib/acesso";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirEmpresa("rm");
  return children;
}
