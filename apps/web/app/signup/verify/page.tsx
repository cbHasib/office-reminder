import React, { Suspense } from "react";
import VerifyPage from "./_components/VerifyPage";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyPage />
    </Suspense>
  );
}
