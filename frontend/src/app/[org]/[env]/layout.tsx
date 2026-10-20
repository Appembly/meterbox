import { ConsoleProvider } from "../../../console/ConsoleProvider";
import { ConsoleShell } from "../../../console/shell/ConsoleShell";

export default function ConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { org: string; env: string };
}) {
  return (
    <ConsoleProvider orgSlug={params.org} envSlug={params.env}>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleProvider>
  );
}
