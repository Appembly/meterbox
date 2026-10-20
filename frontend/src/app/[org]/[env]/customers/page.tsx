import { Suspense } from "react";
import { CustomersView } from "../../../../console/views/customers/CustomersView";

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersView />
    </Suspense>
  );
}
