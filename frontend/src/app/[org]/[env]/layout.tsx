import { ConsoleProvider } from "../../../console/ConsoleProvider";
import { ConsoleShell } from "../../../console/shell/ConsoleShell";
import { SauthenAuthGuard } from "../../../packages/appembly-ui";

export default function ConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { org: string; env: string };
}) {
  return (
    <SauthenAuthGuard brand="meterbox">
      <ConsoleProvider orgSlug={params.org} envSlug={params.env}>
        <ConsoleShell>{children}</ConsoleShell>
      </ConsoleProvider>
    </SauthenAuthGuard>
  );
}
