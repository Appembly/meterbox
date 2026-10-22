"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { recallContext } from "../console/ConsoleProvider";
import { apiGet } from "../console/lib/api";
import { normalizeEnvironments, normalizeOrganizations } from "../console/lib/normalize";
import { AppemblyLogo } from "../packages/appembly-ui/components/brand/AppemblyLogo";

/** Entry point: resolve the last-used (or first production) environment and open its overview. */
export default function ConsoleEntry() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawOrgs, rawEnvs] = await Promise.all([
          apiGet("/api/control/v1/organizations"),
          apiGet("/api/control/v1/environments"),
        ]);
        if (cancelled) return;
        const orgs = normalizeOrganizations(rawOrgs);
        const envs = normalizeEnvironments(rawEnvs);
        const saved = recallContext();
        const savedOrg = saved && orgs.find((o) => o.slug === saved.orgSlug);
        const savedEnv = savedOrg && envs.find((e) => e.org_id === savedOrg.id && e.slug === saved!.envSlug);
        if (savedOrg && savedEnv) {
          router.replace(`/${savedOrg.slug}/${savedEnv.slug}/overview`);
          return;
        }
        const org = orgs[0];
        const env =
          org &&
          (envs.find((e) => e.org_id === org.id && e.type === "production") ||
            envs.find((e) => e.org_id === org.id));
        if (org && env) router.replace(`/${org.slug}/${env.slug}/overview`);
        else router.replace("/demo-ai/production/overview");
      } catch {
        if (!cancelled) {
          router.replace("/demo-ai/production/overview");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--background, #F6F7F5)",
      }}
      aria-label="Loading Meterbox"
      role="status"
    >
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 96,
            height: 96,
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(78, 128, 103, 0.16) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <AppemblyLogo variant="mark" size={48} strokeColor="#4E8067" animated speed="loader" />
      </div>
    </div>
  );
}
