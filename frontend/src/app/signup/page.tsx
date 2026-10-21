"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SauthenAuthCard } from "../../packages/appembly-ui/components/auth/SauthenAuthKit";

export default function MeterboxSignupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F6F7F5] flex flex-col items-center justify-center p-4">
      <SauthenAuthCard
        brand="meterbox"
        initialMode="signup"
        onSuccess={(payload) => {
          const slug = payload.organization?.slug || "appembly";
          setTimeout(() => router.push(`/${slug}/production/overview`), 500);
        }}
      />
    </div>
  );
}
