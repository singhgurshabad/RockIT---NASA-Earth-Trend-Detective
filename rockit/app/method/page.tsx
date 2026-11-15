"use client";

import { BootGate, useAppData } from "@/components/AppData";
import Method from "@/components/Method";

export default function MethodPage() {
  const { boot, retry, glossary } = useAppData();
  if (boot.status !== "ready") return <BootGate boot={boot} retry={retry} />;
  return (
    <main>
      <Method meta={boot.meta} variables={boot.variables} glossary={glossary} />
    </main>
  );
}
