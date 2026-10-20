import { Suspense } from "react";
import { EventsView } from "../../../../console/views/usage/EventsView";

export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsView />
    </Suspense>
  );
}
