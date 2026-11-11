import { AppShell } from "../../components/app-shell";
import { ShellProvider } from "../../components/shell-provider";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <ShellProvider><AppShell>{children}</AppShell></ShellProvider>;
}
