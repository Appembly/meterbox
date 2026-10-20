import type { Metadata } from "next";
import { OverviewView } from "../../../../console/views/overview/OverviewView";

export const metadata: Metadata = { title: "Overview · Meterbox" };

export default function OverviewPage() {
  return <OverviewView />;
}
