import { AppemblyLogo } from "../packages/appembly-ui/components/brand/AppemblyLogo";

export default function RootLoading() {
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
      <AppemblyLogo variant="mark" size={48} strokeColor="#4E8067" animated speed="loader" />
    </div>
  );
}
